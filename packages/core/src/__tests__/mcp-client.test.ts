import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MCPClientError, MCPMemoryClient } from '../mcp/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MCPMemoryClient', () => {
  let client: MCPMemoryClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new MCPMemoryClient({
      baseURL: 'https://memory.example.com',
    });
  });

  describe('constructor', () => {
    it('should strip trailing slash from baseURL', () => {
      const clientWithSlash = new MCPMemoryClient({
        baseURL: 'https://memory.example.com/',
      });

      expect((clientWithSlash as unknown as { baseURL: string }).baseURL).toBe(
        'https://memory.example.com'
      );
    });

    it('should set token when provided', () => {
      const clientWithToken = new MCPMemoryClient({
        baseURL: 'https://memory.example.com',
        token: 'test-token',
      });

      expect((clientWithToken as unknown as { token?: string }).token).toBe('test-token');
    });
  });

  describe('setToken', () => {
    it('should set the authentication token', () => {
      client.setToken('new-token');
      expect((client as unknown as { token?: string }).token).toBe('new-token');
    });
  });

  describe('authenticate', () => {
    it('should authenticate with GitHub token', async () => {
      const mockResponse = {
        user_id: 'user-123',
        session_token: 'session-token-456',
        expires_at: Date.now() + 3600000,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.authenticate('github-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/authenticate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
      expect((client as unknown as { token?: string }).token).toBe('session-token-456');
    });

    it('should throw error on authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid token' }),
      });

      await expect(client.authenticate('bad-token')).rejects.toThrow(MCPClientError);
    });
  });

  describe('getMemory', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should get memory for a session', async () => {
      const mockResponse = {
        session_id: 'session-123',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        metadata: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getMemory('session-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/memory/get',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include limit and offset parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test', messages: [], metadata: {} }),
      });

      await client.getMemory('session-123', { limit: 10, offset: 5 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.session_id).toBe('session-123');
      expect(body.limit).toBe(10);
      expect(body.offset).toBe(5);
    });

    it('should throw error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Session not found' }),
      });

      await expect(client.getMemory('non-existent')).rejects.toThrow(MCPClientError);
    });
  });

  describe('saveMemory', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should save messages to a session', async () => {
      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi!' },
      ];

      const mockResponse = {
        session_id: 'session-123',
        saved_count: 2,
        updated_at: Date.now(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.saveMemory(messages, { session_id: 'session-123' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/memory/save',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include metadata when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test',
          saved_count: 1,
          updated_at: Date.now(),
        }),
      });

      await client.saveMemory([{ role: 'user', content: 'test' }], {
        metadata: { tags: ['important'] },
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.metadata).toEqual({ tags: ['important'] });
    });
  });

  describe('searchMemory', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should search memory across sessions', async () => {
      const mockResponse = {
        results: [
          {
            session_id: 'session-1',
            message: { role: 'user', content: 'test query' },
            score: 0.95,
            context: [],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.searchMemory('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/memory/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include search options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.searchMemory('query', {
        limit: 5,
        filter: {
          session_id: 'specific-session',
        },
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.query).toBe('query');
      expect(body.limit).toBe(5);
      expect(body.filter.session_id).toBe('specific-session');
    });
  });

  describe('listSessions', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should list sessions', async () => {
      const mockResponse = {
        sessions: [
          {
            id: 'session-1',
            title: 'Test Session',
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
        json: async () => mockResponse,
      });

      const result = await client.listSessions();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/sessions/list',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include list options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessions: [], total: 0 }),
      });

      await client.listSessions({
        limit: 20,
        offset: 10,
        state: 'completed',
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.limit).toBe(20);
      expect(body.offset).toBe(10);
      expect(body.state).toBe('completed');
    });
  });

  describe('Network Error Handling', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should handle network timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.getMemory('session-123')).rejects.toThrow('Network timeout');
    });

    it('should handle connection refused errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(client.getMemory('session-123')).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON');
        },
      });

      await expect(client.getMemory('session-123')).rejects.toThrow(SyntaxError);
    });

    it('should handle 500 internal server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database connection failed' }),
      });

      try {
        await client.getMemory('session-123');
        expect.fail('Should have thrown MCPClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPClientError);
        expect((error as MCPClientError).statusCode).toBe(500);
      }
    });

    it('should handle 503 service unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'Service temporarily unavailable' }),
      });

      await expect(client.getMemory('session-123')).rejects.toThrow(MCPClientError);
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await client.getMemory('session-123');

      expect(result).toEqual({});
    });

    it('should handle response without error field on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad request' }),
      });

      try {
        await client.getMemory('session-123');
        expect.fail('Should have thrown MCPClientError');
      } catch (error) {
        expect(error).toBeInstanceOf(MCPClientError);
        expect((error as MCPClientError).message).toBe('Request failed');
      }
    });
  });

  describe('Concurrent Requests', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should handle multiple concurrent requests safely', async () => {
      const mockResponses = [
        { session_id: 'session-1', messages: [{ role: 'user', content: 'Hello' }], metadata: {} },
        { session_id: 'session-2', messages: [{ role: 'user', content: 'World' }], metadata: {} },
        { session_id: 'session-3', messages: [{ role: 'user', content: 'Test' }], metadata: {} },
      ];

      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => mockResponses.shift()!,
      }));

      const promises = [
        client.getMemory('session-1'),
        client.getMemory('session-2'),
        client.getMemory('session-3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].session_id).toBe('session-1');
      expect(results[1].session_id).toBe('session-2');
      expect(results[2].session_id).toBe('session-3');
    });

    it('should handle concurrent requests with partial failures', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not found' }),
          };
        }
        return {
          ok: true,
          json: async () => ({ session_id: `session-${callCount}`, messages: [], metadata: {} }),
        };
      });

      const promises = [
        client.getMemory('session-1'),
        client.getMemory('session-2'),
        client.getMemory('session-3'),
      ];

      const results = await Promise.allSettled(promises);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });

    it('should maintain token consistency across concurrent requests', async () => {
      let receivedTokens: string[] = [];

      mockFetch.mockImplementation(async (...args: unknown[]) => {
        // The second argument is the RequestInit object with headers
        const options = args[1] as RequestInit | undefined;
        const authHeader = options?.headers?.['Authorization'] as string | undefined;
        receivedTokens.push(authHeader || '');
        return {
          ok: true,
          json: async () => ({ session_id: 'test', messages: [], metadata: {} }),
        } as Response;
      });

      client.setToken('concurrent-token');

      await Promise.all([
        client.getMemory('session-1'),
        client.getMemory('session-2'),
        client.getMemory('session-3'),
      ]);

      expect(receivedTokens).toHaveLength(3);
      expect(receivedTokens.every((token) => token === 'Bearer concurrent-token')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      client.setToken('test-token');
    });

    it('should handle empty messages array in saveMemory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test', saved_count: 0, updated_at: Date.now() }),
      });

      const result = await client.saveMemory([]);

      expect(result.saved_count).toBe(0);
    });

    it('should handle very long query strings in searchMemory', async () => {
      const longQuery = 'a'.repeat(10000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await client.searchMemory(longQuery);

      expect(result.results).toEqual([]);
    });

    it('should handle special characters in search query', async () => {
      const specialQuery = 'Search with "quotes" and \'apostrophes\' & symbols <>';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await client.searchMemory(specialQuery);

      expect(result.results).toEqual([]);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.query).toBe(specialQuery);
    });

    it('should handle large metadata objects', async () => {
      const largeMetadata = {
        data: 'x'.repeat(10000),
        nested: { a: { b: { c: { d: 'deep' } } } },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test',
          saved_count: 1,
          updated_at: Date.now(),
        }),
      });

      const result = await client.saveMemory([{ role: 'user', content: 'test' }], {
        metadata: largeMetadata,
      });

      expect(result.saved_count).toBe(1);
    });

    it('should handle zero limit and offset in getMemory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test', messages: [], metadata: {} }),
      });

      await client.getMemory('session-123', { limit: 0, offset: 0 });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.limit).toBe(0);
      expect(body.offset).toBe(0);
    });

    it('should handle unicode content in messages', async () => {
      const unicodeMessages = [
        { role: 'user' as const, content: 'Hello 世界 🌍' },
        { role: 'assistant' as const, content: 'مرحبا 👋' },
        { role: 'user' as const, content: 'Привет мир 🚀' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_id: 'test',
          saved_count: 3,
          updated_at: Date.now(),
        }),
      });

      const result = await client.saveMemory(unicodeMessages);

      expect(result.saved_count).toBe(3);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.messages[1].content).toBe('مرحبا 👋');
    });

    it('should handle null and undefined in optional parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.searchMemory('test', {
        limit: undefined,
        filter: undefined,
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.query).toBe('test');
      expect(body.limit).toBeUndefined();
    });
  });

  describe('Token Management Edge Cases', () => {
    it('should handle empty token string', () => {
      client.setToken('');

      expect((client as unknown as { token?: string }).token).toBe('');
    });

    it('should handle token updates between requests', async () => {
      client.setToken('first-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test', messages: [], metadata: {} }),
      });

      await client.getMemory('session-1');

      const firstCall = mockFetch.mock.calls[0];
      expect(firstCall[1].headers.Authorization).toBe('Bearer first-token');

      client.setToken('second-token');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'test', messages: [], metadata: {} }),
      });

      await client.getMemory('session-2');

      const secondCall = mockFetch.mock.calls[1];
      expect(secondCall[1].headers.Authorization).toBe('Bearer second-token');
    });

    it('should make request without auth when token is not set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: 'user-123', session_token: 'new-token', expires_at: Date.now() + 3600000 }),
      });

      await client.authenticate('github-token');

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.Authorization).toBeUndefined();
    });
  });
});
