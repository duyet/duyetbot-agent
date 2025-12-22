import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider } from '../../types.js';
import { StepProgressTracker } from '../../workflow/step-tracker.js';
import { ChatLoop, type ChatLoopConfig } from '../chat-loop.js';

describe('ChatLoop Parallel & Streaming', () => {
  it('should execute multiple tools in parallel', async () => {
    let callCount = 0;
    const mockProvider: LLMProvider = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          return {
            content: 'Calling tools',
            toolCalls: [
              { id: '1', name: 'tool1', arguments: '{}' },
              { id: '2', name: 'tool2', arguments: '{}' },
            ],
          };
        }
        return { content: 'Done' };
      },
    };

    const tool1Exec = vi.fn().mockResolvedValue({ status: 'success', result: 'res1' });
    const tool2Exec = vi.fn().mockResolvedValue({ status: 'success', result: 'res2' });

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'test',
      maxToolIterations: 5,
      tools: [
        { type: 'function', function: { name: 'tool1', description: 't1', parameters: {} } },
        { type: 'function', function: { name: 'tool2', description: 't2', parameters: {} } },
      ],
      toolExecutor: {
        builtinToolMap: new Map([
          [
            'tool1',
            { name: 'tool1', description: 't1', inputSchema: {} as any, execute: tool1Exec },
          ],
          [
            'tool2',
            { name: 'tool2', description: 't2', inputSchema: {} as any, execute: tool2Exec },
          ],
        ]),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    await chatLoop.execute('test', []);

    expect(tool1Exec).toHaveBeenCalled();
    expect(tool2Exec).toHaveBeenCalled();
    expect(callCount).toBe(2);
  });

  it('should support streaming chat', async () => {
    const mockProvider: LLMProvider = {
      chat: vi.fn(),
      async *streamChat() {
        yield { content: 'Thinking' };
        yield { content: 'Thinking more' };
        yield { content: 'Final response' };
      },
    };

    const steps: any[] = [];
    const stepTracker = new StepProgressTracker(async () => {}, {});
    vi.spyOn(stepTracker, 'addStep').mockImplementation(async (step) => {
      steps.push(step);
    });

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'test',
      maxToolIterations: 5,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map(),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('test', [], stepTracker);

    expect(result.content).toBe('Final response');
    // Should have thinking steps from stream
    const thinkingSteps = steps.filter((s) => s.type === 'thinking');
    expect(thinkingSteps.length).toBeGreaterThan(0);
  });

  it('should maintain tool result order regardless of completion time', async () => {
    // Tool 1 takes longer but is first in list
    // Tool 2 returns immediately but is second
    // Result should be: [Tool 1 Result, Tool 2 Result] because of call order

    let callOrder: string[] = [];

    const mockProvider: LLMProvider = {
      async chat() {
        if (callOrder.length === 0) {
          return {
            content: 'Calling tools',
            toolCalls: [
              { id: '1', name: 'slow_tool', arguments: '{}' },
              { id: '2', name: 'fast_tool', arguments: '{}' },
            ],
          };
        }
        return { content: 'Done' };
      },
    };

    const slowToolExec = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      callOrder.push('slow_tool');
      return { status: 'success', result: 'slow_result' };
    });

    const fastToolExec = vi.fn().mockImplementation(async () => {
      callOrder.push('fast_tool');
      return { status: 'success', result: 'fast_result' };
    });

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'test',
      maxToolIterations: 5,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map([
          [
            'slow_tool',
            { name: 'slow_tool', description: 's', inputSchema: {} as any, execute: slowToolExec },
          ],
          [
            'fast_tool',
            { name: 'fast_tool', description: 'f', inputSchema: {} as any, execute: fastToolExec },
          ],
        ]),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    await chatLoop.execute('test', []);

    // Verify execution/completion order (fast finishes first)
    expect(callOrder).toEqual(['fast_tool', 'slow_tool']);

    // Reset callOrder for the second run
    callOrder = [];

    // Let's spy on mockProvider.chat
    const spy = vi.spyOn(mockProvider, 'chat');

    await chatLoop.execute('test', []);

    // Call 1: Initial (User)
    // Call 2: Tool results (User + Assistant + Tool results)
    expect(spy).toHaveBeenCalledTimes(2);

    const secondCall = spy.mock.calls[1];
    expect(secondCall).toBeDefined();
    const secondCallArgs = secondCall![0];

    // Messages structure likely:
    // 0: System "test"
    // 1: User "test"
    // 2: Assistant "Calling tools" (with tool_calls)
    // 3: Tool 1 Result
    // 4: Tool 2 Result

    const toolMsg1 = secondCallArgs[3];
    const toolMsg2 = secondCallArgs[4];

    expect(toolMsg1).toBeDefined();
    expect(toolMsg2).toBeDefined();

    expect(toolMsg1!.role).toBe('tool');
    expect(toolMsg1!.name).toBe('slow_tool');
    expect(toolMsg2!.role).toBe('tool');
    expect(toolMsg2!.name).toBe('fast_tool');
  });
});
