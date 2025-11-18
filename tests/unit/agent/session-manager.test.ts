import { InMemorySessionManager, SessionError } from '@/agent/session';
import type { CreateSessionInput, Session } from '@/agent/session';
import { beforeEach, describe, expect, it } from 'vitest';

describe('SessionManager', () => {
  let manager: InMemorySessionManager;

  beforeEach(() => {
    manager = new InMemorySessionManager();
  });

  describe('create', () => {
    it('should create session with default state', async () => {
      const session = await manager.create({});

      expect(session.id).toBeDefined();
      expect(session.state).toBe('active');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should create session with provider config', async () => {
      const input: CreateSessionInput = {
        provider: {
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: 'test-key',
        },
      };

      const session = await manager.create(input);

      expect(session.provider?.provider).toBe('claude');
      expect(session.provider?.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should create session with messages', async () => {
      const input: CreateSessionInput = {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      };

      const session = await manager.create(input);

      expect(session.messages).toHaveLength(2);
      expect(session.messages?.[0].content).toBe('Hello');
    });

    it('should create session with metadata', async () => {
      const input: CreateSessionInput = {
        metadata: {
          userId: 'user-123',
          taskId: 'task-456',
        },
      };

      const session = await manager.create(input);

      expect(session.metadata?.userId).toBe('user-123');
      expect(session.metadata?.taskId).toBe('task-456');
    });

    it('should generate unique session IDs', async () => {
      const session1 = await manager.create({});
      const session2 = await manager.create({});

      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('get', () => {
    it('should retrieve existing session', async () => {
      const created = await manager.create({});
      const retrieved = await manager.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.state).toBe('active');
    });

    it('should return undefined for non-existent session', async () => {
      const session = await manager.get('non-existent-id');
      expect(session).toBeUndefined();
    });

    it('should retrieve session with all properties', async () => {
      const created = await manager.create({
        provider: { provider: 'claude', model: 'claude-3-5-sonnet-20241022', apiKey: 'test' },
        messages: [{ role: 'user', content: 'Test' }],
        metadata: { test: 'value' },
      });

      const retrieved = await manager.get(created.id);

      expect(retrieved?.provider?.provider).toBe('claude');
      expect(retrieved?.messages).toHaveLength(1);
      expect(retrieved?.metadata?.test).toBe('value');
    });
  });

  describe('update', () => {
    it('should update session state', async () => {
      const session = await manager.create({});

      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await manager.update(session.id, { state: 'paused' });

      expect(updated.state).toBe('paused');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(session.updatedAt.getTime());
    });

    it('should update session messages', async () => {
      const session = await manager.create({ messages: [{ role: 'user', content: 'Hello' }] });

      const updated = await manager.update(session.id, {
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
      });

      expect(updated.messages).toHaveLength(2);
    });

    it('should update session metadata', async () => {
      const session = await manager.create({ metadata: { key1: 'value1' } });

      const updated = await manager.update(session.id, {
        metadata: { key1: 'value1', key2: 'value2' },
      });

      expect(updated.metadata?.key2).toBe('value2');
    });

    it('should update session with error', async () => {
      const session = await manager.create({});

      const updated = await manager.update(session.id, {
        state: 'failed',
        error: { message: 'Test error', code: 'TEST_ERROR' },
      });

      expect(updated.state).toBe('failed');
      expect(updated.error?.message).toBe('Test error');
      expect(updated.error?.code).toBe('TEST_ERROR');
    });

    it('should update session with tool results', async () => {
      const session = await manager.create({});

      const updated = await manager.update(session.id, {
        toolResults: [
          {
            toolName: 'bash',
            status: 'success',
            output: { stdout: 'Hello' },
          },
        ],
      });

      expect(updated.toolResults).toHaveLength(1);
      expect(updated.toolResults?.[0].toolName).toBe('bash');
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.update('non-existent', { state: 'paused' })).rejects.toThrow(
        SessionError
      );
    });
  });

  describe('delete', () => {
    it('should delete existing session', async () => {
      const session = await manager.create({});
      await manager.delete(session.id);

      const retrieved = await manager.get(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should not throw for non-existent session', async () => {
      await expect(manager.delete('non-existent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await manager.create({ metadata: { type: 'test1' } });
      await manager.create({ metadata: { type: 'test2' } });
      const session3 = await manager.create({ metadata: { type: 'test3' } });
      await manager.update(session3.id, { state: 'completed' });
    });

    it('should list all sessions', async () => {
      const sessions = await manager.list();
      expect(sessions.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter sessions by state', async () => {
      const sessions = await manager.list({ state: 'completed' });
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      sessions.forEach((s: Session) => expect(s.state).toBe('completed'));
    });

    it('should filter sessions by metadata', async () => {
      const sessions = await manager.list({ metadata: { type: 'test1' } });
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when no matches', async () => {
      const sessions = await manager.list({ state: 'cancelled' });
      expect(sessions).toEqual([]);
    });
  });

  describe('resume', () => {
    it('should resume paused session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      const resumed = await manager.resume(session.id);

      expect(resumed.state).toBe('active');
      expect(resumed.resumeToken).toBeUndefined();
    });

    it('should throw error for non-paused session', async () => {
      const session = await manager.create({});

      await expect(manager.resume(session.id)).rejects.toThrow(SessionError);
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.resume('non-existent')).rejects.toThrow(SessionError);
    });
  });

  describe('pause', () => {
    it('should pause active session', async () => {
      const session = await manager.create({});
      const paused = await manager.pause(session.id);

      expect(paused.state).toBe('paused');
    });

    it('should pause with resume token', async () => {
      const session = await manager.create({});
      const paused = await manager.pause(session.id, 'token-xyz');

      expect(paused.state).toBe('paused');
      expect(paused.resumeToken).toBe('token-xyz');
    });

    it('should throw error for non-active session', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(manager.pause(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('complete', () => {
    it('should complete active session', async () => {
      const session = await manager.create({});
      const completed = await manager.complete(session.id);

      expect(completed.state).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('should throw error for already completed session', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(manager.complete(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('fail', () => {
    it('should fail active session', async () => {
      const session = await manager.create({});
      const failed = await manager.fail(session.id, {
        message: 'Test failure',
        code: 'TEST_ERROR',
      });

      expect(failed.state).toBe('failed');
      expect(failed.error?.message).toBe('Test failure');
      expect(failed.error?.code).toBe('TEST_ERROR');
    });

    it('should fail with error details', async () => {
      const session = await manager.create({});
      const failed = await manager.fail(session.id, {
        message: 'Test failure',
        code: 'TEST_ERROR',
        details: { stack: 'error stack' },
      });

      expect(failed.error?.details).toEqual({ stack: 'error stack' });
    });

    it('should throw error for non-active session', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(
        manager.fail(session.id, { message: 'Error', code: 'ERROR' })
      ).rejects.toThrow(SessionError);
    });
  });

  describe('cancel', () => {
    it('should cancel active session', async () => {
      const session = await manager.create({});
      const cancelled = await manager.cancel(session.id);

      expect(cancelled.state).toBe('cancelled');
    });

    it('should cancel paused session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      const cancelled = await manager.cancel(session.id);

      expect(cancelled.state).toBe('cancelled');
    });

    it('should throw error for completed session', async () => {
      const session = await manager.create({});
      await manager.complete(session.id);

      await expect(manager.cancel(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('state transitions', () => {
    it('should track multiple state transitions', async () => {
      const session = await manager.create({});
      expect(session.state).toBe('active');

      const paused = await manager.pause(session.id);
      expect(paused.state).toBe('paused');

      const resumed = await manager.resume(session.id);
      expect(resumed.state).toBe('active');

      const completed = await manager.complete(session.id);
      expect(completed.state).toBe('completed');
    });

    it('should update timestamp on each transition', async () => {
      const session = await manager.create({});
      const time1 = session.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const paused = await manager.pause(session.id);
      const time2 = paused.updatedAt.getTime();

      expect(time2).toBeGreaterThan(time1);
    });
  });
});
