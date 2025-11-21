/**
 * Session Manager Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  TelegramSessionManager,
  createTelegramSessionId,
  parseSessionId,
} from './session-manager.js';

describe('Session Manager', () => {
  describe('createTelegramSessionId', () => {
    it('should create session ID for user', () => {
      const sessionId = createTelegramSessionId(123456);
      expect(sessionId).toBe('telegram:123456');
    });

    it('should handle large user IDs', () => {
      const sessionId = createTelegramSessionId(9999999999);
      expect(sessionId).toBe('telegram:9999999999');
    });
  });

  describe('parseSessionId', () => {
    it('should parse valid session ID', () => {
      const result = parseSessionId('telegram:123456');
      expect(result).toEqual({
        type: 'telegram',
        userId: 123456,
      });
    });

    it('should return null for invalid format', () => {
      expect(parseSessionId('invalid')).toBeNull();
      expect(parseSessionId('telegram:')).toBeNull();
      expect(parseSessionId('github:123456')).toBeNull();
    });
  });

  describe('TelegramSessionManager', () => {
    let manager: TelegramSessionManager;

    beforeEach(() => {
      manager = new TelegramSessionManager();
    });

    describe('getSession', () => {
      it('should create new session for user', async () => {
        const session = await manager.getSession(123456, {
          username: 'testuser',
          firstName: 'Test',
        });

        expect(session.userId).toBe(123456);
        expect(session.username).toBe('testuser');
        expect(session.firstName).toBe('Test');
        expect(session.sessionId).toBe('telegram:123456');
        expect(session.messageCount).toBe(0);
      });

      it('should return existing session', async () => {
        const session1 = await manager.getSession(123456);
        const session2 = await manager.getSession(123456);

        expect(session1.sessionId).toBe(session2.sessionId);
        expect(session1.createdAt).toBe(session2.createdAt);
      });
    });

    describe('saveMessages and getMessages', () => {
      it('should save and retrieve messages', async () => {
        const sessionId = 'telegram:123456';
        const messages = [
          { role: 'user' as const, content: 'Hello' },
          { role: 'assistant' as const, content: 'Hi there!' },
        ];

        await manager.saveMessages(sessionId, messages);
        const retrieved = await manager.getMessages(sessionId);

        expect(retrieved).toHaveLength(2);
        expect(retrieved[0].content).toBe('Hello');
        expect(retrieved[1].content).toBe('Hi there!');
      });

      it('should append messages', async () => {
        const sessionId = 'telegram:123456';

        await manager.saveMessages(sessionId, [{ role: 'user' as const, content: 'First' }]);
        await manager.saveMessages(sessionId, [{ role: 'assistant' as const, content: 'Second' }]);

        const retrieved = await manager.getMessages(sessionId);
        expect(retrieved).toHaveLength(2);
      });

      it('should return empty array for non-existent session', async () => {
        const messages = await manager.getMessages('telegram:999');
        expect(messages).toEqual([]);
      });
    });

    describe('searchMemory', () => {
      it('should search local messages', async () => {
        const sessionId = 'telegram:123456';
        await manager.saveMessages(sessionId, [
          { role: 'user' as const, content: 'How to implement rate limiting' },
          { role: 'assistant' as const, content: 'You can use a token bucket algorithm' },
        ]);

        const results = await manager.searchMemory('rate limiting');
        expect(results).toHaveLength(1);
        expect(results[0].message.content).toContain('rate limiting');
      });

      it('should respect limit', async () => {
        const sessionId = 'telegram:123456';
        await manager.saveMessages(sessionId, [
          { role: 'user' as const, content: 'test message 1' },
          { role: 'user' as const, content: 'test message 2' },
          { role: 'user' as const, content: 'test message 3' },
        ]);

        const results = await manager.searchMemory('test', 2);
        expect(results.length).toBeLessThanOrEqual(2);
      });
    });

    describe('listSessions', () => {
      it('should list all sessions', async () => {
        await manager.getSession(111);
        await manager.getSession(222);
        await manager.getSession(333);

        const sessions = await manager.listSessions();
        expect(sessions).toHaveLength(3);
      });

      it('should sort by updatedAt', async () => {
        await manager.getSession(111);
        await manager.getSession(222);

        // Wait a bit then update second session to ensure different timestamps
        await new Promise((resolve) => setTimeout(resolve, 10));
        await manager.saveMessages('telegram:222', [{ role: 'user' as const, content: 'Hello' }]);

        const sessions = await manager.listSessions();
        expect(sessions[0].userId).toBe(222);
      });
    });

    describe('clearSession', () => {
      it('should clear session history', async () => {
        const userId = 123456;
        const sessionId = createTelegramSessionId(userId);

        await manager.getSession(userId);
        await manager.saveMessages(sessionId, [{ role: 'user' as const, content: 'Hello' }]);

        await manager.clearSession(userId);
        const messages = await manager.getMessages(sessionId);

        expect(messages).toHaveLength(0);
      });

      it('should reset message count', async () => {
        const userId = 123456;
        const sessionId = createTelegramSessionId(userId);

        const session = await manager.getSession(userId);
        await manager.saveMessages(sessionId, [{ role: 'user' as const, content: 'Hello' }]);

        await manager.clearSession(userId);
        const updatedSession = await manager.getSession(userId);

        expect(updatedSession.messageCount).toBe(0);
      });
    });
  });
});
