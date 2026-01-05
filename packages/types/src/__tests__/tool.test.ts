/**
 * Tests for Tool Types
 *
 * Validates tool type definitions, interfaces, and error handling
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type {
  Tool,
  ToolContext,
  ToolDefinition,
  ToolError,
  ToolExecutionResult,
  ToolHooks,
  ToolInput,
  ToolOutput,
  ToolParameters,
  ToolRegistryEntry,
  ToolStatus,
} from '../tool.js';
import { ToolExecutionError } from '../tool.js';

describe('Tool Types', () => {
  describe('ToolStatus', () => {
    it('should accept valid tool statuses', () => {
      const statuses: ToolStatus[] = ['success', 'error', 'timeout', 'cancelled'];
      statuses.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });

    it('should reject invalid statuses at compile time', () => {
      // @ts-expect-error - Intentional invalid status
      const invalid: ToolStatus = 'invalid';
      expect(invalid).toBe('invalid');
    });
  });

  describe('ToolInput', () => {
    it('should accept string content', () => {
      const input: ToolInput = {
        content: 'test input',
      };

      expect(input.content).toBe('test input');
      expect(input.metadata).toBeUndefined();
    });

    it('should accept object content', () => {
      const input: ToolInput = {
        content: { key: 'value', number: 42 },
      };

      expect(input.content).toEqual({ key: 'value', number: 42 });
    });

    it('should accept optional metadata', () => {
      const input: ToolInput = {
        content: 'test',
        metadata: { requestId: 'req-123', userId: 'user-456' },
      };

      expect(input.metadata).toEqual({ requestId: 'req-123', userId: 'user-456' });
    });
  });

  describe('ToolError', () => {
    it('should create a minimal tool error', () => {
      const error: ToolError = {
        message: 'Something went wrong',
      };

      expect(error.message).toBe('Something went wrong');
      expect(error.code).toBeUndefined();
      expect(error.stack).toBeUndefined();
      expect(error.metadata).toBeUndefined();
    });

    it('should create a complete tool error', () => {
      const error: ToolError = {
        message: 'Tool execution failed',
        code: 'EXECUTION_ERROR',
        stack: 'Error: Tool execution failed\n    at Tool.execute',
        metadata: { retryable: true, attempts: 3 },
      };

      expect(error.message).toBe('Tool execution failed');
      expect(error.code).toBe('EXECUTION_ERROR');
      expect(error.stack).toBeTruthy();
      expect(error.metadata).toEqual({ retryable: true, attempts: 3 });
    });
  });

  describe('ToolOutput', () => {
    it('should create a successful output', () => {
      const output: ToolOutput = {
        status: 'success',
        content: 'Operation completed',
      };

      expect(output.status).toBe('success');
      expect(output.content).toBe('Operation completed');
      expect(output.error).toBeUndefined();
    });

    it('should create an error output', () => {
      const output: ToolOutput = {
        status: 'error',
        content: 'Operation failed',
        error: {
          message: 'Invalid input',
          code: 'INVALID_INPUT',
        },
      };

      expect(output.status).toBe('error');
      expect(output.error?.message).toBe('Invalid input');
      expect(output.error?.code).toBe('INVALID_INPUT');
    });

    it('should accept object content', () => {
      const output: ToolOutput = {
        status: 'success',
        content: { result: 'data', count: 42 },
      };

      expect(output.content).toEqual({ result: 'data', count: 42 });
    });

    it('should accept optional metadata', () => {
      const output: ToolOutput = {
        status: 'success',
        content: 'Done',
        metadata: { executionTime: 100, cached: false },
      };

      expect(output.metadata).toEqual({ executionTime: 100, cached: false });
    });
  });

  describe('ToolParameters', () => {
    it('should define required parameters', () => {
      const params: ToolParameters = {
        required: ['url', 'method'],
      };

      expect(params.required).toEqual(['url', 'method']);
      expect(params.optional).toBeUndefined();
    });

    it('should define optional parameters', () => {
      const params: ToolParameters = {
        optional: ['headers', 'timeout'],
      };

      expect(params.optional).toEqual(['headers', 'timeout']);
    });

    it('should define both required and optional', () => {
      const params: ToolParameters = {
        required: ['query'],
        optional: ['limit', 'offset'],
      };

      expect(params.required).toEqual(['query']);
      expect(params.optional).toEqual(['limit', 'offset']);
    });
  });

  describe('ToolDefinition', () => {
    it('should create a minimal tool definition', () => {
      const schema = z.object({
        query: z.string(),
      });

      const definition: ToolDefinition = {
        name: 'search',
        description: 'Search for information',
        inputSchema: schema,
      };

      expect(definition.name).toBe('search');
      expect(definition.description).toBe('Search for information');
      expect(definition.inputSchema).toBe(schema);
    });

    it('should include optional fields', () => {
      const schema = z.object({
        url: z.string(),
      });

      const definition: ToolDefinition = {
        name: 'fetch',
        description: 'Fetch a URL',
        inputSchema: schema,
        parameters: {
          required: ['url'],
          optional: ['method', 'headers'],
        },
        examples: [
          {
            input: { content: { url: 'https://example.com' } },
            output: { status: 'success', content: 'Response' },
          },
        ],
        metadata: { category: 'http', version: '1.0' },
      };

      expect(definition.parameters?.required).toContain('url');
      expect(definition.examples).toHaveLength(1);
      expect(definition.metadata).toEqual({ category: 'http', version: '1.0' });
    });
  });

  describe('ToolContext', () => {
    it('should create an empty context', () => {
      const context: ToolContext = {};
      expect(Object.keys(context)).toHaveLength(0);
    });

    it('should create a complete context', () => {
      const context: ToolContext = {
        requestId: 'req-123',
        sessionId: 'session-456',
        userId: 'user-789',
        timeout: 30000,
        env: { API_KEY: 'secret' },
        metadata: { traceId: 'trace-abc' },
      };

      expect(context.requestId).toBe('req-123');
      expect(context.sessionId).toBe('session-456');
      expect(context.userId).toBe('user-789');
      expect(context.timeout).toBe(30000);
      expect(context.env).toEqual({ API_KEY: 'secret' });
    });
  });

  describe('ToolExecutionError', () => {
    it('should create a minimal error', () => {
      const error = new ToolExecutionError('testTool', 'Test error');

      expect(error.message).toBe('Test error');
      expect(error.toolName).toBe('testTool');
      expect(error.name).toBe('ToolExecutionError');
      expect(error.code).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should create an error with code', () => {
      const error = new ToolExecutionError('testTool', 'Test error', 'TEST_ERROR');

      expect(error.code).toBe('TEST_ERROR');
    });

    it('should create an error with cause', () => {
      const cause = new Error('Underlying error');
      const error = new ToolExecutionError('testTool', 'Test error', 'WRAP_ERROR', cause);

      expect(error.cause).toBe(cause);
      expect(error.cause?.message).toBe('Underlying error');
    });

    it('should create an error with metadata', () => {
      const error = new ToolExecutionError('testTool', 'Test error', undefined, undefined, {
        retryable: true,
        attempts: 3,
      });

      expect(error.metadata).toEqual({ retryable: true, attempts: 3 });
    });

    it('should create a complete error', () => {
      const cause = new Error('Network error');
      const error = new ToolExecutionError('apiTool', 'API request failed', 'API_ERROR', cause, {
        retryable: true,
        statusCode: 500,
      });

      expect(error.toolName).toBe('apiTool');
      expect(error.message).toBe('API request failed');
      expect(error.code).toBe('API_ERROR');
      expect(error.cause).toBe(cause);
      expect(error.metadata).toEqual({ retryable: true, statusCode: 500 });
    });
  });

  describe('ToolRegistryEntry', () => {
    it('should create a registry entry', () => {
      const mockTool: Tool = {
        name: 'testTool',
        description: 'Test tool',
        inputSchema: z.object({}),
        async execute(_input) {
          return { status: 'success', content: 'done' };
        },
      };

      const entry: ToolRegistryEntry = {
        tool: mockTool,
        enabled: true,
        usageCount: 10,
        lastUsed: new Date('2024-01-01'),
        metadata: { category: 'test' },
      };

      expect(entry.tool.name).toBe('testTool');
      expect(entry.enabled).toBe(true);
      expect(entry.usageCount).toBe(10);
      expect(entry.lastUsed).toEqual(new Date('2024-01-01'));
    });
  });

  describe('ToolExecutionResult', () => {
    it('should create an execution result', () => {
      const startTime = Date.now();
      const endTime = startTime + 100;

      const result: ToolExecutionResult = {
        toolName: 'testTool',
        status: 'success',
        content: 'done',
        startTime,
        endTime,
        duration: endTime - startTime,
      };

      expect(result.toolName).toBe('testTool');
      expect(result.status).toBe('success');
      expect(result.duration).toBe(100);
    });

    it('should include metadata from ToolOutput', () => {
      const startTime = Date.now();
      const endTime = startTime + 50;

      const result: ToolExecutionResult = {
        toolName: 'cacheTool',
        status: 'success',
        content: { cached: true },
        startTime,
        endTime,
        duration: 50,
        metadata: { fromCache: true, ttl: 3600 },
      };

      expect(result.metadata).toEqual({ fromCache: true, ttl: 3600 });
    });
  });

  describe('ToolHooks', () => {
    it('should define hook functions', () => {
      const _mockTool: Tool = {
        name: 'hookedTool',
        description: 'Tool with hooks',
        inputSchema: z.object({}),
        async execute(_input) {
          return { status: 'success', content: 'done' };
        },
      };

      const hooks: ToolHooks = {
        beforeExecute: async (tool, _input, _context) => {
          console.log(`Before executing ${tool.name}`);
        },
        afterExecute: async (tool, _output, _context) => {
          console.log(`After executing ${tool.name}`);
        },
        onError: async (tool, error, _context) => {
          console.error(`Error in ${tool.name}: ${error.message}`);
        },
      };

      expect(hooks.beforeExecute).toBeTruthy();
      expect(hooks.afterExecute).toBeTruthy();
      expect(hooks.onError).toBeTruthy();
    });
  });
});
