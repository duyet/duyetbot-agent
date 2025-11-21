import { beforeEach, describe, expect, it } from 'vitest';
import {
  InMemorySessionManager,
  type Session,
  SessionError,
  type SessionState,
} from '../agent/session.js';

describe('InMemorySessionManager', () => {
  let manager: InMemorySessionManager;

  beforeEach(() => {
    manager = new InMemorySessionManager();
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const session = await manager.create({});

      expect(session.id).toBeDefined();
      expect(session.state).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should create session with provider config', async () => {
      const session = await manager.create({
        provider: {
          provider: 'claude',
          model: 'claude-3-5-sonnet',
          apiKey: 'test-key',
        },
      });

      expect(session.provider?.provider).toBe('claude');
      expect(session.provider?.model).toBe('claude-3-5-sonnet');
    });

    it('should create session with messages', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const session = await manager.create({ messages });

      expect(session.messages).toEqual(messages);
    });

    it('should create session with metadata', async () => {
      const session = await manager.create({
        metadata: { foo: 'bar', count: 42 },
      });

      expect(session.metadata?.foo).toBe('bar');
      expect(session.metadata?.count).toBe(42);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await manager.create({});
      const session2 = await manager.create({});
      const session3 = await manager.create({});

      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session1.id).not.toBe(session3.id);
    });
  });

  describe('get', () => {
    it('should get an existing session', async () => {
      const created = await manager.create({});
      const retrieved = await manager.get(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent session', async () => {
      const result = await manager.get('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update session state', async () => {
      const session = await manager.create({});
      const updated = await manager.update(session.id, { state: 'paused' });

      expect(updated.state).toBe('paused');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(session.updatedAt.getTime());
    });

    it('should update session messages', async () => {
      const session = await manager.create({});
      const messages = [{ role: 'user' as const, content: 'Updated' }];
      const updated = await manager.update(session.id, { messages });

      expect(updated.messages).toEqual(messages);
    });

    it('should update session metadata', async () => {
      const session = await manager.create({ metadata: { a: 1 } });
      const updated = await manager.update(session.id, {
        metadata: { b: 2 },
      });

      expect(updated.metadata).toEqual({ b: 2 });
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.update('non-existent', { state: 'paused' })).rejects.toThrow(
        SessionError
      );
    });
  });

  describe('delete', () => {
    it('should delete a session', async () => {
      const session = await manager.create({});
      await manager.delete(session.id);

      const result = await manager.get(session.id);
      expect(result).toBeUndefined();
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(manager.delete('non-existent')).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list all sessions', async () => {
      await manager.create({});
      await manager.create({});
      await manager.create({});

      const sessions = await manager.list();
      expect(sessions).toHaveLength(3);
    });

    it('should filter by state', async () => {
      const session1 = await manager.create({});
      await manager.create({});
      await manager.pause(session1.id);

      const paused = await manager.list({ state: 'paused' });
      expect(paused).toHaveLength(1);
      expect(paused[0].id).toBe(session1.id);

      const active = await manager.list({ state: 'active' });
      expect(active).toHaveLength(1);
    });

    it('should filter by metadata', async () => {
      await manager.create({ metadata: { type: 'chat' } });
      await manager.create({ metadata: { type: 'task' } });
      await manager.create({ metadata: { type: 'chat' } });

      const chats = await manager.list({ metadata: { type: 'chat' } });
      expect(chats).toHaveLength(2);
    });

    it('should return empty array when no sessions', async () => {
      const sessions = await manager.list();
      expect(sessions).toEqual([]);
    });
  });

  describe('pause', () => {
    it('should pause an active session', async () => {
      const session = await manager.create({});
      const paused = await manager.pause(session.id);

      expect(paused.state).toBe('paused');
    });

    it('should set resume token when provided', async () => {
      const session = await manager.create({});
      const paused = await manager.pause(session.id, 'token-123');

      expect(paused.resumeToken).toBe('token-123');
    });

    it('should throw error when pausing non-active session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      await expect(manager.pause(session.id)).rejects.toThrow('Cannot pause session');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.pause('non-existent')).rejects.toThrow(SessionError);
    });
  });

  describe('resume', () => {
    it('should resume a paused session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);
      const resumed = await manager.resume(session.id);

      expect(resumed.state).toBe('active');
    });

    it('should clear resume token when resuming', async () => {
      const session = await manager.create({});
      await manager.pause(session.id, 'token-123');
      const resumed = await manager.resume(session.id);

      expect(resumed.resumeToken).toBeUndefined();
    });

    it('should throw error when resuming non-paused session', async () => {
      const session = await manager.create({});

      await expect(manager.resume(session.id)).rejects.toThrow('Cannot resume session');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.resume('non-existent')).rejects.toThrow(SessionError);
    });
  });

  describe('complete', () => {
    it('should complete an active session', async () => {
      const session = await manager.create({});
      const completed = await manager.complete(session.id);

      expect(completed.state).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('should throw error when completing non-active session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      await expect(manager.complete(session.id)).rejects.toThrow('Cannot complete session');
    });

    it('should throw error when already completed', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(manager.complete(session.id)).rejects.toThrow('already completed');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.complete('non-existent')).rejects.toThrow(SessionError);
    });
  });

  describe('fail', () => {
    it('should fail an active session', async () => {
      const session = await manager.create({});
      const error = { message: 'Test error', code: 'TEST_ERROR' };
      const failed = await manager.fail(session.id, error);

      expect(failed.state).toBe('failed');
      expect(failed.error).toEqual(error);
    });

    it('should include error details', async () => {
      const session = await manager.create({});
      const error = {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { reason: 'testing' },
      };
      const failed = await manager.fail(session.id, error);

      expect(failed.error?.details).toEqual({ reason: 'testing' });
    });

    it('should throw error when failing non-active session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      await expect(manager.fail(session.id, { message: 'error', code: 'ERR' })).rejects.toThrow(
        'Cannot fail session'
      );
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.fail('non-existent', { message: 'error', code: 'ERR' })).rejects.toThrow(
        SessionError
      );
    });
  });

  describe('cancel', () => {
    it('should cancel an active session', async () => {
      const session = await manager.create({});
      const cancelled = await manager.cancel(session.id);

      expect(cancelled.state).toBe('cancelled');
    });

    it('should cancel a paused session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);
      const cancelled = await manager.cancel(session.id);

      expect(cancelled.state).toBe('cancelled');
    });

    it('should throw error when cancelling completed session', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(manager.cancel(session.id)).rejects.toThrow('Cannot cancel session');
    });

    it('should throw error when cancelling failed session', async () => {
      const session = await manager.create({});
      await manager.fail(session.id, { message: 'error', code: 'ERR' });

      await expect(manager.cancel(session.id)).rejects.toThrow('Cannot cancel session');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.cancel('non-existent')).rejects.toThrow(SessionError);
    });
  });
});

describe('SessionError', () => {
  it('should create error with message and code', () => {
    const error = new SessionError('Test message', 'TEST_CODE');

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('SessionError');
  });

  it('should include details when provided', () => {
    const error = new SessionError('Test', 'CODE', { extra: 'data' });

    expect(error.details).toEqual({ extra: 'data' });
  });

  it('should be an instance of Error', () => {
    const error = new SessionError('Test', 'CODE');
    expect(error).toBeInstanceOf(Error);
  });
});
