/**
 * Tests for MessageStore
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryMessagePersistence } from '../../adapters/message-persistence/memory-persistence.js';
import type { IMessagePersistence, SessionId } from '../../adapters/message-persistence/types.js';
import type { Message } from '../../types.js';
import { MessageStore } from '../message-store.js';

describe('MessageStore', () => {
  const testSessionId: SessionId = {
    platform: 'telegram',
    userId: '123456789',
    chatId: '-1001234567890',
  };

  const testMessages: Message[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
    { role: 'assistant', content: "I'm doing well, thank you!" },
  ];

  describe('constructor', () => {
    it('should create store with adapter', () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      expect(store.isEnabled()).toBe(true);
    });

    it('should create store without adapter (null)', () => {
      const store = new MessageStore(null);

      expect(store.isEnabled()).toBe(false);
    });
  });

  describe('load', () => {
    it('should load messages from adapter', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // Pre-populate adapter
      adapter.persistMessages(testSessionId, testMessages);

      const messages = await store.load(testSessionId, 10);

      expect(messages).toEqual(testMessages);
    });

    it('should return empty array when no messages exist', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      const messages = await store.load(testSessionId, 10);

      expect(messages).toEqual([]);
    });

    it('should respect maxHistory limit', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      adapter.persistMessages(testSessionId, testMessages);

      const messages = await store.load(testSessionId, 2);

      expect(messages).toHaveLength(2);
      // Should return most recent messages
      expect(messages).toEqual(testMessages.slice(-2));
    });

    it('should return empty array when persistence disabled', async () => {
      const store = new MessageStore(null);

      const messages = await store.load(testSessionId, 10);

      expect(messages).toEqual([]);
    });

    it('should handle adapter errors gracefully', async () => {
      const mockAdapter: IMessagePersistence = {
        loadMessages: vi.fn().mockRejectedValue(new Error('Load failed')),
        persistMessages: vi.fn(),
        persistCommand: vi.fn(),
        clearMessages: vi.fn(),
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const store = new MessageStore(mockAdapter);

      const messages = await store.load(testSessionId, 10);

      expect(messages).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[MessageStore] Failed to load messages',
        expect.objectContaining({
          sessionId: testSessionId,
          error: 'Load failed',
        })
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('persist', () => {
    it('should persist messages through adapter', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      store.persist(testSessionId, testMessages, 'evt_123');

      // Verify through adapter directly
      const loaded = await adapter.loadMessages(testSessionId, 10);
      expect(loaded).toEqual(testMessages);
    });

    it('should be fire-and-forget (non-blocking)', () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // Should return immediately without waiting
      const result = store.persist(testSessionId, testMessages);

      expect(result).toBeUndefined();
    });

    it('should do nothing when persistence disabled', async () => {
      const store = new MessageStore(null);

      // Should not throw
      store.persist(testSessionId, testMessages);

      // No way to verify since there's no adapter, but shouldn't error
      expect(store.isEnabled()).toBe(false);
    });

    it('should pass eventId to adapter', async () => {
      const adapter = new MemoryMessagePersistence();
      const persistSpy = vi.spyOn(adapter, 'persistMessages');
      const store = new MessageStore(adapter);

      store.persist(testSessionId, testMessages, 'evt_test_123');

      expect(persistSpy).toHaveBeenCalledWith(testSessionId, testMessages, 'evt_test_123');
    });

    it('should replace existing messages', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // First persist
      store.persist(testSessionId, testMessages);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Give time for async operation

      const loaded1 = await adapter.loadMessages(testSessionId, 10);
      expect(loaded1).toHaveLength(4);

      // Second persist with different messages
      const newMessages: Message[] = [{ role: 'user', content: 'New message' }];
      store.persist(testSessionId, newMessages);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Give time for async operation

      const loaded2 = await adapter.loadMessages(testSessionId, 10);
      expect(loaded2).toEqual(newMessages);
    });
  });

  describe('persistCommand', () => {
    it('should persist command and response', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      store.persistCommand(testSessionId, '/help', 'Available commands: ...', 'evt_123');

      // Give time for async fire-and-forget operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      const loaded = await adapter.loadMessages(testSessionId, 10);
      expect(loaded).toEqual([
        { role: 'user', content: '/help' },
        { role: 'assistant', content: 'Available commands: ...' },
      ]);
    });

    it('should append to existing messages', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // First persist some messages
      adapter.persistMessages(testSessionId, testMessages);

      // Then persist a command
      store.persistCommand(testSessionId, '/status', 'Status: OK');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const loaded = await adapter.loadMessages(testSessionId, 10);
      expect(loaded).toHaveLength(6); // 4 original + 2 command messages
      expect(loaded.slice(-2)).toEqual([
        { role: 'user', content: '/status' },
        { role: 'assistant', content: 'Status: OK' },
      ]);
    });

    it('should be fire-and-forget (non-blocking)', () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // Should return immediately without waiting
      const result = store.persistCommand(testSessionId, '/test', 'Test response');

      expect(result).toBeUndefined();
    });

    it('should do nothing when persistence disabled', () => {
      const store = new MessageStore(null);

      // Should not throw
      store.persistCommand(testSessionId, '/test', 'Test response');

      expect(store.isEnabled()).toBe(false);
    });

    it('should pass eventId to adapter', () => {
      const adapter = new MemoryMessagePersistence();
      const persistSpy = vi.spyOn(adapter, 'persistCommand');
      const store = new MessageStore(adapter);

      store.persistCommand(testSessionId, '/test', 'Response', 'evt_cmd_123');

      expect(persistSpy).toHaveBeenCalledWith(testSessionId, '/test', 'Response', 'evt_cmd_123');
    });
  });

  // Note: clear() method intentionally removed
  // The clearHistory() method in CloudflareAgent only clears DO state,
  // not D1 messages (which are kept as archive).

  describe('isEnabled', () => {
    it('should return true when adapter is available', () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      expect(store.isEnabled()).toBe(true);
    });

    it('should return false when adapter is null', () => {
      const store = new MessageStore(null);

      expect(store.isEnabled()).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should support full message lifecycle', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      // 1. Load (should be empty)
      const initial = await store.load(testSessionId, 10);
      expect(initial).toEqual([]);

      // 2. Persist messages
      store.persist(testSessionId, testMessages);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 3. Load again
      const loaded = await store.load(testSessionId, 10);
      expect(loaded).toEqual(testMessages);

      // 4. Add command
      store.persistCommand(testSessionId, '/clear', 'Clearing messages');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const withCommand = await store.load(testSessionId, 10);
      expect(withCommand).toHaveLength(6);

      // Note: clearMessages removed - see MessageStore comments
    });

    it('should handle multiple sessions independently', async () => {
      const adapter = new MemoryMessagePersistence();
      const store = new MessageStore(adapter);

      const session1: SessionId = { platform: 'telegram', userId: '1', chatId: '1' };
      const session2: SessionId = { platform: 'telegram', userId: '2', chatId: '2' };

      // Persist to different sessions
      store.persist(session1, [{ role: 'user', content: 'Session 1' }]);
      store.persist(session2, [{ role: 'user', content: 'Session 2' }]);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Load from each session
      const messages1 = await store.load(session1, 10);
      const messages2 = await store.load(session2, 10);

      expect(messages1).toEqual([{ role: 'user', content: 'Session 1' }]);
      expect(messages2).toEqual([{ role: 'user', content: 'Session 2' }]);
    });
  });
});
