/**
 * Tests for AgenticLoop
 *
 * Tests the core agentic loop implementation including:
 * - Loop execution with and without tool calls
 * - Progress callback invocation
 * - Max iteration safety limit
 * - Error handling
 * - Tool execution flow
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '../../execution/context.js';
import type { LLMMessage, LLMResponse } from '../../types.js';
import { AgenticLoop, createAgenticLoop } from '../agentic-loop.js';
import type {
  AgenticLoopConfig,
  LoopContext,
  LoopMessage,
  LoopTool,
  ProgressUpdate,
  ToolResult,
} from '../types.js';

// Mock the logger to avoid console noise in tests
vi.mock('@duyetbot/hono-middleware', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Create a mock LLM provider for testing
 */
function createMockProvider(responses: LLMResponse[]) {
  let callIndex = 0;
  return {
    chat: vi.fn(async (_messages: LLMMessage[], _tools?: unknown[]) => {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return response;
    }),
  };
}

/**
 * Create a mock execution context with provider
 */
function createMockContext(provider: ReturnType<typeof createMockProvider>): LoopContext {
  const executionContext: ExecutionContext = {
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    platform: 'telegram',
    userId: '123',
    chatId: '456',
    userMessageId: '789',
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    query: 'test query',
    conversationHistory: [],
    debug: {
      agentChain: [],
      toolCalls: [],
      warnings: [],
      errors: [],
    },
    startedAt: Date.now(),
    deadline: Date.now() + 30000,
  } as ExecutionContext;

  // Attach mock provider to execution context
  (executionContext as any).provider = provider;

  return {
    executionContext,
    iteration: 0,
    toolHistory: [],
    isSubagent: false,
  };
}

/**
 * Create a simple test tool
 */
function createTestTool(
  name: string,
  result: Partial<ToolResult> = { success: true, output: 'tool result' }
): LoopTool {
  return {
    name,
    description: `Test tool: ${name}`,
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Test input' },
      },
    },
    execute: vi.fn(async () => ({
      success: result.success ?? true,
      output: result.output ?? 'tool result',
      durationMs: result.durationMs ?? 10,
      ...(result.error && { error: result.error }),
    })),
  };
}

