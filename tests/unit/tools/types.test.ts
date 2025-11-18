import {
  type Tool,
  type ToolDefinition,
  ToolExecutionError,
  type ToolInput,
  type ToolOutput,
} from '@/tools/types';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

describe('Tool Types', () => {
  describe('ToolDefinition', () => {
    it('should have required fields', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({
          input: z.string(),
        }),
      };

      expect(toolDef.name).toBe('test-tool');
      expect(toolDef.description).toBe('A test tool');
      expect(toolDef.inputSchema).toBeDefined();
    });

    it('should support optional parameters field', () => {
      const toolDef: ToolDefinition = {
        name: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({
          command: z.string(),
          timeout: z.number().optional(),
        }),
        parameters: {
          required: ['command'],
          optional: ['timeout'],
        },
      };

      expect(toolDef.parameters).toBeDefined();
      expect(toolDef.parameters?.required).toContain('command');
      expect(toolDef.parameters?.optional).toContain('timeout');
    });
  });

  describe('ToolInput', () => {
    it('should support string content', () => {
      const input: ToolInput = {
        content: 'test input',
      };

      expect(input.content).toBe('test input');
    });

    it('should support object content', () => {
      const input: ToolInput = {
        content: { command: 'ls', args: ['-la'] },
      };

      expect(input.content).toEqual({ command: 'ls', args: ['-la'] });
    });

    it('should support metadata', () => {
      const input: ToolInput = {
        content: 'test',
        metadata: {
          requestId: '123',
          timestamp: Date.now(),
        },
      };

      expect(input.metadata).toBeDefined();
      expect(input.metadata?.requestId).toBe('123');
    });
  });

  describe('ToolOutput', () => {
    it('should have success status and content', () => {
      const output: ToolOutput = {
        status: 'success',
        content: 'Operation completed',
      };

      expect(output.status).toBe('success');
      expect(output.content).toBe('Operation completed');
    });

    it('should support error status', () => {
      const output: ToolOutput = {
        status: 'error',
        content: 'Operation failed',
        error: {
          message: 'Something went wrong',
          code: 'ERR_FAILED',
        },
      };

      expect(output.status).toBe('error');
      expect(output.error?.message).toBe('Something went wrong');
      expect(output.error?.code).toBe('ERR_FAILED');
    });

    it('should support metadata in output', () => {
      const output: ToolOutput = {
        status: 'success',
        content: 'Done',
        metadata: {
          executionTime: 150,
          resourcesUsed: { cpu: 10, memory: 256 },
        },
      };

      expect(output.metadata?.executionTime).toBe(150);
    });
  });

  describe('Tool Interface', () => {
    it('should define execute method', async () => {
      const mockTool: Tool = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({ input: z.string() }),
        execute: async (input: ToolInput) => {
          return {
            status: 'success' as const,
            content: `Processed: ${input.content}`,
          };
        },
      };

      expect(mockTool.name).toBe('test-tool');
      expect(typeof mockTool.execute).toBe('function');

      const result = await mockTool.execute({ content: 'test' });
      expect(result.status).toBe('success');
      expect(result.content).toBe('Processed: test');
    });

    it('should support validation method', async () => {
      const mockTool: Tool = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({ value: z.number() }),
        validate: (input: ToolInput) => {
          const parsed = mockTool.inputSchema.safeParse(input.content);
          return parsed.success;
        },
        execute: async () => ({ status: 'success', content: 'ok' }),
      };

      expect(mockTool.validate?.({ content: { value: 42 } })).toBe(true);
      expect(mockTool.validate?.({ content: { value: 'string' } })).toBe(false);
    });

    it('should support cleanup method', async () => {
      let cleaned = false;

      const mockTool: Tool = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({}),
        execute: async () => ({ status: 'success', content: 'ok' }),
        cleanup: async () => {
          cleaned = true;
        },
      };

      await mockTool.cleanup?.();
      expect(cleaned).toBe(true);
    });
  });

  describe('ToolExecutionError', () => {
    it('should create error with tool name and message', () => {
      const error = new ToolExecutionError('test-tool', 'Execution failed');

      expect(error.message).toBe('Execution failed');
      expect(error.toolName).toBe('test-tool');
      expect(error.name).toBe('ToolExecutionError');
    });

    it('should support error code', () => {
      const error = new ToolExecutionError('test-tool', 'Failed', 'TIMEOUT');

      expect(error.code).toBe('TIMEOUT');
    });

    it('should support cause error', () => {
      const cause = new Error('Original error');
      const error = new ToolExecutionError('test-tool', 'Failed', undefined, cause);

      expect(error.cause).toBe(cause);
    });

    it('should support metadata', () => {
      const error = new ToolExecutionError('test-tool', 'Failed', 'ERR', undefined, {
        timeout: 5000,
        attempt: 3,
      });

      expect(error.metadata?.timeout).toBe(5000);
      expect(error.metadata?.attempt).toBe(3);
    });
  });
});
