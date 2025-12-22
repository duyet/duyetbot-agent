import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../../types.js';
import {
  type DurableChatLoopConfig,
  formatExecutionProgress,
  runChatIteration,
} from '../durable-chat-loop.js';
import type { ChatLoopExecution } from '../types.js';

describe('DurableChatLoop', () => {
  // ... existing tests ...

  it('should format execution progress correctly', () => {
    const execution = createExecution({
      executionSteps: [
        { type: 'thinking', iteration: 0, thinking: 'Thinking...\nmultiline', timestamp: 0 },
        {
          type: 'tool_start',
          iteration: 0,
          toolName: 'test_tool',
          args: { foo: 'bar' },
          timestamp: 0,
        },
        {
          type: 'tool_complete',
          iteration: 0,
          toolName: 'test_tool',
          args: { foo: 'bar' },
          result: 'result',
          timestamp: 0,
        },
        {
          type: 'tool_error',
          iteration: 0,
          toolName: 'fail_tool',
          args: {},
          error: 'Error happened',
          timestamp: 0,
        },
      ],
    });

    const output = formatExecutionProgress(execution);
    const lines = output.split('\n');

    expect(lines).toContain('⏺ Thinking... multiline');
    expect(lines).toContain('⏺ test_tool(foo: "bar")');
    expect(lines).toContain('  ⎿ result');
    expect(lines).toContain('⏺ fail_tool()');
    expect(lines).toContain('  ⎿ ❌ Error happened...');
  });

  it('should show running state for last step', () => {
    const execution = createExecution({
      executionSteps: [
        { type: 'tool_start', iteration: 0, toolName: 'running_tool', args: {}, timestamp: 0 },
      ],
      done: false,
    });

    const output = formatExecutionProgress(execution);
    expect(output).toContain('* running_tool()');
    expect(output).toContain('  ⎿ Running…');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createExecution = (overrides: Partial<ChatLoopExecution> = {}): ChatLoopExecution => ({
    executionId: 'exec1',
    iteration: 0,
    maxIterations: 5,
    startedAt: Date.now(),
    userMessage: 'hello',
    systemPrompt: 'system prompt',
    conversationHistory: [],
    iterationMessages: [],
    messageRef: 1,
    platform: 'telegram',
    tokenUsage: { input: 0, output: 0 },
    toolsUsed: [],
    executionSteps: [],
    transportMetadata: {},
    done: false,
    ...overrides,
  });

  it('should run single iteration successfully', async () => {
    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: 'Response',
        usage: { inputTokens: 10, outputTokens: 5 },
      }),
    };

    const config: DurableChatLoopConfig = {
      llmProvider: mockProvider,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map(),
        mcpCallTool: vi.fn(),
      },
    };

    const execution = createExecution();
    const result = await runChatIteration(execution, config);

    expect(result.done).toBe(true);
    expect(result.response).toBe('Response');
    expect(execution.tokenUsage.input).toBe(10);
    expect(execution.tokenUsage.output).toBe(5);
  });

  it('should execute tools in parallel and respect call order for results', async () => {
    const callOrder: string[] = [];
    let releaseSlow: (() => void) | undefined;
    const slowBarrier = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });

    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [
          { id: '1', name: 'slow', arguments: '{}' },
          { id: '2', name: 'fast', arguments: '{}' },
        ],
      }),
    };

    const slowTool = vi.fn().mockImplementation(async () => {
      await slowBarrier;
      callOrder.push('slow');
      return { status: 'success', content: 'slow_result' };
    });

    const fastTool = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      callOrder.push('fast');
      // Release the slow tool
      releaseSlow?.();
      return { status: 'success', content: 'fast_result' };
    });

    const config: DurableChatLoopConfig = {
      llmProvider: mockProvider,
      tools: [
        { type: 'function', function: { name: 'slow', description: '', parameters: {} } },
        { type: 'function', function: { name: 'fast', description: '', parameters: {} } },
      ],
      toolExecutor: {
        builtinToolMap: new Map([
          ['slow', { name: 'slow', description: '', inputSchema: {} as any, execute: slowTool }],
          ['fast', { name: 'fast', description: '', inputSchema: {} as any, execute: fastTool }],
        ]),
        mcpCallTool: vi.fn(),
      },
      toolExecutionTimeoutMs: 1000,
    };

    const execution = createExecution();
    const result = await runChatIteration(execution, config);

    expect(result.done).toBe(false);
    expect(result.hasToolCalls).toBe(true);

    expect(callOrder).toEqual(['fast', 'slow']);

    // Check that results are sorted by tool call order (slow first)
    expect(execution.iterationMessages).toHaveLength(3);
    expect(execution.iterationMessages[0]!.role).toBe('assistant');

    // Slow tool call was first in list, so its result must be first
    const msg1 = execution.iterationMessages[1];
    expect(msg1!.role).toBe('tool');
    expect(msg1!.name).toBe('slow');
    expect(msg1!.content).toBe('slow_result');

    const msg2 = execution.iterationMessages[2];
    expect(msg2!.role).toBe('tool');
    expect(msg2!.name).toBe('fast');
    expect(msg2!.content).toBe('fast_result');
  });

  it('should handle tool timeouts', async () => {
    const mockProvider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [{ id: '1', name: 'timeout_tool', arguments: '{}' }],
      }),
    };

    const timeoutTool = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { status: 'success', content: 'should_not_be_reached' };
    });

    const config: DurableChatLoopConfig = {
      llmProvider: mockProvider,
      tools: [
        { type: 'function', function: { name: 'timeout_tool', description: '', parameters: {} } },
      ],
      toolExecutor: {
        builtinToolMap: new Map([
          [
            'timeout_tool',
            { name: 'timeout_tool', description: '', inputSchema: {} as any, execute: timeoutTool },
          ],
        ]),
        mcpCallTool: vi.fn(),
      },
      toolExecutionTimeoutMs: 50,
    };

    const execution = createExecution();
    const result = await runChatIteration(execution, config);

    expect(result.hasToolCalls).toBe(true);
    const toolMsg = execution.iterationMessages.find((m) => m.role === 'tool');
    expect(toolMsg?.content).toContain('timed out');
  });

  it('should support streaming responses', async () => {
    const mockProvider: LLMProvider = {
      chat: vi.fn(),
      streamChat: vi.fn().mockImplementation(async function* () {
        yield { content: 'Thinking...' };
        yield { content: 'Done' };
      }),
    };

    const config: DurableChatLoopConfig = {
      llmProvider: mockProvider,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map(),
        mcpCallTool: vi.fn(),
      },
      onProgress: vi.fn(),
    };

    const execution = createExecution();
    const result = await runChatIteration(execution, config);

    expect(result.done).toBe(true);
    expect(execution.executionSteps).toHaveLength(1);

    const step = execution.executionSteps[0];
    if (step && step.type === 'thinking') {
      expect(step.thinking).toBe('Done');
    } else {
      expect.fail('Expected thinking step');
    }

    expect(config.onProgress).toHaveBeenCalled();
  });
});
