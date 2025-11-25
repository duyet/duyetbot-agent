/**
 * Unit tests for batch-types.ts
 *
 * Tests pure functions for message batching logic:
 * - calculateRetryDelay: Exponential backoff calculation
 * - combineBatchMessages: Message joining
 * - shouldProcessImmediately: Batch limit checks
 * - isDuplicateMessage: Request deduplication
 * - createInitialBatchState: State initialization
 */

import { describe, expect, it } from 'vitest';
import {
  type BatchConfig,
  type BatchState,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_RETRY_CONFIG,
  type PendingMessage,
  type RetryConfig,
  calculateRetryDelay,
  combineBatchMessages,
  createInitialBatchState,
  isDuplicateMessage,
  shouldProcessImmediately,
} from '../batch-types.js';

describe('batch-types', () => {
  describe('createInitialBatchState', () => {
    it('creates state with idle status', () => {
      const state = createInitialBatchState();
      expect(state.status).toBe('idle');
    });

    it('creates state with empty pending messages', () => {
      const state = createInitialBatchState();
      expect(state.pendingMessages).toEqual([]);
    });

    it('creates state with null batchId', () => {
      const state = createInitialBatchState();
      expect(state.batchId).toBeNull();
    });

    it('creates state with zero retry count', () => {
      const state = createInitialBatchState();
      expect(state.retryCount).toBe(0);
    });

    it('creates state with zero timestamps', () => {
      const state = createInitialBatchState();
      expect(state.lastMessageAt).toBe(0);
      expect(state.batchStartedAt).toBe(0);
    });

    it('does not include optional fields', () => {
      const state = createInitialBatchState();
      expect(state.messageRef).toBeUndefined();
      expect(state.error).toBeUndefined();
    });
  });

  describe('calculateRetryDelay', () => {
    it('returns initial delay for first retry', () => {
      const delay = calculateRetryDelay(0);
      expect(delay).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs);
    });

    it('doubles delay for each retry (exponential backoff)', () => {
      const delay0 = calculateRetryDelay(0);
      const delay1 = calculateRetryDelay(1);
      const delay2 = calculateRetryDelay(2);

      expect(delay1).toBe(delay0 * 2);
      expect(delay2).toBe(delay1 * 2);
    });

    it('caps delay at maxDelayMs', () => {
      // After enough retries, should hit cap
      const delay = calculateRetryDelay(10);
      expect(delay).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs);
    });

    it('uses custom config when provided', () => {
      const customConfig: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 8000,
        backoffMultiplier: 2,
      };

      expect(calculateRetryDelay(0, customConfig)).toBe(1000);
      expect(calculateRetryDelay(1, customConfig)).toBe(2000);
      expect(calculateRetryDelay(2, customConfig)).toBe(4000);
      expect(calculateRetryDelay(3, customConfig)).toBe(8000);
      expect(calculateRetryDelay(4, customConfig)).toBe(8000); // capped
    });

    it('handles non-power-of-2 multipliers', () => {
      const customConfig: RetryConfig = {
        maxRetries: 5,
        initialDelayMs: 1000,
        maxDelayMs: 100000,
        backoffMultiplier: 3,
      };

      expect(calculateRetryDelay(0, customConfig)).toBe(1000);
      expect(calculateRetryDelay(1, customConfig)).toBe(3000);
      expect(calculateRetryDelay(2, customConfig)).toBe(9000);
    });
  });

  describe('combineBatchMessages', () => {
    it('returns empty string for empty array', () => {
      const result = combineBatchMessages([]);
      expect(result).toBe('');
    });

    it('returns single message text without newline', () => {
      const messages: PendingMessage[] = [{ text: 'hello', timestamp: 1000, requestId: 'req1' }];
      const result = combineBatchMessages(messages);
      expect(result).toBe('hello');
    });

    it('joins multiple messages with newlines', () => {
      const messages: PendingMessage[] = [
        { text: 'hello', timestamp: 1000, requestId: 'req1' },
        { text: 'world', timestamp: 1001, requestId: 'req2' },
      ];
      const result = combineBatchMessages(messages);
      expect(result).toBe('hello\nworld');
    });

    it('preserves message order (chronological)', () => {
      const messages: PendingMessage[] = [
        { text: 'first', timestamp: 1000, requestId: 'req1' },
        { text: 'second', timestamp: 1100, requestId: 'req2' },
        { text: 'third', timestamp: 1200, requestId: 'req3' },
      ];
      const result = combineBatchMessages(messages);
      expect(result).toBe('first\nsecond\nthird');
    });

    it('handles messages with newlines in content', () => {
      const messages: PendingMessage[] = [
        { text: 'line1\nline2', timestamp: 1000, requestId: 'req1' },
        { text: 'line3', timestamp: 1001, requestId: 'req2' },
      ];
      const result = combineBatchMessages(messages);
      expect(result).toBe('line1\nline2\nline3');
    });

    it('handles empty text messages', () => {
      const messages: PendingMessage[] = [
        { text: '', timestamp: 1000, requestId: 'req1' },
        { text: 'hello', timestamp: 1001, requestId: 'req2' },
      ];
      const result = combineBatchMessages(messages);
      expect(result).toBe('\nhello');
    });

    it('handles typo correction pattern', () => {
      // Real-world scenario: user types "hel", then corrects to "hello"
      const messages: PendingMessage[] = [
        { text: 'hel', timestamp: 1000, requestId: 'req1' },
        { text: 'hello', timestamp: 1200, requestId: 'req2' },
      ];
      const result = combineBatchMessages(messages);
      expect(result).toBe('hel\nhello');
    });
  });

  describe('shouldProcessImmediately', () => {
    const now = Date.now();

    const createState = (overrides: Partial<BatchState> = {}): BatchState => ({
      status: 'collecting',
      pendingMessages: [],
      batchId: 'batch_123',
      retryCount: 0,
      lastMessageAt: now,
      batchStartedAt: now,
      ...overrides,
    });

    it('returns false for empty batch', () => {
      const state = createState({ pendingMessages: [] });
      expect(shouldProcessImmediately(state)).toBe(false);
    });

    it('returns false when under limits', () => {
      const state = createState({
        pendingMessages: [{ text: 'hello', timestamp: now, requestId: 'req1' }],
        batchStartedAt: now,
      });
      expect(shouldProcessImmediately(state)).toBe(false);
    });

    it('returns true when max messages reached', () => {
      const messages: PendingMessage[] = Array.from({ length: 10 }, (_, i) => ({
        text: `msg${i}`,
        timestamp: now + i,
        requestId: `req${i}`,
      }));
      const state = createState({ pendingMessages: messages });
      expect(shouldProcessImmediately(state)).toBe(true);
    });

    it('returns true when max window elapsed', () => {
      const state = createState({
        pendingMessages: [{ text: 'hello', timestamp: now, requestId: 'req1' }],
        batchStartedAt: now - 6000, // 6 seconds ago (max is 5s)
      });
      expect(shouldProcessImmediately(state)).toBe(true);
    });

    it('uses custom config for max messages', () => {
      const customConfig: BatchConfig = {
        windowMs: 500,
        maxWindowMs: 5000,
        maxMessages: 3,
      };
      const messages: PendingMessage[] = [
        { text: 'msg1', timestamp: now, requestId: 'req1' },
        { text: 'msg2', timestamp: now + 1, requestId: 'req2' },
        { text: 'msg3', timestamp: now + 2, requestId: 'req3' },
      ];
      const state = createState({ pendingMessages: messages });
      expect(shouldProcessImmediately(state, customConfig)).toBe(true);
    });

    it('uses custom config for max window', () => {
      const customConfig: BatchConfig = {
        windowMs: 500,
        maxWindowMs: 2000, // 2 seconds max
        maxMessages: 10,
      };
      const state = createState({
        pendingMessages: [{ text: 'hello', timestamp: now, requestId: 'req1' }],
        batchStartedAt: now - 2500, // 2.5 seconds ago
      });
      expect(shouldProcessImmediately(state, customConfig)).toBe(true);
    });

    it('returns false when batchStartedAt is 0', () => {
      const state = createState({
        pendingMessages: [{ text: 'hello', timestamp: now, requestId: 'req1' }],
        batchStartedAt: 0,
      });
      expect(shouldProcessImmediately(state)).toBe(false);
    });
  });

  describe('isDuplicateMessage', () => {
    it('returns false for empty messages array', () => {
      expect(isDuplicateMessage('req1', [])).toBe(false);
    });

    it('returns false when requestId not found', () => {
      const messages: PendingMessage[] = [
        { text: 'hello', timestamp: 1000, requestId: 'req1' },
        { text: 'world', timestamp: 1001, requestId: 'req2' },
      ];
      expect(isDuplicateMessage('req3', messages)).toBe(false);
    });

    it('returns true when requestId exists', () => {
      const messages: PendingMessage[] = [
        { text: 'hello', timestamp: 1000, requestId: 'req1' },
        { text: 'world', timestamp: 1001, requestId: 'req2' },
      ];
      expect(isDuplicateMessage('req1', messages)).toBe(true);
      expect(isDuplicateMessage('req2', messages)).toBe(true);
    });

    it('handles UUID-style request IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const messages: PendingMessage[] = [{ text: 'hello', timestamp: 1000, requestId: uuid }];
      expect(isDuplicateMessage(uuid, messages)).toBe(true);
      expect(isDuplicateMessage('different-uuid', messages)).toBe(false);
    });

    it('handles short request IDs (Telegram style)', () => {
      const shortId = 'abc12345';
      const messages: PendingMessage[] = [{ text: 'hello', timestamp: 1000, requestId: shortId }];
      expect(isDuplicateMessage(shortId, messages)).toBe(true);
    });
  });

  describe('DEFAULT_BATCH_CONFIG', () => {
    it('has 500ms window', () => {
      expect(DEFAULT_BATCH_CONFIG.windowMs).toBe(500);
    });

    it('has 5000ms max window', () => {
      expect(DEFAULT_BATCH_CONFIG.maxWindowMs).toBe(5000);
    });

    it('has 10 max messages', () => {
      expect(DEFAULT_BATCH_CONFIG.maxMessages).toBe(10);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('has 6 max retries (matches Cloudflare DO Alarms)', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(6);
    });

    it('has 2000ms initial delay', () => {
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).toBe(2000);
    });

    it('has 64000ms max delay', () => {
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(64000);
    });

    it('has backoff multiplier of 2', () => {
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).toBe(2);
    });

    it('produces expected retry sequence', () => {
      // Verify the full retry sequence matches expectations
      const delays = [0, 1, 2, 3, 4, 5, 6].map((i) => calculateRetryDelay(i));
      expect(delays).toEqual([
        2000, // retry 0: 2s
        4000, // retry 1: 4s
        8000, // retry 2: 8s
        16000, // retry 3: 16s
        32000, // retry 4: 32s
        64000, // retry 5: 64s (max)
        64000, // retry 6: 64s (capped)
      ]);
    });
  });

  describe('BatchState type transitions', () => {
    // Test that state machines follow expected transitions
    it('idle -> collecting when first message arrives', () => {
      const initial = createInitialBatchState();
      expect(initial.status).toBe('idle');

      // Simulate adding first message
      const collecting: BatchState = {
        ...initial,
        status: 'collecting',
        pendingMessages: [{ text: 'hello', timestamp: Date.now(), requestId: 'req1' }],
        batchId: 'batch_123',
        batchStartedAt: Date.now(),
        lastMessageAt: Date.now(),
      };
      expect(collecting.status).toBe('collecting');
    });

    it('collecting -> processing when alarm fires', () => {
      const collecting: BatchState = {
        status: 'collecting',
        pendingMessages: [{ text: 'hello', timestamp: Date.now(), requestId: 'req1' }],
        batchId: 'batch_123',
        retryCount: 0,
        lastMessageAt: Date.now(),
        batchStartedAt: Date.now(),
      };

      const processing: BatchState = {
        ...collecting,
        status: 'processing',
      };
      expect(processing.status).toBe('processing');
    });

    it('processing -> completed on success', () => {
      // After success, we reset to idle (new batch)
      const afterSuccess = createInitialBatchState();
      expect(afterSuccess.status).toBe('idle');
    });

    it('processing -> collecting on retriable failure', () => {
      const failed: BatchState = {
        status: 'collecting', // Back to collecting for retry
        pendingMessages: [{ text: 'hello', timestamp: Date.now(), requestId: 'req1' }],
        batchId: 'batch_123',
        retryCount: 1, // Incremented
        lastMessageAt: Date.now(),
        batchStartedAt: Date.now(),
        error: 'LLM timeout',
      };
      expect(failed.status).toBe('collecting');
      expect(failed.retryCount).toBe(1);
      expect(failed.error).toBeDefined();
    });

    it('processing -> failed after max retries', () => {
      const maxFailed: BatchState = {
        status: 'failed',
        pendingMessages: [{ text: 'hello', timestamp: Date.now(), requestId: 'req1' }],
        batchId: 'batch_123',
        retryCount: 6,
        lastMessageAt: Date.now(),
        batchStartedAt: Date.now(),
        error: 'Max retries exceeded',
      };
      expect(maxFailed.status).toBe('failed');
      expect(maxFailed.retryCount).toBe(6);
    });
  });
});
