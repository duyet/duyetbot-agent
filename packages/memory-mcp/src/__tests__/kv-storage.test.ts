import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KVStorage } from '../storage/kv.js';
import type { LLMMessage } from '../types.js';

// Mock KV namespace
function createMockKV() {
  const data = new Map<string, { value: string; metadata?: Record<string, unknown> }>();

  return {
    get: vi.fn(async (key: string, _type?: string) => {
      const entry = data.get(key);
      if (!entry) {
        return null;
      }
      return entry.value;
    }),
    put: vi.fn(
      async (key: string, value: string, options?: { metadata?: Record<string, unknown> }) => {
        data.set(key, { value, metadata: options?.metadata });
      }
    ),
    delete: vi.fn(async (key: string) => {
      data.delete(key);
    }),
    getWithMetadata: vi.fn(async (key: string) => {
      const entry = data.get(key);
      if (!entry) {
        return { value: null, metadata: null };
      }
      return { value: entry.value, metadata: entry.metadata };
    }),
    _data: data,
  };
}

describe('KVStorage', () => {
  let storage: KVStorage;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
    storage = new KVStorage(mockKV as any);
  });

  describe('getMessages', () => {
    it('should return empty array for non-existent session', async () => {
      const messages = await storage.getMessages('nonexistent');
      expect(messages).toEqual([]);
    });

    it('should return messages from KV', async () => {
      const testMessages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];
      const jsonl = testMessages.map((m) => JSON.stringify(m)).join('\n');
      mockKV._data.set('sessions:sess_123:messages', { value: jsonl });

      const messages = await storage.getMessages('sess_123');
      expect(messages).toEqual(testMessages);
    });

    it('should handle empty lines in JSONL', async () => {
      const jsonl = '{"role":"user","content":"Hello"}\n\n{"role":"assistant","content":"Hi"}';
      mockKV._data.set('sessions:sess_123:messages', { value: jsonl });

      const messages = await storage.getMessages('sess_123');
      expect(messages).toHaveLength(2);
    });
  });

  describe('saveMessages', () => {
    it('should save messages as JSONL', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      const count = await storage.saveMessages('sess_123', messages);
      expect(count).toBe(2);
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should save with metadata', async () => {
      const messages: LLMMessage[] = [{ role: 'user', content: 'Test' }];

      await storage.saveMessages('sess_123', messages);

      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[2]?.metadata?.message_count).toBe(1);
    });
  });

  describe('appendMessages', () => {
    it('should append to existing messages', async () => {
      const existing: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const jsonl = existing.map((m) => JSON.stringify(m)).join('\n');
      mockKV._data.set('sessions:sess_123:messages', { value: jsonl });

      const newMessages: LLMMessage[] = [{ role: 'assistant', content: 'Hi!' }];
      const count = await storage.appendMessages('sess_123', newMessages);

      expect(count).toBe(2);
    });

    it('should work with empty existing messages', async () => {
      const newMessages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];
      const count = await storage.appendMessages('sess_new', newMessages);
      expect(count).toBe(1);
    });
  });

  describe('deleteMessages', () => {
    it('should delete messages for session', async () => {
      mockKV._data.set('sessions:sess_123:messages', { value: '{}' });
      await storage.deleteMessages('sess_123');
      expect(mockKV.delete).toHaveBeenCalledWith('sessions:sess_123:messages');
    });
  });

  describe('getMessageCount', () => {
    it('should return count from metadata', async () => {
      mockKV._data.set('sessions:sess_123:messages', {
        value: '{}',
        metadata: { message_count: 5 },
      });

      const count = await storage.getMessageCount('sess_123');
      expect(count).toBe(5);
    });

    it('should count messages if no metadata', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ];
      const jsonl = messages.map((m) => JSON.stringify(m)).join('\n');
      mockKV._data.set('sessions:sess_123:messages', { value: jsonl });

      const count = await storage.getMessageCount('sess_123');
      expect(count).toBe(2);
    });

    it('should return 0 for non-existent session', async () => {
      const count = await storage.getMessageCount('nonexistent');
      expect(count).toBe(0);
    });
  });
});
