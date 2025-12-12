/**
 * Tests for Workflow Type Definitions and Helper Functions
 *
 * Tests the serialization helpers, type guards, and type structures
 * for the workflow-based agentic loop.
 */

import { describe, expect, it } from 'vitest';
import type { LoopTool } from '../../types.js';
import type {
  AgenticLoopWorkflowParams,
  JsonRecord,
  ProgressCallbackConfig,
  SerializedTool,
  WorkflowCompletionResult,
  WorkflowDebugContext,
  WorkflowProgressUpdate,
} from '../types.js';
import { isAssistantMessage, isToolResultMessage, serializeTools } from '../types.js';

describe('serializeTools', () => {
  it('should strip execute functions from tools', () => {
    const tools: LoopTool[] = [
      {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
        execute: async () => ({ success: true, output: 'result' }),
      },
    ];

    const serialized = serializeTools(tools);

    expect(serialized).toHaveLength(1);
    expect(serialized[0].name).toBe('test_tool');
    expect(serialized[0].description).toBe('A test tool');
    expect(serialized[0].parameters).toEqual({
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
      required: ['input'],
    });
    // Execute function should not be present
    expect(serialized[0]).not.toHaveProperty('execute');
  });

  it('should handle empty tool array', () => {
    const serialized = serializeTools([]);
    expect(serialized).toEqual([]);
  });

  it('should handle multiple tools', () => {
    const tools: LoopTool[] = [
      {
        name: 'tool1',
        description: 'First tool',
        parameters: { type: 'object' },
        execute: async () => ({ success: true, output: '' }),
      },
      {
        name: 'tool2',
        description: 'Second tool',
        parameters: { type: 'object', properties: { x: { type: 'number' } } },
        execute: async () => ({ success: false, output: '', error: 'failed' }),
      },
    ];

    const serialized = serializeTools(tools);

    expect(serialized).toHaveLength(2);
    expect(serialized[0].name).toBe('tool1');
    expect(serialized[1].name).toBe('tool2');
  });
});

describe('isToolResultMessage', () => {
  it('should return true for tool_result messages', () => {
    const msg = { role: 'tool_result' as const, content: 'result', toolCallId: 'tc_123' };
    expect(isToolResultMessage(msg)).toBe(true);
  });

  it('should return false for user messages', () => {
    const msg = { role: 'user' as const, content: 'hello' };
    expect(isToolResultMessage(msg)).toBe(false);
  });

  it('should return false for assistant messages', () => {
    const msg = { role: 'assistant' as const, content: 'response' };
    expect(isToolResultMessage(msg)).toBe(false);
  });
});

describe('isAssistantMessage', () => {
  it('should return true for assistant messages', () => {
    const msg = { role: 'assistant' as const, content: 'response' };
    expect(isAssistantMessage(msg)).toBe(true);
  });

  it('should return false for user messages', () => {
    const msg = { role: 'user' as const, content: 'hello' };
    expect(isAssistantMessage(msg)).toBe(false);
  });

  it('should return false for tool_result messages', () => {
    const msg = { role: 'tool_result' as const, content: 'result', toolCallId: 'tc_123' };
    expect(isAssistantMessage(msg)).toBe(false);
  });
});

