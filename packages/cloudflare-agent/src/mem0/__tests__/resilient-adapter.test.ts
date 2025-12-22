import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResilientMem0MemoryAdapter } from '../resilient-adapter.js';

describe('ResilientMem0MemoryAdapter', () => {
  let adapter: ResilientMem0MemoryAdapter;
  const mockFetch = vi.fn();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    adapter = new ResilientMem0MemoryAdapter({
      apiKey: 'test-key',
      userId: 'test-user',
      initTimeout: 100,
    });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default timeout', () => {
      const adapter = new ResilientMem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
      });
      expect(adapter).toBeDefined();
    });

    it('should accept custom init timeout', () => {
      const adapter = new ResilientMem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'user-1',
        initTimeout: 5000,
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('availability checking', () => {
    it('should check availability on first call', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await adapter.getMemory('session-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/memories/'),
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should cache availability checks', async () => {
      // First call: availability check
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Second call: first getMemory
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
      // Third call: second getMemory (availability is cached)
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });

      await adapter.getMemory('session-1');
      await adapter.getMemory('session-2');

      // Should make 3 calls (1 availability check + 2 getMemory calls)
      // Second getMemory reuses cached availability
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should mark as unavailable on timeout', async () => {
      mockFetch.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 200))
      );

      const result = await adapter.getMemory('session-1');

      expect(result.messages).toEqual([]);
    });

    it('should mark as unavailable on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.getMemory('session-1');

      expect(result.messages).toEqual([]);
    });

    it('should consider 401 as available', async () => {
      // First call: availability check returns 401 (marked as available)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      // Second call: actual getMemory call (will also fail but gracefully)
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) });

      // This should mark as available (server is up but auth failed)
      const result1 = await adapter.getMemory('session-1');
      expect(result1.messages).toEqual([]); // Graceful degradation

      // Next call should reuse cached availability and try to use the adapter
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) });
      await adapter.getMemory('session-2');

      // Total: 3 calls (1 availability check + 2 getMemory calls)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('graceful degradation - getMemory', () => {
    it('should return empty data when unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.getMemory('session-1');

      expect(result.messages).toEqual([]);
      expect(result.sessionId).toBe('session-1');
      expect(result.metadata).toEqual({});
    });

    it('should return empty data when API fails', async () => {
      // First call: availability check passes
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Second call: actual getMemory fails
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const result = await adapter.getMemory('session-1');

      expect(result.messages).toEqual([]);
    });

    it('should pass through successful responses', async () => {
      // First call: availability check
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Second call: actual getMemory
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test',
              user_id: 'test-user',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result = await adapter.getMemory('session-1');

      expect(result.sessionId).toBe('session-1');
      expect(result.messages.length).toBe(1);
    });
  });

  describe('graceful degradation - saveMemory', () => {
    it('should return zero count when unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.saveMemory('session-1', [
        { role: 'user', content: 'test' },
      ]);

      expect(result.savedCount).toBe(0);
      expect(result.sessionId).toBe('session-1');
    });

    it('should return zero count when API fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      const result = await adapter.saveMemory('session-1', [
        { role: 'user', content: 'test' },
      ]);

      expect(result.savedCount).toBe(0);
    });

    it('should pass through successful saves', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 'mem-1', event: 'ADD', data: { memory: 'test' } }],
        }),
      });

      const result = await adapter.saveMemory('session-1', [
        { role: 'user', content: 'test' },
      ]);

      expect(result.savedCount).toBe(1);
    });
  });

  describe('graceful degradation - searchMemory', () => {
    it('should return empty array when unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await adapter.searchMemory('test');

      expect(results).toEqual([]);
    });

    it('should pass through successful searches', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test',
              score: 0.9,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.searchMemory('test');

      expect(results.length).toBe(1);
    });
  });

  describe('graceful degradation - listSessions', () => {
    it('should return empty list when unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.listSessions();

      expect(result.sessions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('graceful degradation - short-term memory', () => {
    it('should return failure result for saveShortTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.saveShortTermMemory('session-1', 'key', 'value', 3600);

      expect(result.success).toBe(false);
      expect(result.key).toBe('key');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should return null for getShortTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.getShortTermMemory('session-1', 'key');

      expect(result).toBeNull();
    });

    it('should return empty array for listShortTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await adapter.listShortTermMemory('session-1');

      expect(results).toEqual([]);
    });

    it('should return false for deleteShortTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.deleteShortTermMemory('session-1', 'key');

      expect(result).toBe(false);
    });
  });

  describe('graceful degradation - long-term memory', () => {
    it('should return failure result for saveLongTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.saveLongTermMemory('fact', 'key', 'value');

      expect(result.success).toBe(false);
      expect(result.created).toBe(false);
      expect(result.id).toMatch(/^local-/);
    });

    it('should return empty array for getLongTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await adapter.getLongTermMemory();

      expect(results).toEqual([]);
    });

    it('should return false for updateLongTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.updateLongTermMemory('mem-1', { value: 'updated' });

      expect(result).toBe(false);
    });

    it('should return false for deleteLongTermMemory', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await adapter.deleteLongTermMemory('mem-1');

      expect(result).toBe(false);
    });
  });

  describe('graceful degradation - searchMemoryByQuery', () => {
    it('should return empty array when unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const results = await adapter.searchMemoryByQuery('test query');

      expect(results).toEqual([]);
    });

    it('should pass through successful queries', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'test',
              categories: ['user_facts'],
              score: 0.9,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const results = await adapter.searchMemoryByQuery('test query');

      expect(results.length).toBe(1);
    });
  });

  describe('error logging', () => {
    it('should log warnings on failures', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({ ok: true });
      mockFetch.mockRejectedValueOnce(new Error('API error'));

      await adapter.getMemory('session-1');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Mem0 getMemory failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('successful operations after recovery', () => {
    it('should work after service recovers', async () => {
      // First call: service is down
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result1 = await adapter.getMemory('session-1');
      expect(result1.messages).toEqual([]);

      // Wait for cache to expire (simulate time passing)
      // In real scenario, wait 60s. For test, we'll reset the adapter
      adapter = new ResilientMem0MemoryAdapter({
        apiKey: 'test-key',
        userId: 'test-user',
        initTimeout: 100,
      });

      // Second call: service is up
      // First: availability check
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Second: actual getMemory
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'mem-1',
              memory: 'recovered',
              user_id: 'test-user',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        }),
      });

      const result2 = await adapter.getMemory('session-2');
      expect(result2.messages.length).toBe(1);
    });
  });
});
