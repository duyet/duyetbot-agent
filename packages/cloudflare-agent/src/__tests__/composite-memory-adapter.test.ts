import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositeMemoryAdapter } from '../composite-memory-adapter.js';
import type {
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SessionInfo,
  ShortTermMemoryEntry,
} from '../memory-adapter.js';

// Create mock adapters
const createMockAdapter = (): MemoryAdapter => ({
  getMemory: vi.fn(),
  saveMemory: vi.fn(),
  searchMemory: vi.fn(),
  listSessions: vi.fn(),
  saveShortTermMemory: vi.fn(),
  getShortTermMemory: vi.fn(),
  listShortTermMemory: vi.fn(),
  deleteShortTermMemory: vi.fn(),
  saveLongTermMemory: vi.fn(),
  getLongTermMemory: vi.fn(),
  updateLongTermMemory: vi.fn(),
  deleteLongTermMemory: vi.fn(),
  searchMemoryByQuery: vi.fn(),
});

describe('CompositeMemoryAdapter', () => {
  let primary: MemoryAdapter;
  let secondary: MemoryAdapter;

  beforeEach(() => {
    primary = createMockAdapter();
    secondary = createMockAdapter();
  });

  describe('constructor', () => {
    it('should initialize with both adapters', () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });
      expect(adapter).toBeDefined();
    });

    it('should work without secondary adapter', () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        strategy: 'primary-first',
      });
      expect(adapter).toBeDefined();
    });
  });

  describe('getMemory - primary-first strategy', () => {
    it('should use primary for reads', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockData: MemoryData = {
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'test' }],
      };
      (primary.getMemory as any).mockResolvedValue(mockData);

      const result = await adapter.getMemory('session-1');

      expect(primary.getMemory).toHaveBeenCalled();
      expect(secondary.getMemory).not.toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should fallback to secondary when primary fails', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockData: MemoryData = {
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'from secondary' }],
      };
      (primary.getMemory as any).mockRejectedValue(new Error('Primary failed'));
      (secondary.getMemory as any).mockResolvedValue(mockData);

      const result = await adapter.getMemory('session-1');

      expect(result.messages[0]?.content).toBe('from secondary');
    });

    it('should fallback when primary returns empty', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      (primary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [],
      });
      (secondary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'from secondary' }],
      });

      const result = await adapter.getMemory('session-1');

      expect(result.messages[0]?.content).toBe('from secondary');
    });

    it('should throw when both fail', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      (primary.getMemory as any).mockRejectedValue(new Error('Primary failed'));
      (secondary.getMemory as any).mockRejectedValue(new Error('Secondary failed'));

      // When both fail, the error from secondary should bubble up
      await expect(adapter.getMemory('session-1')).rejects.toThrow('Secondary failed');
    });
  });

  describe('getMemory - parallel strategy', () => {
    it('should merge results from both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'from primary', timestamp: 1000 }],
      });
      (secondary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'assistant', content: 'from secondary', timestamp: 2000 }],
      });

      const result = await adapter.getMemory('session-1');

      expect(result.messages.length).toBe(2);
      // Should be sorted by timestamp
      expect(result.messages[0]?.content).toBe('from primary');
      expect(result.messages[1]?.content).toBe('from secondary');
    });

    it('should deduplicate messages by content', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'duplicate message', timestamp: 1000 }],
      });
      (secondary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'duplicate message', timestamp: 2000 }],
      });

      const result = await adapter.getMemory('session-1');

      expect(result.messages.length).toBe(1);
    });

    it('should apply limit option', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [
          { role: 'user', content: 'msg1', timestamp: 1000 },
          { role: 'user', content: 'msg2', timestamp: 2000 },
        ],
      });
      (secondary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'msg3', timestamp: 3000 }],
      });

      const result = await adapter.getMemory('session-1', { limit: 2 });

      expect(result.messages.length).toBe(2);
    });

    it('should merge metadata from both', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [],
        metadata: { source: 'primary' },
      });
      (secondary.getMemory as any).mockResolvedValue({
        sessionId: 'session-1',
        messages: [],
        metadata: { platform: 'telegram' },
      });

      const result = await adapter.getMemory('session-1');

      expect(result.metadata).toEqual({
        source: 'primary',
        platform: 'telegram',
      });
    });
  });

  describe('getMemory - mem0-for-search strategy', () => {
    it('should use primary only', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'mem0-for-search',
      });

      const mockData: MemoryData = {
        sessionId: 'session-1',
        messages: [{ role: 'user', content: 'test' }],
      };
      (primary.getMemory as any).mockResolvedValue(mockData);

      const result = await adapter.getMemory('session-1');

      expect(primary.getMemory).toHaveBeenCalled();
      expect(secondary.getMemory).not.toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });

  describe('saveMemory - all strategies', () => {
    it('should write to both adapters (primary sync, secondary async)', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.saveMemory as any).mockResolvedValue({
        savedCount: 1,
        sessionId: 'session-1',
        updatedAt: Date.now(),
      });
      (secondary.saveMemory as any).mockResolvedValue({
        savedCount: 1,
        sessionId: 'session-1',
        updatedAt: Date.now(),
      });

      const result = await adapter.saveMemory('session-1', [{ role: 'user', content: 'test' }]);

      expect(primary.saveMemory).toHaveBeenCalled();
      expect(result.savedCount).toBe(1);

      // Secondary is fire-and-forget, so we wait a tick
      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.saveMemory).toHaveBeenCalled();
    });

    it('should not fail if secondary fails', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      (primary.saveMemory as any).mockResolvedValue({
        savedCount: 1,
        sessionId: 'session-1',
        updatedAt: Date.now(),
      });
      (secondary.saveMemory as any).mockRejectedValue(new Error('Secondary failed'));

      const result = await adapter.saveMemory('session-1', [{ role: 'user', content: 'test' }]);

      expect(result.savedCount).toBe(1);

      await new Promise((r) => setTimeout(r, 10));
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should work without secondary', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        strategy: 'primary-first',
      });

      (primary.saveMemory as any).mockResolvedValue({
        savedCount: 1,
        sessionId: 'session-1',
        updatedAt: Date.now(),
      });

      const result = await adapter.saveMemory('session-1', [{ role: 'user', content: 'test' }]);

      expect(result.savedCount).toBe(1);
    });
  });

  describe('searchMemory', () => {
    it('should use secondary for mem0-for-search strategy', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'mem0-for-search',
      });

      const mockResults: MemorySearchResult[] = [
        {
          sessionId: 'session-1',
          message: { role: 'user', content: 'found' },
          score: 0.9,
        },
      ];
      (secondary.searchMemory as any).mockResolvedValue(mockResults);

      const results = await adapter.searchMemory('test');

      expect(secondary.searchMemory).toHaveBeenCalled();
      expect(primary.searchMemory).not.toHaveBeenCalled();
      expect(results).toEqual(mockResults);
    });

    it('should merge results for parallel strategy', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.searchMemory as any).mockResolvedValue([
        {
          sessionId: 'session-1',
          message: { role: 'user', content: 'from primary' },
          score: 0.8,
        },
      ]);
      (secondary.searchMemory as any).mockResolvedValue([
        {
          sessionId: 'session-1',
          message: { role: 'user', content: 'from secondary' },
          score: 0.9,
        },
      ]);

      const results = await adapter.searchMemory('test');

      expect(results.length).toBe(2);
      // Should be sorted by score (highest first)
      expect(results[0]?.score).toBe(0.9);
      expect(results[1]?.score).toBe(0.8);
    });

    it('should deduplicate by content', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.searchMemory as any).mockResolvedValue([
        {
          sessionId: 'session-1',
          message: { role: 'user', content: 'duplicate' },
          score: 0.8,
        },
      ]);
      (secondary.searchMemory as any).mockResolvedValue([
        {
          sessionId: 'session-1',
          message: { role: 'user', content: 'Duplicate' }, // Different case
          score: 0.9,
        },
      ]);

      const results = await adapter.searchMemory('test');

      expect(results.length).toBe(1);
      expect(results[0]?.score).toBe(0.9); // Higher score wins
    });

    it('should apply limit option', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.searchMemory as any).mockResolvedValue([
        { sessionId: 's1', message: { role: 'user', content: 'msg1' }, score: 0.8 },
        { sessionId: 's1', message: { role: 'user', content: 'msg2' }, score: 0.7 },
      ]);
      (secondary.searchMemory as any).mockResolvedValue([
        { sessionId: 's1', message: { role: 'user', content: 'msg3' }, score: 0.9 },
      ]);

      const results = await adapter.searchMemory('test', { limit: 2 });

      expect(results.length).toBe(2);
      expect(results[0]?.score).toBe(0.9);
      expect(results[1]?.score).toBe(0.8);
    });
  });

  describe('listSessions', () => {
    it('should use primary-first strategy', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockSessions: SessionInfo[] = [
        {
          id: 'session-1',
          title: 'Test',
          state: 'active',
          createdAt: 1000,
          updatedAt: 2000,
          messageCount: 5,
        },
      ];
      (primary.listSessions as any).mockResolvedValue({
        sessions: mockSessions,
        total: 1,
      });

      const result = await adapter.listSessions();

      expect(primary.listSessions).toHaveBeenCalled();
      expect(secondary.listSessions).not.toHaveBeenCalled();
      expect(result.sessions).toEqual(mockSessions);
    });

    it('should fallback to secondary on primary failure', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockSessions: SessionInfo[] = [
        {
          id: 'session-1',
          title: 'Test',
          state: 'active',
          createdAt: 1000,
          updatedAt: 2000,
          messageCount: 5,
        },
      ];
      (primary.listSessions as any).mockRejectedValue(new Error('Primary failed'));
      (secondary.listSessions as any).mockResolvedValue({
        sessions: mockSessions,
        total: 1,
      });

      const result = await adapter.listSessions();

      expect(result.sessions).toEqual(mockSessions);
    });

    it('should merge sessions for parallel strategy', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.listSessions as any).mockResolvedValue({
        sessions: [
          {
            id: 'session-1',
            title: 'Test 1',
            state: 'active',
            createdAt: 1000,
            updatedAt: 3000,
            messageCount: 5,
          },
        ],
        total: 1,
      });
      (secondary.listSessions as any).mockResolvedValue({
        sessions: [
          {
            id: 'session-1',
            title: 'Test 1',
            state: 'active',
            createdAt: 1000,
            updatedAt: 2000,
            messageCount: 3,
          },
          {
            id: 'session-2',
            title: 'Test 2',
            state: 'active',
            createdAt: 2000,
            updatedAt: 4000,
            messageCount: 2,
          },
        ],
        total: 2,
      });

      const result = await adapter.listSessions();

      // Should deduplicate by ID and keep most recent
      expect(result.sessions.length).toBe(2);
      expect(result.sessions[0]?.id).toBe('session-2'); // Most recent
      expect(result.sessions[1]?.id).toBe('session-1');
      expect(result.sessions[1]?.messageCount).toBe(5); // From primary (newer)
    });
  });

  describe('short-term memory operations', () => {
    it('should write to both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.saveShortTermMemory as any).mockResolvedValue({
        key: 'test-key',
        expiresAt: Date.now() + 3600000,
        success: true,
      });
      (secondary.saveShortTermMemory as any).mockResolvedValue({
        key: 'test-key',
        expiresAt: Date.now() + 3600000,
        success: true,
      });

      const result = await adapter.saveShortTermMemory('session-1', 'test-key', 'value', 3600);

      expect(primary.saveShortTermMemory).toHaveBeenCalled();
      expect(result.success).toBe(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.saveShortTermMemory).toHaveBeenCalled();
    });

    it('should retrieve from primary first', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockEntry: ShortTermMemoryEntry = {
        key: 'test-key',
        value: 'test-value',
        expiresAt: Date.now() + 3600000,
      };
      (primary.getShortTermMemory as any).mockResolvedValue(mockEntry);

      const result = await adapter.getShortTermMemory('session-1', 'test-key');

      expect(primary.getShortTermMemory).toHaveBeenCalled();
      expect(secondary.getShortTermMemory).not.toHaveBeenCalled();
      expect(result).toEqual(mockEntry);
    });

    it('should fallback to secondary for getShortTermMemory', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'primary-first',
      });

      const mockEntry: ShortTermMemoryEntry = {
        key: 'test-key',
        value: 'from secondary',
        expiresAt: Date.now() + 3600000,
      };
      (primary.getShortTermMemory as any).mockResolvedValue(null);
      (secondary.getShortTermMemory as any).mockResolvedValue(mockEntry);

      const result = await adapter.getShortTermMemory('session-1', 'test-key');

      expect(result?.value).toBe('from secondary');
    });

    it('should merge short-term memory lists', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.listShortTermMemory as any).mockResolvedValue([
        { key: 'key1', value: 'value1', expiresAt: 3000 },
      ]);
      (secondary.listShortTermMemory as any).mockResolvedValue([
        { key: 'key1', value: 'value1-old', expiresAt: 2000 },
        { key: 'key2', value: 'value2', expiresAt: 4000 },
      ]);

      const results = await adapter.listShortTermMemory('session-1');

      expect(results.length).toBe(2);
      // Should keep entry with later expiration
      const key1Entry = results.find((r) => r.key === 'key1');
      expect(key1Entry?.expiresAt).toBe(3000);
    });

    it('should delete from both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.deleteShortTermMemory as any).mockResolvedValue(true);
      (secondary.deleteShortTermMemory as any).mockResolvedValue(true);

      const result = await adapter.deleteShortTermMemory('session-1', 'test-key');

      expect(primary.deleteShortTermMemory).toHaveBeenCalled();
      expect(result).toBe(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.deleteShortTermMemory).toHaveBeenCalled();
    });
  });

  describe('long-term memory operations', () => {
    it('should write to both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.saveLongTermMemory as any).mockResolvedValue({
        id: 'mem-1',
        created: true,
        success: true,
      });
      (secondary.saveLongTermMemory as any).mockResolvedValue({
        id: 'mem-1',
        created: true,
        success: true,
      });

      const result = await adapter.saveLongTermMemory('fact', 'user-name', 'John', 0.8);

      expect(primary.saveLongTermMemory).toHaveBeenCalled();
      expect(result.success).toBe(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.saveLongTermMemory).toHaveBeenCalled();
    });

    it('should merge long-term memory results', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      const now = Date.now();
      (primary.getLongTermMemory as any).mockResolvedValue([
        {
          id: 'mem-1',
          category: 'fact',
          key: 'user-name',
          value: 'John',
          importance: 0.8,
          createdAt: now - 1000,
          updatedAt: now,
        },
      ]);
      (secondary.getLongTermMemory as any).mockResolvedValue([
        {
          id: 'mem-2',
          category: 'fact',
          key: 'user-name',
          value: 'John Doe',
          importance: 0.9,
          createdAt: now - 2000,
          updatedAt: now - 500,
        },
        {
          id: 'mem-3',
          category: 'preference',
          key: 'theme',
          value: 'dark',
          importance: 0.7,
          createdAt: now - 1000,
          updatedAt: now - 1000,
        },
      ]);

      const results = await adapter.getLongTermMemory();

      expect(results.length).toBe(2);
      // Should deduplicate by category:key and keep most recent
      const nameEntry = results.find((r) => r.key === 'user-name');
      expect(nameEntry?.value).toBe('John'); // From primary (more recent)
      expect(nameEntry?.importance).toBe(0.8);
    });

    it('should update in both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.updateLongTermMemory as any).mockResolvedValue(true);
      (secondary.updateLongTermMemory as any).mockResolvedValue(true);

      const result = await adapter.updateLongTermMemory('mem-1', { value: 'updated' });

      expect(primary.updateLongTermMemory).toHaveBeenCalled();
      expect(result).toBe(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.updateLongTermMemory).toHaveBeenCalled();
    });

    it('should delete from both adapters', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.deleteLongTermMemory as any).mockResolvedValue(true);
      (secondary.deleteLongTermMemory as any).mockResolvedValue(true);

      const result = await adapter.deleteLongTermMemory('mem-1');

      expect(primary.deleteLongTermMemory).toHaveBeenCalled();
      expect(result).toBe(true);

      await new Promise((r) => setTimeout(r, 10));
      expect(secondary.deleteLongTermMemory).toHaveBeenCalled();
    });
  });

  describe('searchMemoryByQuery', () => {
    it('should use secondary for mem0-for-search strategy', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'mem0-for-search',
      });

      const mockResults = [{ id: 'mem-1', content: 'test', category: 'fact', score: 0.9 }];
      (secondary.searchMemoryByQuery as any).mockResolvedValue(mockResults);

      const results = await adapter.searchMemoryByQuery('test');

      expect(secondary.searchMemoryByQuery).toHaveBeenCalled();
      expect(primary.searchMemoryByQuery).not.toHaveBeenCalled();
      expect(results).toEqual(mockResults);
    });

    it('should merge and deduplicate results', async () => {
      const adapter = new CompositeMemoryAdapter({
        primary,
        secondary,
        strategy: 'parallel',
      });

      (primary.searchMemoryByQuery as any).mockResolvedValue([
        { id: 'mem-1', content: 'test content', category: 'fact', score: 0.8 },
      ]);
      (secondary.searchMemoryByQuery as any).mockResolvedValue([
        { id: 'mem-2', content: 'Test Content', category: 'fact', score: 0.9 },
        { id: 'mem-3', content: 'other', category: 'note', score: 0.7 },
      ]);

      const results = await adapter.searchMemoryByQuery('test');

      // Should deduplicate by content (case-insensitive) and sort by score
      expect(results.length).toBe(2);
      expect(results[0]?.score).toBe(0.9);
      expect(results[1]?.score).toBe(0.7);
    });
  });
});