describe('Type Structures', () => {
  describe('AgenticLoopWorkflowParams', () => {
    it('should accept valid params structure', () => {
      const params: AgenticLoopWorkflowParams = {
        executionId: 'exec_123',
        query: 'What is the weather?',
        conversationHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        maxIterations: 50,
        tools: [
          {
            name: 'search',
            description: 'Search the web',
            parameters: { type: 'object' },
          },
        ],
        progressCallback: {
          doNamespace: 'CloudflareAgent',
          doId: 'agent_123',
          executionId: 'exec_123',
        },
        platform: 'telegram',
        chatId: 'chat_456',
        messageId: 789,
      };

      expect(params.executionId).toBe('exec_123');
      expect(params.platform).toBe('telegram');
    });

    it('should support optional fields', () => {
      const params: AgenticLoopWorkflowParams = {
        executionId: 'exec_123',
        query: 'Test',
        conversationHistory: [],
        maxIterations: 10,
        tools: [],
        progressCallback: {
          doNamespace: 'CloudflareAgent',
          doId: 'test',
          executionId: 'exec_123',
        },
        platform: 'github',
        chatId: 'issue_1',
        messageId: 1,
        systemPrompt: 'You are a helpful assistant.',
        isSubagent: true,
        parentWorkflowId: 'parent_workflow',
        traceId: 'trace_abc',
      };

      expect(params.systemPrompt).toBe('You are a helpful assistant.');
      expect(params.isSubagent).toBe(true);
      expect(params.parentWorkflowId).toBe('parent_workflow');
      expect(params.traceId).toBe('trace_abc');
    });
  });

  describe('WorkflowProgressUpdate', () => {
    it('should accept thinking progress', () => {
      const progress: WorkflowProgressUpdate = {
        type: 'thinking',
        iteration: 0,
        message: '🤔 Thinking...',
        timestamp: Date.now(),
      };

      expect(progress.type).toBe('thinking');
      expect(progress.iteration).toBe(0);
    });

    it('should accept tool_start progress with toolName', () => {
      const progress: WorkflowProgressUpdate = {
        type: 'tool_start',
        iteration: 1,
        message: '🔧 Running search...',
        toolName: 'search',
        timestamp: Date.now(),
      };

      expect(progress.type).toBe('tool_start');
      expect(progress.toolName).toBe('search');
    });

    it('should accept tool_complete progress with duration', () => {
      const progress: WorkflowProgressUpdate = {
        type: 'tool_complete',
        iteration: 1,
        message: '✅ search completed (150ms)',
        toolName: 'search',
        durationMs: 150,
        timestamp: Date.now(),
      };

      expect(progress.type).toBe('tool_complete');
      expect(progress.durationMs).toBe(150);
    });
  });

  describe('WorkflowCompletionResult', () => {
    it('should accept successful completion', () => {
      const result: WorkflowCompletionResult = {
        success: true,
        response: 'Here is the answer!',
        iterations: 3,
        toolsUsed: ['search', 'github'],
        totalDurationMs: 5000,
        tokenUsage: {
          input: 1000,
          output: 500,
          total: 1500,
        },
      };

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(3);
      expect(result.toolsUsed).toContain('search');
    });

    it('should accept failed completion with error', () => {
      const result: WorkflowCompletionResult = {
        success: false,
        response: 'Maximum iterations reached',
        iterations: 50,
        toolsUsed: ['search'],
        totalDurationMs: 60000,
        error: 'Max iterations exceeded',
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max iterations exceeded');
    });

    it('should include debug context when available', () => {
      const debugContext: WorkflowDebugContext = {
        steps: [
          { iteration: 0, type: 'thinking', thinking: 'Analyzing query...' },
          {
            iteration: 0,
            type: 'tool_execution',
            toolName: 'search',
            args: { query: 'test' } as JsonRecord,
            result: { success: true, output: 'results', durationMs: 100 },
          },
        ],
      };

      const result: WorkflowCompletionResult = {
        success: true,
        response: 'Done!',
        iterations: 1,
        toolsUsed: ['search'],
        totalDurationMs: 1000,
        debugContext,
      };

      expect(result.debugContext?.steps).toHaveLength(2);
      expect(result.debugContext?.steps[1].toolName).toBe('search');
    });
  });

  describe('SerializedTool', () => {
    it('should have required fields', () => {
      const tool: SerializedTool = {
        name: 'my_tool',
        description: 'A useful tool',
        parameters: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'The input' },
          },
          required: ['input'],
        },
      };

      expect(tool.name).toBe('my_tool');
      expect(tool.description).toBe('A useful tool');
      expect(tool.parameters.type).toBe('object');
    });
  });

  describe('ProgressCallbackConfig', () => {
    it('should contain DO reference information', () => {
      const config: ProgressCallbackConfig = {
        doNamespace: 'CloudflareAgent',
        doId: 'chat_123:user_456',
        executionId: 'exec_789',
      };

      expect(config.doNamespace).toBe('CloudflareAgent');
      expect(config.doId).toBe('chat_123:user_456');
      expect(config.executionId).toBe('exec_789');
    });
  });
});

describe('JsonRecord', () => {
  it('should allow primitive values', () => {
    const record: JsonRecord = {
      string: 'hello',
      number: 42,
      boolean: true,
      null: null,
    };

    expect(record.string).toBe('hello');
    expect(record.number).toBe(42);
    expect(record.boolean).toBe(true);
    expect(record.null).toBe(null);
  });

  it('should allow nested objects', () => {
    const record: JsonRecord = {
      nested: {
        deep: {
          value: 'found',
        },
      },
    };

    expect(record.nested).toHaveProperty('deep');
  });

  it('should allow arrays', () => {
    const record: JsonRecord = {
      items: ['one', 'two', 'three'],
      numbers: [1, 2, 3],
    };

    expect(record.items).toHaveLength(3);
    expect(record.numbers).toEqual([1, 2, 3]);
  });
});