describe('AgenticLoop', () => {
  describe('simple response (no tool calls)', () => {
    it('should return response when LLM provides no tool calls', async () => {
      const provider = createMockProvider([
        {
          content: 'Hello! How can I help you?',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Hello' }]);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Hello! How can I help you?');
      expect(result.iterations).toBe(0); // No iterations completed (responded on first call)
      expect(result.toolsUsed).toEqual([]);
      expect(provider.chat).toHaveBeenCalledTimes(1);
    });

    it('should track token usage', async () => {
      const provider = createMockProvider([
        {
          content: 'Response',
          usage: { inputTokens: 150, outputTokens: 75 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(result.tokenUsage).toEqual({
        input: 150,
        output: 75,
        total: 225,
      });
    });
  });

  describe('tool execution', () => {
    it('should execute tool and feed result back to LLM', async () => {
      const searchTool = createTestTool('search', { success: true, output: 'Found 5 results' });

      const provider = createMockProvider([
        // First response: call search tool
        {
          content: "I'll search for that.",
          toolCalls: [
            {
              id: 'call_1',
              name: 'search',
              arguments: JSON.stringify({ input: 'test query' }),
            },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        // Second response: final answer
        {
          content: 'Based on my search, I found 5 results.',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [searchTool],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Search for something' }]);

      expect(result.success).toBe(true);
      expect(result.response).toBe('Based on my search, I found 5 results.');
      expect(result.iterations).toBe(1);
      expect(result.toolsUsed).toContain('search');
      expect(searchTool.execute).toHaveBeenCalledWith({ input: 'test query' }, expect.any(Object));
      expect(provider.chat).toHaveBeenCalledTimes(2);
    });

    it('should execute multiple tools in parallel', async () => {
      const searchTool = createTestTool('search', { success: true, output: 'Search results' });
      const fetchTool = createTestTool('fetch', { success: true, output: 'Fetched data' });

      const provider = createMockProvider([
        // First response: call both tools
        {
          content: "I'll search and fetch.",
          toolCalls: [
            { id: 'call_1', name: 'search', arguments: '{}' },
            { id: 'call_2', name: 'fetch', arguments: '{}' },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        // Second response: final answer
        {
          content: 'Done with both.',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [searchTool, fetchTool],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Do both' }]);

      expect(result.success).toBe(true);
      expect(result.toolsUsed).toContain('search');
      expect(result.toolsUsed).toContain('fetch');
      expect(searchTool.execute).toHaveBeenCalled();
      expect(fetchTool.execute).toHaveBeenCalled();
    });

    it('should handle tool not found gracefully', async () => {
      const provider = createMockProvider([
        {
          content: "I'll use a non-existent tool.",
          toolCalls: [{ id: 'call_1', name: 'nonexistent', arguments: '{}' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'The tool was not found, but I can continue.',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      // Loop should continue even with tool not found
      expect(result.success).toBe(true);
      expect(provider.chat).toHaveBeenCalledTimes(2);
    });

    it('should handle tool execution errors gracefully', async () => {
      const errorTool: LoopTool = {
        name: 'error_tool',
        description: 'A tool that throws',
        parameters: { type: 'object' },
        execute: vi.fn(async () => {
          throw new Error('Tool explosion');
        }),
      };

      const provider = createMockProvider([
        {
          content: "I'll try this tool.",
          toolCalls: [{ id: 'call_1', name: 'error_tool', arguments: '{}' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'The tool failed, but I handled it.',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [errorTool],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      // Loop should continue despite tool error
      expect(result.success).toBe(true);
      expect(provider.chat).toHaveBeenCalledTimes(2);
    });
  });

  describe('max iterations limit', () => {
    it('should stop at max iterations', async () => {
      const infiniteTool = createTestTool('infinite', { success: true, output: 'Keep going' });

      // Provider always returns a tool call
      const provider = createMockProvider([
        {
          content: 'Calling tool...',
          toolCalls: [{ id: 'call_1', name: 'infinite', arguments: '{}' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 3,
        tools: [infiniteTool],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Loop forever' }]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum iterations exceeded');
      expect(result.iterations).toBe(3);
      expect(provider.chat).toHaveBeenCalledTimes(3);
    });
  });

  describe('progress callbacks', () => {
    it('should call onProgress for thinking', async () => {
      const onProgress = vi.fn();

      const provider = createMockProvider([
        {
          content: 'Simple response',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
        onProgress,
      });

      await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          iteration: 0,
        })
      );
    });

    it('should call onProgress for tool execution', async () => {
      const onProgress = vi.fn();
      const testTool = createTestTool('test');

      const provider = createMockProvider([
        {
          content: 'Using tool',
          toolCalls: [{ id: 'call_1', name: 'test', arguments: '{}' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Done',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [testTool],
        onProgress,
      });

      await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      // Should have thinking and tool progress updates
      const progressTypes = onProgress.mock.calls.map((call) => call[0].type);
      expect(progressTypes).toContain('thinking');
      expect(progressTypes).toContain('tool_start');
      expect(progressTypes).toContain('tool_complete');
    });

    it('should call onToolStart and onToolEnd callbacks', async () => {
      const onToolStart = vi.fn();
      const onToolEnd = vi.fn();
      const testTool = createTestTool('test');

      const provider = createMockProvider([
        {
          content: 'Using tool',
          toolCalls: [
            { id: 'call_1', name: 'test', arguments: JSON.stringify({ input: 'hello' }) },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Done',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [testTool],
        onToolStart,
        onToolEnd,
      });

      await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(onToolStart).toHaveBeenCalledWith('test', { input: 'hello' });
      expect(onToolEnd).toHaveBeenCalledWith('test', expect.objectContaining({ success: true }));
    });

    it('should not crash on progress callback error', async () => {
      const onProgress = vi.fn().mockRejectedValue(new Error('Callback error'));

      const provider = createMockProvider([
        {
          content: 'Simple response',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
        onProgress,
      });

      // Should not throw despite callback error
      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);
      expect(result.success).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle LLM provider errors', async () => {
      const provider = {
        chat: vi.fn().mockRejectedValue(new Error('API error')),
      };

      const ctx = createMockContext(provider as any);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });

    it('should handle missing provider', async () => {
      const ctx: LoopContext = {
        executionContext: {} as ExecutionContext,
        iteration: 0,
        toolHistory: [],
        isSubagent: false,
      };

      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('provider');
    });
  });

  describe('message history', () => {
    it('should build conversation history correctly', async () => {
      const provider = createMockProvider([
        {
          content: 'Response to user',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
        systemPrompt: 'You are a helpful assistant.',
      });

      await loop.run(ctx, [{ role: 'user', content: 'Hello' }]);

      // Check that provider was called with system prompt
      expect(provider.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system', content: 'You are a helpful assistant.' }),
          expect.objectContaining({ role: 'user', content: 'Hello' }),
        ]),
        expect.any(Array)
      );
    });

    it('should expose message history via getMessages', async () => {
      const provider = createMockProvider([
        {
          content: 'Using tool',
          toolCalls: [{ id: 'call_1', name: 'test', arguments: '{}' }],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Final response',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const testTool = createTestTool('test');
      const ctx = createMockContext(provider);
      const loop = new AgenticLoop({
        maxIterations: 10,
        tools: [testTool],
      });

      await loop.run(ctx, [{ role: 'user', content: 'Do something' }]);

      const messages = loop.getMessages();
      expect(messages.length).toBeGreaterThan(1);
      expect(messages[0]).toEqual({ role: 'user', content: 'Do something' });
    });

    it('should expose tools invoked via getToolsInvoked', async () => {
      const provider = createMockProvider([
        {
          content: 'Using tools',
          toolCalls: [
            { id: 'call_1', name: 'tool1', arguments: '{}' },
            { id: 'call_2', name: 'tool2', arguments: '{}' },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Done',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const tool1 = createTestTool('tool1');
      const tool2 = createTestTool('tool2');
      const ctx = createMockContext(provider);
      const loop = new AgenticLoop({
        maxIterations: 10,
        tools: [tool1, tool2],
      });

      await loop.run(ctx, [{ role: 'user', content: 'Use both tools' }]);

      const toolsInvoked = loop.getToolsInvoked();
      expect(toolsInvoked.has('tool1')).toBe(true);
      expect(toolsInvoked.has('tool2')).toBe(true);
    });
  });

  describe('JSON argument parsing', () => {
    it('should parse JSON arguments correctly', async () => {
      const testTool = createTestTool('test');

      const provider = createMockProvider([
        {
          content: 'Using tool',
          toolCalls: [
            {
              id: 'call_1',
              name: 'test',
              arguments: JSON.stringify({ input: 'hello', count: 5 }),
            },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Done',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [testTool],
      });

      await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(testTool.execute).toHaveBeenCalledWith(
        { input: 'hello', count: 5 },
        expect.any(Object)
      );
    });

    it('should handle invalid JSON arguments gracefully', async () => {
      const testTool = createTestTool('test');

      const provider = createMockProvider([
        {
          content: 'Using tool',
          toolCalls: [
            {
              id: 'call_1',
              name: 'test',
              arguments: 'not valid json {{{',
            },
          ],
          usage: { inputTokens: 100, outputTokens: 50 },
        },
        {
          content: 'Done',
          usage: { inputTokens: 200, outputTokens: 100 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [testTool],
      });

      // Should not crash on invalid JSON
      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);
      expect(result.success).toBe(true);
      // Tool should be called with empty object fallback
      expect(testTool.execute).toHaveBeenCalledWith({}, expect.any(Object));
    });
  });

  describe('duration tracking', () => {
    it('should track total duration', async () => {
      const provider = createMockProvider([
        {
          content: 'Response',
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      ]);

      const ctx = createMockContext(provider);
      const loop = createAgenticLoop({
        maxIterations: 10,
        tools: [],
      });

      const result = await loop.run(ctx, [{ role: 'user', content: 'Query' }]);

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createAgenticLoop factory', () => {
    it('should create a configured loop instance', () => {
      const loop = createAgenticLoop({
        maxIterations: 5,
        tools: [],
        systemPrompt: 'Test prompt',
      });

      expect(loop).toBeInstanceOf(AgenticLoop);
    });
  });
});
