import { describe, expect, it, vi } from 'vitest';
import type { LLMProvider, Message } from '../../types.js';
import { StepProgressTracker } from '../../workflow/step-tracker.js';
import { ChatLoop, type ChatLoopConfig } from '../chat-loop.js';

describe('ChatLoop', () => {
  it('should execute simple chat without tools', async () => {
    const mockProvider: LLMProvider = {
      async chat() {
        return {
          content: 'Hello! How can I help?',
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
          model: 'test-model',
        };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 5,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map(),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('Hi', []);

    expect(result.content).toBe('Hello! How can I help?');
    expect(result.newMessages).toHaveLength(2);
    expect(result.newMessages[0]?.role).toBe('user');
    expect(result.newMessages[0]?.content).toBe('Hi');
    expect(result.newMessages[1]?.role).toBe('assistant');
    expect(result.newMessages[1]?.content).toBe('Hello! How can I help?');
    expect(result.tokenUsage.input).toBe(10);
    expect(result.tokenUsage.output).toBe(5);
    expect(result.tokenUsage.total).toBe(15);
    expect(result.model).toBe('test-model');
  });

  it('should execute chat with tool call', async () => {
    let callCount = 0;
    const mockProvider: LLMProvider = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          // First call - return tool call
          return {
            content: '',
            toolCalls: [
              {
                id: '1',
                name: 'test_tool',
                arguments: JSON.stringify({ arg: 'value' }),
              },
            ],
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
            },
          };
        }
        // Second call - return final response
        return {
          content: 'Tool result processed',
          usage: {
            inputTokens: 20,
            outputTokens: 10,
            totalTokens: 30,
          },
        };
      },
    };

    const mockTool = {
      name: 'test_tool',
      description: 'Test',
      inputSchema: {} as any,
      async execute() {
        return {
          status: 'success' as const,
          content: 'Tool executed',
        };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 5,
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'test_tool',
            description: 'Test',
            parameters: {},
          },
        },
      ],
      toolExecutor: {
        builtinToolMap: new Map([['test_tool', mockTool]]),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('Use tool', []);

    expect(result.content).toBe('Tool result processed');
    expect(result.tokenUsage.input).toBe(30); // 10 + 20
    expect(result.tokenUsage.output).toBe(15); // 5 + 10
    expect(result.tokenUsage.total).toBe(45); // 15 + 30
  });

  it('should respect maxToolIterations limit', async () => {
    const mockProvider: LLMProvider = {
      async chat() {
        // Always return tool call
        return {
          content: '',
          toolCalls: [
            {
              id: '1',
              name: 'test_tool',
              arguments: JSON.stringify({}),
            },
          ],
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        };
      },
    };

    const mockTool = {
      name: 'test_tool',
      description: 'Test',
      inputSchema: {} as any,
      async execute() {
        return {
          status: 'success' as const,
          content: 'OK',
        };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 2, // Only allow 2 iterations
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'test_tool',
            description: 'Test',
            parameters: {},
          },
        },
      ],
      toolExecutor: {
        builtinToolMap: new Map([['test_tool', mockTool]]),
        mcpCallTool: vi.fn(),
      },
    };

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('Loop forever', []);

    // Should stop after maxToolIterations (2) and return last response
    expect(result.content).toBe('');
    // 3 LLM calls: initial + 2 iterations
    expect(result.tokenUsage.total).toBe(45); // 15 * 3
  });

  it('should include conversation history in context', async () => {
    const mockProvider: LLMProvider = {
      async chat(messages) {
        // Verify history is embedded
        expect(messages[1]?.content).toContain('<conversation_history>');
        expect(messages[1]?.content).toContain('Previous question');
        return {
          content: 'Response with context',
        };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 5,
      tools: [],
      toolExecutor: {
        builtinToolMap: new Map(),
        mcpCallTool: vi.fn(),
      },
    };

    const history: Message[] = [
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ];

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('Current question', history);

    expect(result.content).toBe('Response with context');
  });

  it('should emit thinking text to step tracker when LLM has content before tool calls', async () => {
    let callCount = 0;
    const mockProvider: LLMProvider = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          // First call - return thinking + tool call
          return {
            content: "I'll search for that information using the search tool.",
            toolCalls: [
              {
                id: '1',
                name: 'search',
                arguments: JSON.stringify({ query: 'test' }),
              },
            ],
            usage: {
              inputTokens: 10,
              outputTokens: 15,
              totalTokens: 25,
            },
            model: 'test-model',
          };
        }
        // Second call - return final response
        return {
          content: 'Here is the search result summary.',
          usage: {
            inputTokens: 30,
            outputTokens: 20,
            totalTokens: 50,
          },
        };
      },
    };

    const mockTool = {
      name: 'search',
      description: 'Search',
      inputSchema: {} as any,
      async execute() {
        return {
          status: 'success' as const,
          content: 'Search results: Item 1, Item 2',
        };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 5,
      tools: [
        {
          type: 'function' as const,
          function: {
            name: 'search',
            description: 'Search',
            parameters: {},
          },
        },
      ],
      toolExecutor: {
        builtinToolMap: new Map([['search', mockTool]]),
        mcpCallTool: vi.fn(),
      },
    };

    // Create step tracker to capture steps
    const steps: Array<{ type: string; thinking?: string; toolName?: string }> = [];
    const stepTracker = new StepProgressTracker(
      async () => {}, // No-op update callback
      {} // No config
    );
    // Override addStep to capture steps
    const originalAddStep = stepTracker.addStep.bind(stepTracker);
    stepTracker.addStep = async (step) => {
      steps.push({ type: step.type, thinking: step.thinking, toolName: step.toolName });
      return originalAddStep(step);
    };

    const chatLoop = new ChatLoop(config);
    const result = await chatLoop.execute('Search for something', [], stepTracker);

    expect(result.content).toBe('Here is the search result summary.');

    // Verify thinking text was captured
    const thinkingSteps = steps.filter((s) => s.type === 'thinking' && s.thinking);
    expect(thinkingSteps.length).toBeGreaterThan(0);
    expect(thinkingSteps[0]?.thinking).toBe(
      "I'll search for that information using the search tool."
    );

    // Verify tool steps were captured
    const toolSteps = steps.filter((s) => s.type === 'tool_start' || s.type === 'tool_complete');
    expect(toolSteps.some((s) => s.toolName === 'search')).toBe(true);
  });

  it('should emit thinking text during multi-turn tool iterations', async () => {
    let callCount = 0;
    const mockProvider: LLMProvider = {
      async chat() {
        callCount++;
        if (callCount === 1) {
          // First call - thinking + tool call
          return {
            content: 'Let me search first.',
            toolCalls: [
              {
                id: '1',
                name: 'search',
                arguments: JSON.stringify({ query: 'first' }),
              },
            ],
            usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          };
        }
        if (callCount === 2) {
          // Second call - more thinking + another tool call
          return {
            content: 'Found results. Now let me analyze them.',
            toolCalls: [
              {
                id: '2',
                name: 'analyze',
                arguments: JSON.stringify({ data: 'results' }),
              },
            ],
            usage: { inputTokens: 20, outputTokens: 15, totalTokens: 35 },
          };
        }
        // Final response
        return {
          content: 'Analysis complete.',
          usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 },
        };
      },
    };

    const searchTool = {
      name: 'search',
      description: 'Search',
      inputSchema: {} as any,
      async execute() {
        return { status: 'success' as const, content: 'Results' };
      },
    };
    const analyzeTool = {
      name: 'analyze',
      description: 'Analyze',
      inputSchema: {} as any,
      async execute() {
        return { status: 'success' as const, content: 'Analysis' };
      },
    };

    const config: ChatLoopConfig = {
      llmProvider: mockProvider,
      systemPrompt: 'You are helpful',
      maxToolIterations: 5,
      tools: [
        {
          type: 'function' as const,
          function: { name: 'search', description: 'Search', parameters: {} },
        },
        {
          type: 'function' as const,
          function: { name: 'analyze', description: 'Analyze', parameters: {} },
        },
      ],
      toolExecutor: {
        builtinToolMap: new Map([
          ['search', searchTool],
          ['analyze', analyzeTool],
        ]),
        mcpCallTool: vi.fn(),
      },
    };

    const steps: Array<{ type: string; thinking?: string; toolName?: string; iteration?: number }> =
      [];
    const stepTracker = new StepProgressTracker(async () => {}, {});
    const originalAddStep = stepTracker.addStep.bind(stepTracker);
    stepTracker.addStep = async (step) => {
      steps.push({
        type: step.type,
        thinking: step.thinking,
        toolName: step.toolName,
        iteration: step.iteration,
      });
      return originalAddStep(step);
    };

    const chatLoop = new ChatLoop(config);
    await chatLoop.execute('Do multi-step task', [], stepTracker);

    // Verify all thinking texts were captured (including final response)
    const thinkingSteps = steps.filter((s) => s.type === 'thinking' && s.thinking);
    expect(thinkingSteps.length).toBe(3);
    expect(thinkingSteps[0]?.thinking).toBe('Let me search first.');
    expect(thinkingSteps[1]?.thinking).toBe('Found results. Now let me analyze them.');
    expect(thinkingSteps[2]?.thinking).toBe('Analysis complete.');
  });
});
