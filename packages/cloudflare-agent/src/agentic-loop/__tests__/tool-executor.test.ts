/**
 * Tests for ToolExecutor
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createTool, ToolExecutor } from '../tool-executor.js';
import type { LoopContext, ToolResult } from '../types.js';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let mockContext: LoopContext;

  beforeEach(() => {
    executor = new ToolExecutor();
    mockContext = {
      executionContext: {} as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('register', () => {
    it('should register a valid tool', () => {
      const tool = createTool(
        'test_tool',
        'A test tool',
        {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
        async () => ({
          success: true,
          output: 'result',
          durationMs: 0,
        })
      );

      executor.register(tool);
      expect(executor.has('test_tool')).toBe(true);
    });

    it('should throw on duplicate tool name', () => {
      const tool = createTool('duplicate', 'A tool', { type: 'object' }, async () => ({
        success: true,
        output: '',
        durationMs: 0,
      }));

      executor.register(tool);
      expect(() => executor.register(tool)).toThrow('already registered');
    });

    it('should validate tool definition', () => {
      expect(() => {
        executor.register({
          name: '',
          description: 'Invalid tool',
          parameters: { type: 'object' },
          execute: async () => ({ success: true, output: '', durationMs: 0 }),
        });
      }).toThrow('non-empty name');
    });

    it('should reject invalid tool names', () => {
      expect(() => {
        executor.register({
          name: 'invalid-name',
          description: 'Invalid tool',
          parameters: { type: 'object' },
          execute: async () => ({ success: true, output: '', durationMs: 0 }),
        });
      }).toThrow('alphanumeric');
    });
  });

  describe('registerAll', () => {
    it('should register multiple tools', () => {
      const tools = [
        createTool('tool1', 'First tool', { type: 'object' }, async () => ({
          success: true,
          output: '',
          durationMs: 0,
        })),
        createTool('tool2', 'Second tool', { type: 'object' }, async () => ({
          success: true,
          output: '',
          durationMs: 0,
        })),
      ];

      executor.registerAll(tools);
      expect(executor.getNames()).toEqual(['tool1', 'tool2']);
    });
  });

  describe('retrieval', () => {
    beforeEach(() => {
      executor.register(
        createTool('test', 'A test tool', { type: 'object' }, async () => ({
          success: true,
          output: 'result',
          durationMs: 0,
        }))
      );
    });

    it('should get tool by name', () => {
      const tool = executor.get('test');
      expect(tool).toBeDefined();
      expect(tool?.name).toBe('test');
    });

    it('should return undefined for non-existent tool', () => {
      const tool = executor.get('nonexistent');
      expect(tool).toBeUndefined();
    });

    it('should check if tool exists', () => {
      expect(executor.has('test')).toBe(true);
      expect(executor.has('nonexistent')).toBe(false);
    });

    it('should get all tools', () => {
      expect(executor.getAll()).toHaveLength(1);
      expect(executor.getAll()[0].name).toBe('test');
    });

    it('should get tool names', () => {
      expect(executor.getNames()).toEqual(['test']);
    });
  });

  describe('toAnthropicFormat', () => {
    it('should convert tools to Anthropic format', () => {
      executor.register(
        createTool(
          'search',
          'Search the web',
          {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
            },
            required: ['query'],
          },
          async () => ({ success: true, output: '', durationMs: 0 })
        )
      );

      const anthropicTools = executor.toAnthropicFormat();
      expect(anthropicTools).toHaveLength(1);
      expect(anthropicTools[0]).toEqual({
        name: 'search',
        description: 'Search the web',
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      });
    });

    it('should handle tools without required fields', () => {
      executor.register(
        createTool(
          'simple',
          'Simple tool',
          {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
          },
          async () => ({ success: true, output: '', durationMs: 0 })
        )
      );

      const anthropicTools = executor.toAnthropicFormat();
      expect(anthropicTools[0].input_schema.required).toBeUndefined();
    });
  });

  describe('execute', () => {
    let executedAt: number;

    beforeEach(() => {
      executor.register(
        createTool(
          'echo',
          'Echo input back',
          {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
          },
          async (args) => {
            executedAt = Date.now();
            return {
              success: true,
              output: `Echo: ${args.message}`,
              durationMs: 10,
            };
          }
        )
      );
    });

    it('should execute a tool successfully', async () => {
      const result = await executor.execute(mockContext, {
        id: 'call_1',
        name: 'echo',
        arguments: { message: 'hello' },
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Echo: hello');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return error for non-existent tool', async () => {
      const result = await executor.execute(mockContext, {
        id: 'call_1',
        name: 'nonexistent',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate required arguments', async () => {
      const result = await executor.execute(mockContext, {
        id: 'call_1',
        name: 'echo',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required argument');
    });

    it('should handle tool execution errors', async () => {
      executor.register(
        createTool('error_tool', 'Tool that throws', { type: 'object' }, async () => {
          throw new Error('Intentional error');
        })
      );

      const result = await executor.execute(mockContext, {
        id: 'call_1',
        name: 'error_tool',
        arguments: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Intentional error');
    });

    it('should measure execution duration', async () => {
      const result = await executor.execute(mockContext, {
        id: 'call_1',
        name: 'echo',
        arguments: { message: 'test' },
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('executeAll', () => {
    beforeEach(() => {
      executor.register(
        createTool('tool1', 'First tool', { type: 'object' }, async () => ({
          success: true,
          output: 'result1',
          durationMs: 10,
        }))
      );
      executor.register(
        createTool('tool2', 'Second tool', { type: 'object' }, async () => ({
          success: true,
          output: 'result2',
          durationMs: 20,
        }))
      );
    });

    it('should execute multiple tools in parallel', async () => {
      const toolCalls = [
        { id: 'call_1', name: 'tool1', arguments: {} },
        { id: 'call_2', name: 'tool2', arguments: {} },
      ];

      const results = await executor.executeAll(mockContext, toolCalls);

      expect(results.size).toBe(2);
      expect(results.get('call_1')?.success).toBe(true);
      expect(results.get('call_2')?.success).toBe(true);
    });

    it('should handle mixed success/failure', async () => {
      const toolCalls = [
        { id: 'call_1', name: 'tool1', arguments: {} },
        { id: 'call_2', name: 'nonexistent', arguments: {} },
      ];

      const results = await executor.executeAll(mockContext, toolCalls);

      expect(results.get('call_1')?.success).toBe(true);
      expect(results.get('call_2')?.success).toBe(false);
    });
  });

  describe('createTool', () => {
    it('should create a tool definition', () => {
      const tool = createTool('my_tool', 'My tool description', { type: 'object' }, async () => ({
        success: true,
        output: '',
        durationMs: 0,
      }));

      expect(tool.name).toBe('my_tool');
      expect(tool.description).toBe('My tool description');
      expect(typeof tool.execute).toBe('function');
    });
  });
});
