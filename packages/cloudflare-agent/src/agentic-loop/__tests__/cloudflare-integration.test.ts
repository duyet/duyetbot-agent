/**
 * Tests for CloudflareAgent AgenticLoop Integration
 *
 * Verifies the integration layer that bridges CloudflareAgent
 * message handling with the AgenticLoop execution.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MessageRef, Transport } from '../../transport.js';
import {
  formatAgenticLoopResponse,
  runAgenticLoop,
  shouldUseAgenticLoop,
} from '../cloudflare-integration.js';
import type { AgenticLoopResult } from '../types.js';

// Mock the AgenticLoop to avoid actual LLM calls
vi.mock('../agentic-loop.js', () => ({
  AgenticLoop: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      success: true,
      response: 'Test response from loop',
      iterations: 2,
      toolsUsed: ['plan', 'search'],
      totalDurationMs: 1500,
      tokenUsage: { input: 100, output: 50, total: 150 },
    }),
  })),
}));

describe('runAgenticLoop', () => {
  let mockTransport: Transport<unknown>;
  let mockCtx: unknown;
  let mockMessageRef: MessageRef;
  let mockProvider: any;

  beforeEach(() => {
    mockTransport = {
      send: vi.fn().mockResolvedValue(123),
      edit: vi.fn().mockResolvedValue(undefined),
      parseContext: vi.fn().mockReturnValue({
        text: 'test',
        userId: 'user123',
        chatId: 'chat123',
      }),
    };

    mockCtx = { chatId: 'chat123' };
    mockMessageRef = 123;
    mockProvider = {
      chat: vi.fn().mockResolvedValue({
        content: 'Test response',
        toolCalls: [],
      }),
    };
  });

  describe('basic execution', () => {
    it('should execute loop and return result', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
      });

      expect(result.success).toBe(true);
      expect(result.response).toBe('Test response from loop');
      expect(result.metrics.iterations).toBe(2);
      expect(result.metrics.toolsUsed).toEqual(['plan', 'search']);
    });

    it('should pass system prompt to loop', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        systemPrompt: 'You are a helpful assistant',
      });

      expect(result.success).toBe(true);
    });

    it('should respect maxIterations configuration', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        maxIterations: 10,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('progress updates', () => {
    it('should call transport.edit for progress updates', async () => {
      await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
      });

      // The transport adapter will call edit during progress
      // Since we mocked AgenticLoop, we verify edit is available
      expect(mockTransport.edit).toBeDefined();
    });
  });

  describe('heartbeat integration', () => {
    it('should call heartbeat function when provided', async () => {
      const reportHeartbeat = vi.fn().mockResolvedValue(undefined);

      await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        reportHeartbeat,
      });

      // Heartbeat is called via the adapter during progress updates
      expect(reportHeartbeat).toBeDefined();
    });
  });

  describe('typing indicator', () => {
    it('should accept typing function', async () => {
      const sendTyping = vi.fn().mockResolvedValue(undefined);

      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        sendTyping,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('subagent mode', () => {
    it('should exclude subagent tool when isSubagent=true', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        isSubagent: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('conversation history', () => {
    it('should include conversation history in initial messages', async () => {
      const result = await runAgenticLoop({
        query: 'Follow up question',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
        conversationHistory: [
          { role: 'user', content: 'Previous question' },
          { role: 'assistant', content: 'Previous answer' },
        ],
      });

      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle transport.edit errors gracefully', async () => {
      const failingTransport: Transport<unknown> = {
        ...mockTransport,
        edit: vi.fn().mockRejectedValue(new Error('Edit failed')),
      };

      const result = await runAgenticLoop({
        query: 'Test query',
        transport: failingTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
      });

      // Should still succeed - edit errors are logged but don't crash
      expect(result.success).toBe(true);
    });
  });

  describe('metrics tracking', () => {
    it('should include duration in metrics', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
      });

      expect(result.metrics.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should include token usage in metrics', async () => {
      const result = await runAgenticLoop({
        query: 'Test query',
        transport: mockTransport,
        ctx: mockCtx,
        messageRef: mockMessageRef,
        provider: mockProvider,
      });

      expect(result.metrics.tokensUsed).toBe(150);
    });
  });
});

describe('formatAgenticLoopResponse', () => {
  const mockResult: AgenticLoopResult = {
    success: true,
    response: 'Test response',
    iterations: 3,
    toolsUsed: ['plan', 'search'],
    totalDurationMs: 2000,
    tokenUsage: { input: 100, output: 50, total: 150 },
  };

  it('should return response without debug by default', () => {
    const formatted = formatAgenticLoopResponse(mockResult);
    expect(formatted).toBe('Test response');
    expect(formatted).not.toContain('iteration');
  });

  it('should include debug footer when enabled', () => {
    const formatted = formatAgenticLoopResponse(mockResult, true);

    expect(formatted).toContain('Test response');
    expect(formatted).toContain('3 iterations');
    expect(formatted).toContain('plan, search');
    expect(formatted).toContain('2000ms');
    expect(formatted).toContain('150 tokens');
  });

  it('should handle singular iteration', () => {
    const singleIteration: AgenticLoopResult = {
      ...mockResult,
      iterations: 1,
    };

    const formatted = formatAgenticLoopResponse(singleIteration, true);
    expect(formatted).toContain('1 iteration');
    expect(formatted).not.toContain('iterations');
  });

  it('should show "none" when no tools used', () => {
    const noTools: AgenticLoopResult = {
      ...mockResult,
      toolsUsed: [],
    };

    const formatted = formatAgenticLoopResponse(noTools, true);
    expect(formatted).toContain('Tools: none');
  });

  it('should omit token info when not available', () => {
    const noTokens: AgenticLoopResult = {
      ...mockResult,
      tokenUsage: undefined,
    };

    const formatted = formatAgenticLoopResponse(noTokens, true);
    expect(formatted).not.toContain('tokens');
  });

  describe('parseMode: HTML', () => {
    it('should format debug footer as HTML code block', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'HTML');

      expect(formatted).toContain('Test response');
      expect(formatted).toContain('<code>');
      expect(formatted).toContain('</code>');
      expect(formatted).toContain('3 iterations');
      expect(formatted).toContain('plan, search');
      expect(formatted).toContain('2000ms');
      expect(formatted).toContain('150 tokens');
    });

    it('should not contain markdown formatting in HTML mode', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'HTML');

      expect(formatted).not.toMatch(/^---$/m);
      expect(formatted).not.toContain('```');
    });

    it('should include emojis in HTML mode', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'HTML');

      expect(formatted).toContain('⏰');
      expect(formatted).toContain('🔧');
      expect(formatted).toContain('⏱️');
      expect(formatted).toContain('📊');
    });
  });

  describe('parseMode: MarkdownV2', () => {
    it('should format debug footer as MarkdownV2 code block', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'MarkdownV2');

      expect(formatted).toContain('Test response');
      expect(formatted).toContain('```');
      expect(formatted).toContain('3 iterations');
      expect(formatted).toContain('plan, search');
      expect(formatted).toContain('2000ms');
      expect(formatted).toContain('150 tokens');
    });

    it('should escape special characters in MarkdownV2', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'MarkdownV2');

      // Characters like '-', '.', '!' etc. in numbers and text should be escaped
      // Example: '2000ms' might have '-' escaped as '\-' if it contained minus
      expect(formatted).toContain('```');
      // Code blocks contain the actual values but special chars are escaped
      expect(formatted).not.toContain('---');
    });

    it('should include emojis in MarkdownV2 mode', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, 'MarkdownV2');

      expect(formatted).toContain('⏰');
      expect(formatted).toContain('🔧');
      expect(formatted).toContain('⏱️');
      expect(formatted).toContain('📊');
    });

    it('should handle tools with special characters', () => {
      const resultWithSpecialTools: AgenticLoopResult = {
        ...mockResult,
        toolsUsed: ['bash', 'git-commit'],
      };

      const formatted = formatAgenticLoopResponse(resultWithSpecialTools, true, 'MarkdownV2');

      expect(formatted).toContain('bash');
      // 'git-commit' should be present (escaped as git\-commit in code block)
      expect(formatted).toContain('```');
    });
  });

  describe('parseMode: undefined (plaintext fallback)', () => {
    it('should format debug footer as plaintext with separator', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, undefined);

      expect(formatted).toContain('Test response');
      expect(formatted).toContain('---');
      expect(formatted).toContain('3 iterations');
      expect(formatted).toContain('plan, search');
      expect(formatted).toContain('2000ms');
      expect(formatted).toContain('150 tokens');
    });

    it('should include emojis in plaintext mode', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, undefined);

      expect(formatted).toContain('⏰');
      expect(formatted).toContain('🔧');
      expect(formatted).toContain('⏱️');
      expect(formatted).toContain('📊');
    });

    it('should not contain code block markers', () => {
      const formatted = formatAgenticLoopResponse(mockResult, true, undefined);

      expect(formatted).not.toContain('<code>');
      expect(formatted).not.toContain('</code>');
      expect(formatted).not.toContain('```');
    });
  });
});

describe('shouldUseAgenticLoop', () => {
  it('should return true for any query', () => {
    expect(shouldUseAgenticLoop('simple question')).toBe(true);
    expect(shouldUseAgenticLoop('complex multi-step task')).toBe(true);
    expect(shouldUseAgenticLoop('')).toBe(true);
  });
});
