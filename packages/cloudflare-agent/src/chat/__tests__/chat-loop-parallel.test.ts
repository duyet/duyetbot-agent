import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider, Message, LLMResponse } from '../../types.js';
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
          ['tool1', { name: 'tool1', description: 't1', inputSchema: {} as any, execute: tool1Exec }],
          ['tool2', { name: 'tool2', description: 't2', inputSchema: {} as any, execute: tool2Exec }],
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
    const thinkingSteps = steps.filter(s => s.type === 'thinking');
    expect(thinkingSteps.length).toBeGreaterThan(0);
  });
});
