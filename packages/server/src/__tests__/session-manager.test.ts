import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSessionManager, AgentSession } from '../session-manager.js';

describe('AgentSessionManager', () => {
  let manager: AgentSessionManager;

  beforeEach(() => {
    manager = new AgentSessionManager();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await manager.createSession({
        userId: 'user-123',
      });

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user-123');
      expect(session.state).toBe('active');
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should create session with initial messages', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const session = await manager.createSession({
        userId: 'user-123',
        messages,
      });

      expect(session.messages).toEqual(messages);
    });

    it('should create session with metadata', async () => {
      const session = await manager.createSession({
        userId: 'user-123',
        metadata: { source: 'github' },
      });

      expect(session.metadata?.source).toBe('github');
    });
  });

  describe('getSession', () => {
    it('should get an existing session', async () => {
      const created = await manager.createSession({ userId: 'user-123' });
      const retrieved = await manager.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', async () => {
      const result = await manager.getSession('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update session messages', async () => {
      const session = await manager.createSession({ userId: 'user-123' });
      const newMessages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi!' },
      ];

      const updated = await manager.updateSession(session.id, {
        messages: newMessages,
      });

      expect(updated.messages).toEqual(newMessages);
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(session.createdAt.getTime());
    });

    it('should update session state', async () => {
      const session = await manager.createSession({ userId: 'user-123' });
      const updated = await manager.updateSession(session.id, { state: 'paused' });

      expect(updated.state).toBe('paused');
    });

    it('should throw for non-existent session', async () => {
      await expect(
        manager.updateSession('non-existent', { state: 'paused' })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const session = await manager.createSession({ userId: 'user-123' });
      await manager.deleteSession(session.id);

      const result = await manager.getSession(session.id);
      expect(result).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should list all sessions for a user', async () => {
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-2' });

      const sessions = await manager.listSessions('user-1');
      expect(sessions).toHaveLength(2);
    });

    it('should filter by state', async () => {
      const session1 = await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-1' });

      await manager.updateSession(session1.id, { state: 'completed' });

      const active = await manager.listSessions('user-1', { state: 'active' });
      expect(active).toHaveLength(1);

      const completed = await manager.listSessions('user-1', { state: 'completed' });
      expect(completed).toHaveLength(1);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return count of active sessions', async () => {
      await manager.createSession({ userId: 'user-1' });
      await manager.createSession({ userId: 'user-2' });
      const session3 = await manager.createSession({ userId: 'user-3' });

      await manager.updateSession(session3.id, { state: 'completed' });

      expect(manager.getActiveSessionCount()).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should remove expired sessions', async () => {
      const session = await manager.createSession({ userId: 'user-1' });

      // Manually set session as old
      const retrieved = await manager.getSession(session.id);
      if (retrieved) {
        retrieved.updatedAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day old
      }

      await manager.cleanup({ maxAge: 1000 }); // 1 second max age

      const result = await manager.getSession(session.id);
      expect(result).toBeUndefined();
    });

    it('should not remove recent sessions', async () => {
      const session = await manager.createSession({ userId: 'user-1' });

      await manager.cleanup({ maxAge: 60 * 60 * 1000 }); // 1 hour max age

      const result = await manager.getSession(session.id);
      expect(result).toBeDefined();
    });
  });
});
