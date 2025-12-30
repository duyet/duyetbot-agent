/**
 * MCP Tools Integration Tests
 *
 * Tests MCP tool execution through the unified tool executor.
 * Covers:
 * - MCP client operations (authentication, memory, todo)
 * - ToolExecutor with builtin and MCP tools
 * - Error handling and edge cases
 */

// Import from specific paths to avoid cloudflare: protocol imports
import { ToolExecutor } from '@duyetbot/cloudflare-agent/chat/tool-executor';
import { MCPClientError, MCPMemoryClient } from '@duyetbot/core';
import type { Tool } from '@duyetbot/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ============================================================================
// Mock HTTP Fetch
// ============================================================================

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  global.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// MCP Memory Client Tests
// ============================================================================

describe('MCP Memory Client', () => {
  const baseURL = 'https://memory.example.com';
  const client = new MCPMemoryClient({ baseURL });

  describe('Authentication', () => {
    it('should authenticate with GitHub token', async () => {
      const mockResponse = {
        user_id: 'user123',
        session_token: 'token456',
        expires_at: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.authenticate('ghp_test_token');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/authenticate`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ github_token: 'ghp_test_token' }),
        })
      );
    });

    it('should set token after authentication', async () => {
      const mockResponse = {
        user_id: 'user123',
        session_token: 'token456',
        expires_at: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.authenticate('ghp_test_token');

      // Subsequent request should include Authorization header
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'sess1', messages: [], metadata: {} }),
      } as Response);

      await client.getMemory('sess1');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const secondCallArgs = mockFetch.mock.calls[1];
      expect(secondCallArgs[1]).toMatchObject({
        headers: expect.objectContaining({
          Authorization: 'Bearer token456',
        }),
      });
    });

    it('should throw error on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' }),
      } as Response);

      await expect(client.authenticate('invalid_token')).rejects.toThrow(MCPClientError);
    });
  });

  describe('Memory Operations', () => {
    beforeEach(() => {
      client.setToken('test_token');
    });

    it('should get memory for a session', async () => {
      const mockMemory = {
        session_id: 'sess123',
        messages: [
          { role: 'user', content: 'Hello', timestamp: Date.now() },
          { role: 'assistant', content: 'Hi there!', timestamp: Date.now() },
        ],
        metadata: { title: 'Test Chat' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMemory,
      } as Response);

      const result = await client.getMemory('sess123');

      expect(result).toEqual(mockMemory);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/memory/get`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ session_id: 'sess123' }),
        })
      );
    });

    it('should save memory messages', async () => {
      const mockResult = {
        session_id: 'sess123',
        saved_count: 2,
        updated_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const messages = [
        { role: 'user' as const, content: 'Test message' },
        { role: 'assistant' as const, content: 'Response' },
      ];

      const result = await client.saveMemory(messages, {
        session_id: 'sess123',
        metadata: { title: 'Test' },
      });

      expect(result).toEqual(mockResult);
    });

    it('should search memory', async () => {
      const mockResults = {
        results: [
          {
            session_id: 'sess123',
            message: { role: 'user', content: 'Search result' },
            score: 0.95,
            context: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResults,
      } as Response);

      const result = await client.searchMemory('test query', { limit: 10 });

      expect(result).toEqual(mockResults);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}/api/memory/search`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'test query', limit: 10 }),
        })
      );
    });

    it('should list sessions', async () => {
      const mockSessions = {
        sessions: [
          {
            id: 'sess1',
            title: 'Chat 1',
            state: 'active',
            created_at: Date.now(),
            updated_at: Date.now(),
            message_count: 10,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions,
      } as Response);

      const result = await client.listSessions({ limit: 20 });

      expect(result).toEqual(mockSessions);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      client.setToken('test_token');
    });

    it('should throw MCPClientError with status code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' }),
      } as Response);

      try {
        await client.getMemory('nonexistent');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPClientError);
        expect((error as MCPClientError).statusCode).toBe(404);
        expect((error as MCPClientError).path).toBe('/api/memory/get');
      }
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getMemory('sess123')).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        },
      } as Response);

      await expect(client.getMemory('sess123')).rejects.toThrow();
    });
  });
});

// ============================================================================
// Tool Executor Tests with MCP
// ============================================================================

describe('ToolExecutor with MCP Tools', () => {
  // Mock builtin tool
  const mockBuiltinTool: Tool = {
    name: 'bash',
    description: 'Execute bash commands',
    inputSchema: z.object({
      command: z.string(),
    }),
    execute: async ({ content }) => {
      const command = content.command as string;
      return {
        status: 'success',
        content: `Executed: ${command}`,
      };
    },
  };

  const builtinToolMap = new Map<string, Tool>([['bash', mockBuiltinTool]]);

  // Mock MCP call function
  const mockMcpCallTool = vi.fn();

  const toolExecutor = new ToolExecutor({
    builtinToolMap,
    mcpCallTool: mockMcpCallTool,
  });

  beforeEach(() => {
    mockMcpCallTool.mockClear();
  });

  describe('Builtin Tool Execution', () => {
    it('should execute builtin tool', async () => {
      const result = await toolExecutor.execute({
        name: 'bash',
        arguments: JSON.stringify({ command: 'echo hello' }),
      });

      expect(result).toEqual({
        result: 'Executed: echo hello',
      });
      expect(mockMcpCallTool).not.toHaveBeenCalled();
    });

    it('should handle builtin tool errors', async () => {
      const errorTool: Tool = {
        name: 'error_tool',
        description: 'Tool that throws error',
        inputSchema: z.object({}),
        execute: async () => ({
          status: 'error',
          content: '',
          error: new Error('Tool failed'),
        }),
      };

      const errorMap = new Map([['error_tool', errorTool]]);
      const errorExecutor = new ToolExecutor({
        builtinToolMap: errorMap,
        mcpCallTool: mockMcpCallTool,
      });

      const result = await errorExecutor.execute({
        name: 'error_tool',
        arguments: '{}',
      });

      expect(result.error).toBe('Tool failed');
    });

    it('should handle invalid JSON arguments', async () => {
      const result = await toolExecutor.execute({
        name: 'bash',
        arguments: 'invalid json{',
      });

      expect(result.error).toBe('Invalid JSON arguments');
      expect(result.result).toBe('');
    });
  });

  describe('MCP Tool Execution', () => {
    it('should execute MCP tool with server prefix', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Task added successfully' }],
      });

      const result = await toolExecutor.execute({
        name: 'memory__add_task',
        arguments: JSON.stringify({
          description: 'Test task',
          priority: 5,
        }),
      });

      expect(result).toEqual({
        result: 'Task added successfully',
      });
      expect(mockMcpCallTool).toHaveBeenCalledWith({
        serverId: 'memory',
        name: 'add_task',
        arguments: {
          description: 'Test task',
          priority: 5,
        },
      });
    });

    it('should execute MCP tool without server prefix', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Memory saved' }],
      });

      const result = await toolExecutor.execute({
        name: 'save_memory',
        arguments: JSON.stringify({
          messages: [{ role: 'user', content: 'Test' }],
        }),
      });

      expect(result).toEqual({
        result: 'Memory saved',
      });
      // When no double-underscore separator, serverId defaults to tool name
      expect(mockMcpCallTool).toHaveBeenCalledWith({
        serverId: 'save_memory',
        name: 'save_memory',
        arguments: {
          messages: [{ role: 'user', content: 'Test' }],
        },
      });
    });

    it('should handle MCP tool with multiple content blocks', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [
          { type: 'text', text: 'First part' },
          { type: 'text', text: 'Second part' },
          { type: 'image', data: 'base64image' },
        ],
      });

      const result = await toolExecutor.execute({
        name: 'search_memory',
        arguments: JSON.stringify({ query: 'test' }),
      });

      expect(result.result).toContain('First part');
      expect(result.result).toContain('Second part');
      expect(result.result).toContain(JSON.stringify({ type: 'image', data: 'base64image' }));
    });

    it('should handle MCP tool errors', async () => {
      mockMcpCallTool.mockRejectedValueOnce(new Error('MCP server unavailable'));

      const result = await toolExecutor.execute({
        name: 'memory__add_task',
        arguments: '{}',
      });

      expect(result.error).toBe('MCP server unavailable');
      expect(result.result).toBe('');
    });

    it('should handle MCP tool with empty content', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [],
      });

      const result = await toolExecutor.execute({
        name: 'memory__list_tasks',
        arguments: '{}',
      });

      expect(result.result).toBe('');
    });
  });

  describe('Tool Routing', () => {
    it('should route to builtin tool when name matches', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Should not be called' }],
      });

      const result = await toolExecutor.execute({
        name: 'bash',
        arguments: JSON.stringify({ command: 'ls' }),
      });

      expect(result.result).toBe('Executed: ls');
      expect(mockMcpCallTool).not.toHaveBeenCalled();
    });

    it('should route to MCP tool when builtin not found', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'MCP tool executed' }],
      });

      const result = await toolExecutor.execute({
        name: 'unknown_server__some_tool',
        arguments: '{}',
      });

      expect(result.result).toBe('MCP tool executed');
      expect(mockMcpCallTool).toHaveBeenCalledWith({
        serverId: 'unknown_server',
        name: 'some_tool',
        arguments: {},
      });
    });

    it('should handle tool name with double underscore separator', async () => {
      mockMcpCallTool.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Nested tool executed' }],
      });

      const result = await toolExecutor.execute({
        name: 'memory__tasks__add_subtask',
        arguments: '{}',
      });

      expect(mockMcpCallTool).toHaveBeenCalledWith({
        serverId: 'memory',
        name: 'tasks__add_subtask',
        arguments: {},
      });
      expect(result.result).toBe('Nested tool executed');
    });
  });
});

// ============================================================================
// Todo MCP Tools Integration Tests
// ============================================================================

describe('Todo MCP Tools Integration', () => {
  const baseURL = 'https://memory.example.com';
  const client = new MCPMemoryClient({ baseURL });

  beforeEach(() => {
    client.setToken('test_token');
  });

  describe('Task Operations', () => {
    it('should add task via MCP tool', async () => {
      const mockResponse = {
        id: 'task123',
        description: 'Implement feature X',
        status: 'pending',
        priority: 7,
        created_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Simulate MCP tool call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/tasks/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          description: 'Implement feature X',
          priority: 7,
        }),
      });

      const data = (await result.json()) as { id: string };
      expect(data.id).toBe('task123');
    });

    it('should list tasks with status filter', async () => {
      const mockResponse = {
        tasks: [
          {
            id: 'task1',
            description: 'Task 1',
            status: 'pending',
            priority: 5,
            created_at: Date.now(),
          },
          {
            id: 'task2',
            description: 'Task 2',
            status: 'pending',
            priority: 6,
            created_at: Date.now(),
          },
        ],
        total: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/tasks/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          status: 'pending',
          limit: 20,
        }),
      });

      const data = (await result.json()) as { tasks: unknown[]; total: number };
      expect(data.tasks).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should update task', async () => {
      const mockResponse = {
        id: 'task1',
        description: 'Updated description',
        status: 'in_progress',
        priority: 8,
        updated_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/tasks/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          id: 'task1',
          status: 'in_progress',
          priority: 8,
        }),
      });

      const data = (await result.json()) as { status: string };
      expect(data.status).toBe('in_progress');
    });

    it('should complete task', async () => {
      const mockResponse = {
        id: 'task1',
        description: 'Completed task',
        status: 'completed',
        completed_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/tasks/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({ id: 'task1' }),
      });

      const data = (await result.json()) as { status: string };
      expect(data.status).toBe('completed');
    });

    it('should delete task', async () => {
      const mockResponse = {
        success: true,
        id: 'task1',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/tasks/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({ id: 'task1' }),
      });

      const data = (await result.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });
});

// ============================================================================
// Long-term Memory MCP Tools Tests
// ============================================================================

describe('Long-term Memory MCP Tools Integration', () => {
  const baseURL = 'https://memory.example.com';
  const client = new MCPMemoryClient({ baseURL });

  beforeEach(() => {
    client.setToken('test_token');
  });

  describe('Long-term Memory Operations', () => {
    it('should save long-term memory', async () => {
      const mockResponse = {
        id: 'mem123',
        created: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/long-term/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          category: 'preference',
          key: 'theme',
          value: 'dark_mode',
          importance: 8,
        }),
      });

      const data = (await result.json()) as { id: string; created: boolean };
      expect(data.id).toBe('mem123');
      expect(data.created).toBe(true);
    });

    it('should get long-term memory', async () => {
      const mockResponse = {
        items: [
          {
            id: 'mem1',
            category: 'preference',
            key: 'theme',
            value: 'dark_mode',
            importance: 8,
            access_count: 5,
          },
        ],
        total: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/long-term/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          category: 'preference',
          limit: 10,
        }),
      });

      const data = (await result.json()) as { items: unknown[]; total: number };
      expect(data.items).toHaveLength(1);
      expect(data.total).toBe(1);
    });

    it('should update long-term memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/long-term/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          id: 'mem1',
          value: 'light_mode',
          importance: 5,
        }),
      });

      const data = (await result.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });

    it('should delete long-term memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/long-term/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({ id: 'mem1' }),
      });

      const data = (await result.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });
});

// ============================================================================
// Short-term Memory MCP Tools Tests
// ============================================================================

describe('Short-term Memory MCP Tools Integration', () => {
  const baseURL = 'https://memory.example.com';
  const client = new MCPMemoryClient({ baseURL });

  beforeEach(() => {
    client.setToken('test_token');
  });

  describe('Short-term Memory Operations', () => {
    it('should set short-term memory', async () => {
      const mockResponse = {
        id: 'stm1',
        key: 'context',
        value: 'conversation context',
        expires_at: Date.now() + 86400000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/short-term/set`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          session_id: 'sess123',
          key: 'context',
          value: 'conversation context',
          ttl_seconds: 3600,
        }),
      });

      const data = (await result.json()) as { id: string };
      expect(data.id).toBe('stm1');
    });

    it('should get short-term memory', async () => {
      const mockResponse = {
        key: 'context',
        value: 'conversation context',
        expires_at: Date.now() + 86400000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/short-term/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          session_id: 'sess123',
          key: 'context',
        }),
      });

      const data = (await result.json()) as { value: string };
      expect(data.value).toBe('conversation context');
    });

    it('should list short-term memory items', async () => {
      const mockResponse = [
        {
          key: 'context',
          value: 'conversation context',
          expires_at: Date.now() + 86400000,
        },
        {
          key: 'user_pref',
          value: 'preferences',
          expires_at: Date.now() + 86400000,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/short-term/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          session_id: 'sess123',
        }),
      });

      const data = (await result.json()) as Array<{ key: string }>;
      expect(data).toHaveLength(2);
    });

    it('should delete short-term memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await fetch(`${baseURL}/api/memory/short-term/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer test_token',
        },
        body: JSON.stringify({
          session_id: 'sess123',
          key: 'context',
        }),
      });

      const data = (await result.json()) as { success: boolean };
      expect(data.success).toBe(true);
    });
  });
});
