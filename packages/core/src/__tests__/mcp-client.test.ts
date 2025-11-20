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
});

describe('MCPClientError', () => {
  it('should create error with message', () => {
    const error = new MCPClientError('Not found', 404, '/test');

    expect(error.message).toBe('Not found');
    expect(error.name).toBe('MCPClientError');
  });

  it('should be an instance of Error', () => {
    const error = new MCPClientError('Test', 500, '/');
    expect(error).toBeInstanceOf(Error);
  });
});
