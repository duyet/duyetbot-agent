import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Mem0AdapterError, Mem0MemoryAdapter } from '../adapter.js';

describe('Mem0MemoryAdapter', () => {
  let adapter: Mem0MemoryAdapter;
  const mockFetch = vi.fn();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    adapter = new Mem0MemoryAdapter({
      apiKey: 'test-api-key',
      userId: 'test-user',
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default base URL', () => {
      const adapter = new Mem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
      });
      expect(adapter).toBeDefined();
    });

    it('should accept custom base URL', () => {
      const adapter = new Mem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
        baseURL: 'https://custom.mem0.ai/',
      });
      expect(adapter).toBeDefined();
    });

    it('should strip trailing slash from base URL', () => {
      const adapter = new Mem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
        baseURL: 'https://custom.mem0.ai/',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('getMemory', () => {
    it('should fetch memories for a session', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'Hello',
              user_id: 'test-user',
              run_id: 'session-1',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result = await adapter.getMemory('session-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Token test-api-key',
          }),
        })
      );
      expect(result.sessionId).toBe('session-1');
      expect(result.messages.length).toBe(1);
      expect(result.messages[0]?.content).toBe('Hello');
    });

    it('should handle pagination options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await adapter.getMemory('session-1', { limit: 10, offset: 20 });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('page=3'); // offset 20 / limit 10 + 1
      expect(callUrl).toContain('page_size=10');
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal error' }),
      });

      await expect(adapter.getMemory('session-1')).rejects.toThrow(Mem0AdapterError);
    });
  });

  describe('saveMemory', () => {
    it('should save messages to mem0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 'mem-1', event: 'ADD', data: { memory: 'Hello' } },
            { id: 'mem-2', event: 'ADD', data: { memory: 'Hi there!' } },
          ],
        }),
      });

      const result = await adapter.saveMemory('session-1', [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Token test-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result.savedCount).toBe(2);
      expect(result.sessionId).toBe('session-1');
    });

    it('should include metadata in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await adapter.saveMemory('session-1', [{ role: 'user', content: 'test' }], {
        platform: 'telegram',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(callBody.metadata).toEqual({ platform: 'telegram' });
    });

    it('should count ADD and UPDATE events', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 'mem-1', event: 'ADD', data: { memory: 'test' } },
            { id: 'mem-2', event: 'UPDATE', data: { memory: 'test' } },
            { id: 'mem-3', event: 'NOOP', data: { memory: 'test' } },
          ],
        }),
      });

      const result = await adapter.saveMemory('session-1', [{ role: 'user', content: 'test' }]);

      expect(result.savedCount).toBe(2); // Only ADD and UPDATE
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Invalid token' }),
      });

      await expect(adapter.saveMemory('session-1', [])).rejects.toThrow(Mem0AdapterError);
    });
  });

  describe('searchMemory', () => {
    it('should search with filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'Hello',
              user_id: 'test-user',
              score: 0.9,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.searchMemory('Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/search/'),
        expect.anything()
      );
      expect(results.length).toBe(1);
      expect(results[0]?.score).toBe(0.9);
    });

    it('should include session filter when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await adapter.searchMemory('test', { sessionId: 'session-1', limit: 5 });

      const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(callBody.filters.run_id).toBe('session-1');
      expect(callBody.top_k).toBe(5);
    });

    it('should enable reranking', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await adapter.searchMemory('test');

      const callBody = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(callBody.rerank).toBe(true);
    });
  });

  describe('listSessions', () => {
    it('should return empty list', async () => {
      const result = await adapter.listSessions();
      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('saveShortTermMemory', () => {
    it('should calculate expiration date from TTL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'mem-1', event: 'ADD', data: { memory: 'test' } }],
        }),
      });

      await adapter.saveShortTermMemory('session-1', 'temp-key', 'temp-value', 3600);

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call?.[1]?.body as string);
      expect(body.expiration_date).toBeDefined();
      expect(body.metadata.type).toBe('short_term');
      expect(body.metadata.key).toBe('temp-key');
      expect(body.categories).toContain('short_term_memory');
    });

    it('should not set expiration when TTL is undefined', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'mem-1', event: 'ADD', data: { memory: 'test' } }],
        }),
      });

      await adapter.saveShortTermMemory('session-1', 'key', 'value');

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.expiration_date).toBeUndefined();
    });
  });

  describe('getShortTermMemory', () => {
    it('should retrieve short-term memory by key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test-value',
              metadata: { key: 'test-key' },
              expiration_date: '2024-12-31',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result = await adapter.getShortTermMemory('session-1', 'test-key');

      expect(result).toBeDefined();
      expect(result?.key).toBe('test-key');
      expect(result?.value).toBe('test-value');
    });

    it('should return null when not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await adapter.getShortTermMemory('session-1', 'missing-key');
      expect(result).toBeNull();
    });
  });

  describe('listShortTermMemory', () => {
    it('should list all short-term memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'value-1',
              metadata: { key: 'key-1' },
              categories: ['short_term_memory'],
              expiration_date: '2024-12-31',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'mem-2',
              memory: 'value-2',
              metadata: { key: 'key-2' },
              categories: ['short_term_memory'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.listShortTermMemory('session-1');

      expect(results.length).toBe(2);
      expect(results[0]?.key).toBe('key-1');
      expect(results[1]?.key).toBe('key-2');
    });

    it('should filter out non-short-term memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'value-1',
              metadata: { key: 'key-1' },
              categories: ['short_term_memory'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'mem-2',
              memory: 'value-2',
              metadata: { key: 'key-2' },
              categories: ['user_facts'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.listShortTermMemory('session-1');

      expect(results.length).toBe(1);
      expect(results[0]?.key).toBe('key-1');
    });
  });

  describe('deleteShortTermMemory', () => {
    it('should delete short-term memory by key', async () => {
      // First call: search to find the memory
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test-value',
              metadata: { key: 'test-key' },
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      // Second call: search again for delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test-value',
              metadata: { key: 'test-key' },
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      // Third call: delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await adapter.deleteShortTermMemory('session-1', 'test-key');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/mem-1/'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should return false when memory not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await adapter.deleteShortTermMemory('session-1', 'missing-key');
      expect(result).toBe(false);
    });
  });

  describe('saveLongTermMemory', () => {
    it('should map category to mem0 format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'mem-1', event: 'ADD', data: { memory: 'test' } }],
        }),
      });

      await adapter.saveLongTermMemory('fact', 'user-name', 'John', 0.8, { source: 'profile' });

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.categories).toContain('user_facts');
      expect(body.metadata.category).toBe('fact');
      expect(body.metadata.key).toBe('user-name');
      expect(body.metadata.importance).toBe(0.8);
      expect(body.metadata.source).toBe('profile');
    });

    it('should throw when no result returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await expect(adapter.saveLongTermMemory('note', 'key', 'value')).rejects.toThrow(
        Mem0AdapterError
      );
    });
  });

  describe('getLongTermMemory', () => {
    it('should retrieve long-term memories', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'John',
              metadata: { key: 'user-name', importance: 0.8, category: 'fact' },
              categories: ['user_facts'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.getLongTermMemory({ category: 'fact' });

      expect(results.length).toBe(1);
      expect(results[0]?.category).toBe('fact');
      expect(results[0]?.key).toBe('user-name');
      expect(results[0]?.value).toBe('John');
    });

    it('should filter by key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'John',
              metadata: { key: 'user-name', category: 'fact' },
              categories: ['user_facts'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
            {
              id: 'mem-2',
              memory: 'Developer',
              metadata: { key: 'user-role', category: 'fact' },
              categories: ['user_facts'],
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.getLongTermMemory({ key: 'user-name' });

      expect(results.length).toBe(1);
      expect(results[0]?.key).toBe('user-name');
    });
  });

  describe('updateLongTermMemory', () => {
    it('should update long-term memory with value only', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'mem-1', memory: 'Updated value' }),
      });

      const result = await adapter.updateLongTermMemory('mem-1', {
        value: 'Updated value',
      });

      expect(result).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.memory).toBe('Updated value');
    });

    it('should update long-term memory with importance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'mem-1', memory: 'Updated value' }),
      });

      const result = await adapter.updateLongTermMemory('mem-1', {
        value: 'Updated value',
        importance: 0.9,
        metadata: { source: 'test' },
      });

      expect(result).toBe(true);
      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.memory).toBe('Updated value');
      expect(body.metadata.importance).toBe(0.9);
      expect(body.metadata.source).toBe('test');
    });
  });

  describe('deleteLongTermMemory', () => {
    it('should delete long-term memory', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await adapter.deleteLongTermMemory('mem-1');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/mem-1/'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('searchMemoryByQuery', () => {
    it('should search with category filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'John',
              categories: ['user_facts'],
              score: 0.95,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.searchMemoryByQuery('user name', {
        categories: ['fact'],
        limit: 5,
      });

      expect(results.length).toBe(1);
      expect(results[0]?.category).toBe('fact');
      expect(results[0]?.score).toBe(0.95);

      const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
      expect(body.filters.categories.in).toContain('user_facts');
      expect(body.top_k).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle timeout', async () => {
      const slowAdapter = new Mem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
        timeout: 100,
      });

      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200))
      );

      await expect(slowAdapter.getMemory('session-1')).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.getMemory('session-1')).rejects.toThrow(Mem0AdapterError);
    });
  });
});

describe('Mem0AdapterError', () => {
  it('should create error with all properties', () => {
    const error = new Mem0AdapterError('Test error', 404, '/v1/memories/');

    expect(error.name).toBe('Mem0AdapterError');
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(404);
    expect(error.path).toBe('/v1/memories/');
  });
});
