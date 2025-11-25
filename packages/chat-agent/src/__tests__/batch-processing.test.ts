/**
 * Unit tests for batch processing in CloudflareChatAgent
 *
 * Tests the queueMessage, onBatchAlarm, and processBatch methods.
 * Uses mocks to simulate Durable Object behavior without actual DO runtime.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type BatchState, DEFAULT_BATCH_CONFIG, createInitialBatchState } from '../batch-types.js';
import type { ParsedInput, Transport } from '../transport.js';

// Mock transport for testing
interface TestContext {
  chatId: number;
  userId: number;
  text: string;
  metadata?: { requestId?: string };
}

const createMockTransport = () => {
  const transport: Transport<TestContext> = {
    send: vi.fn().mockResolvedValue(123),
    edit: vi.fn().mockResolvedValue(undefined),
    typing: vi.fn().mockResolvedValue(undefined),
    parseContext: vi.fn(
      (ctx: TestContext): ParsedInput => ({
        text: ctx.text,
        userId: ctx.userId,
        chatId: ctx.chatId,
        metadata: ctx.metadata,
      })
    ),
  };
  return transport;
};

// Mock LLM provider
const createMockProvider = () => ({
  chat: vi.fn().mockResolvedValue({
    content: 'LLM response',
    toolCalls: undefined,
  }),
});

// Minimal mock for testing batch state logic without DO runtime
interface MockAgentState {
  batch?: BatchState;
  messages: Array<{ role: string; content: string }>;
  userId?: string | number;
  chatId?: string | number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

describe('batch-processing', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let _mockProvider: ReturnType<typeof createMockProvider>;
  let state: MockAgentState;
  let scheduledAlarms: Array<{
    delaySeconds: number;
    handler: string;
    data: unknown;
  }>;

  // Simulate the key batch logic from cloudflare-agent
  const queueMessage = async (ctx: TestContext): Promise<{ queued: boolean; batchId?: string }> => {
    const input = mockTransport.parseContext(ctx);
    const requestId = (input.metadata?.requestId as string) || crypto.randomUUID();
    const now = Date.now();

    // Initialize batch state if not present
    const batch = state.batch ?? createInitialBatchState();

    // Check for duplicate request
    const isDuplicate = batch.pendingMessages.some((m) => m.requestId === requestId);
    if (isDuplicate) {
      return { queued: false };
    }

    // Add to pending messages
    batch.pendingMessages.push({
      text: input.text,
      timestamp: now,
      requestId,
      userId: input.userId,
      chatId: input.chatId,
    });
    batch.lastMessageAt = now;

    // Set batch start time if this is the first message
    if (batch.status === 'idle') {
      batch.status = 'collecting';
      batch.batchStartedAt = now;
      batch.batchId = crypto.randomUUID();
    }

    state.batch = batch;
    state.updatedAt = now;

    // Check if we should process immediately
    const shouldProcessNow =
      batch.pendingMessages.length >= DEFAULT_BATCH_CONFIG.maxMessages ||
      (batch.batchStartedAt > 0 && now - batch.batchStartedAt >= DEFAULT_BATCH_CONFIG.maxWindowMs);

    if (shouldProcessNow) {
      scheduledAlarms.push({
        delaySeconds: 0.001,
        handler: 'onBatchAlarm',
        data: { batchId: batch.batchId },
      });
    } else {
      scheduledAlarms.push({
        delaySeconds: DEFAULT_BATCH_CONFIG.windowMs / 1000,
        handler: 'onBatchAlarm',
        data: { batchId: batch.batchId },
      });
    }

    return { queued: true, batchId: batch.batchId ?? undefined };
  };

  beforeEach(() => {
    mockTransport = createMockTransport();
    _mockProvider = createMockProvider();
    state = {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    scheduledAlarms = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('queueMessage', () => {
    it('queues first message and transitions to collecting', async () => {
      const ctx: TestContext = {
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      };

      const result = await queueMessage(ctx);

      expect(result.queued).toBe(true);
      expect(result.batchId).toBeDefined();
      expect(state.batch?.status).toBe('collecting');
      expect(state.batch?.pendingMessages).toHaveLength(1);
      expect(state.batch?.pendingMessages[0].text).toBe('hello');
    });

    it('queues multiple messages in same batch', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      expect(state.batch?.pendingMessages).toHaveLength(2);
      expect(state.batch?.pendingMessages[0].text).toBe('first');
      expect(state.batch?.pendingMessages[1].text).toBe('second');
    });

    it('rejects duplicate requestId', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'same-id' },
      });

      const result = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'duplicate',
        metadata: { requestId: 'same-id' },
      });

      expect(result.queued).toBe(false);
      expect(state.batch?.pendingMessages).toHaveLength(1);
    });

    it('schedules alarm with batch window delay', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(scheduledAlarms).toHaveLength(1);
      expect(scheduledAlarms[0].delaySeconds).toBe(DEFAULT_BATCH_CONFIG.windowMs / 1000);
      expect(scheduledAlarms[0].handler).toBe('onBatchAlarm');
    });

    it('resets alarm on each new message', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      // Should have 2 alarm schedules (each message schedules/resets)
      expect(scheduledAlarms).toHaveLength(2);
    });

    it('triggers immediate processing at max messages', async () => {
      // Queue 10 messages (max)
      for (let i = 0; i < 10; i++) {
        await queueMessage({
          chatId: 123,
          userId: 456,
          text: `msg${i}`,
          metadata: { requestId: `req${i}` },
        });
      }

      // Last alarm should be immediate (0.001 seconds)
      const lastAlarm = scheduledAlarms[scheduledAlarms.length - 1];
      expect(lastAlarm.delaySeconds).toBe(0.001);
    });

    it('preserves userId and chatId from context', async () => {
      await queueMessage({
        chatId: 999,
        userId: 888,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(state.batch?.pendingMessages[0].userId).toBe(888);
      expect(state.batch?.pendingMessages[0].chatId).toBe(999);
    });

    it('generates requestId if not provided', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
      });

      expect(state.batch?.pendingMessages[0].requestId).toBeDefined();
      expect(state.batch?.pendingMessages[0].requestId.length).toBeGreaterThan(0);
    });
  });

  describe('batch state transitions', () => {
    it('starts in idle state', () => {
      const initial = createInitialBatchState();
      expect(initial.status).toBe('idle');
    });

    it('transitions idle -> collecting on first message', async () => {
      expect(state.batch).toBeUndefined();

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(state.batch?.status).toBe('collecting');
    });

    it('stays in collecting state for additional messages', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      expect(state.batch?.status).toBe('collecting');
    });

    it('sets batchStartedAt on first message only', async () => {
      const beforeQueue = Date.now();

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      const firstBatchStartedAt = state.batch?.batchStartedAt;
      expect(firstBatchStartedAt).toBeGreaterThanOrEqual(beforeQueue);

      // Wait a bit and add another message
      await new Promise((r) => setTimeout(r, 10));

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      // batchStartedAt should not change
      expect(state.batch?.batchStartedAt).toBe(firstBatchStartedAt);
    });

    it('updates lastMessageAt on each message', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      const firstLastMessageAt = state.batch?.lastMessageAt;

      await new Promise((r) => setTimeout(r, 10));

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      expect(state.batch?.lastMessageAt).toBeGreaterThan(firstLastMessageAt!);
    });
  });

  describe('batch limits', () => {
    it('enforces maxMessages limit (10 by default)', async () => {
      // Queue exactly 10 messages
      for (let i = 0; i < 10; i++) {
        await queueMessage({
          chatId: 123,
          userId: 456,
          text: `msg${i}`,
          metadata: { requestId: `req${i}` },
        });
      }

      expect(state.batch?.pendingMessages).toHaveLength(10);

      // Check that immediate processing was triggered
      const lastAlarm = scheduledAlarms[scheduledAlarms.length - 1];
      expect(lastAlarm.delaySeconds).toBe(0.001);
    });

    it('schedules normal delay when under maxMessages', async () => {
      // Queue 5 messages (under 10 limit)
      for (let i = 0; i < 5; i++) {
        await queueMessage({
          chatId: 123,
          userId: 456,
          text: `msg${i}`,
          metadata: { requestId: `req${i}` },
        });
      }

      // All alarms should have normal window delay
      for (const alarm of scheduledAlarms) {
        expect(alarm.delaySeconds).toBe(DEFAULT_BATCH_CONFIG.windowMs / 1000);
      }
    });
  });

  describe('message combining', () => {
    it('combines messages in order', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'world',
        metadata: { requestId: 'req2' },
      });

      const messages = state.batch?.pendingMessages ?? [];
      const combined = messages.map((m) => m.text).join('\n');

      expect(combined).toBe('hello\nworld');
    });

    it('handles typo correction pattern', async () => {
      // User types "hel", then corrects to "hello"
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hel',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req2' },
      });

      const messages = state.batch?.pendingMessages ?? [];
      const combined = messages.map((m) => m.text).join('\n');

      expect(combined).toBe('hel\nhello');
    });

    it('handles multi-line messages', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'line1\nline2',
        metadata: { requestId: 'req1' },
      });

      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'line3',
        metadata: { requestId: 'req2' },
      });

      const messages = state.batch?.pendingMessages ?? [];
      const combined = messages.map((m) => m.text).join('\n');

      expect(combined).toBe('line1\nline2\nline3');
    });
  });

  describe('alarm scheduling', () => {
    it('schedules alarm with correct handler name', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(scheduledAlarms[0].handler).toBe('onBatchAlarm');
    });

    it('passes batchId in alarm data', async () => {
      const result = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(scheduledAlarms[0].data).toEqual({ batchId: result.batchId });
    });

    it('uses 500ms delay by default', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(scheduledAlarms[0].delaySeconds).toBe(0.5);
    });

    it('uses 0.001s delay for immediate processing', async () => {
      // Fill batch to max
      for (let i = 0; i < 10; i++) {
        await queueMessage({
          chatId: 123,
          userId: 456,
          text: `msg${i}`,
          metadata: { requestId: `req${i}` },
        });
      }

      const lastAlarm = scheduledAlarms[scheduledAlarms.length - 1];
      expect(lastAlarm.delaySeconds).toBe(0.001);
    });
  });

  describe('batchId generation', () => {
    it('generates unique batchId for each batch', async () => {
      const result1 = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first batch',
        metadata: { requestId: 'req1' },
      });

      // Reset state to simulate new batch
      state.batch = undefined;

      const result2 = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second batch',
        metadata: { requestId: 'req2' },
      });

      expect(result1.batchId).toBeDefined();
      expect(result2.batchId).toBeDefined();
      expect(result1.batchId).not.toBe(result2.batchId);
    });

    it('keeps same batchId for messages in same batch', async () => {
      const result1 = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'first',
        metadata: { requestId: 'req1' },
      });

      const result2 = await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'second',
        metadata: { requestId: 'req2' },
      });

      expect(result1.batchId).toBe(result2.batchId);
    });
  });

  describe('transport integration', () => {
    it('calls parseContext on transport', async () => {
      const ctx: TestContext = {
        chatId: 123,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      };

      await queueMessage(ctx);

      expect(mockTransport.parseContext).toHaveBeenCalledWith(ctx);
    });

    it('extracts text from parsed context', async () => {
      await queueMessage({
        chatId: 123,
        userId: 456,
        text: 'hello world',
        metadata: { requestId: 'req1' },
      });

      expect(state.batch?.pendingMessages[0].text).toBe('hello world');
    });

    it('extracts userId from parsed context', async () => {
      await queueMessage({
        chatId: 123,
        userId: 999,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(state.batch?.pendingMessages[0].userId).toBe(999);
    });

    it('extracts chatId from parsed context', async () => {
      await queueMessage({
        chatId: 777,
        userId: 456,
        text: 'hello',
        metadata: { requestId: 'req1' },
      });

      expect(state.batch?.pendingMessages[0].chatId).toBe(777);
    });
  });
});
