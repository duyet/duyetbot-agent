import { FileSessionManager } from '@/storage/file-session-manager';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('FileSessionManager', () => {
  let manager: FileSessionManager;
  let testDir: string;

  beforeEach(() => {
    testDir = join(process.cwd(), '.test-file-sessions');
    manager = new FileSessionManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('create', () => {
    it('should create session and persist to file', async () => {
      const session = await manager.create({ metadata: { test: true } });

      expect(session.id).toBeDefined();
      expect(session.state).toBe('active');

      // Verify file exists
      const sessionPath = join(testDir, 'sessions', `${session.id}.json`);
      expect(existsSync(sessionPath)).toBe(true);
    });

    it('should persist provider config', async () => {
      const session = await manager.create({
        provider: {
          provider: 'claude',
          model: 'claude-3-5-sonnet-20241022',
          apiKey: 'test-key',
        },
      });

      const loaded = await manager.get(session.id);
      expect(loaded?.provider?.provider).toBe('claude');
    });

    it('should persist messages', async () => {
      const session = await manager.create({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      const loaded = await manager.get(session.id);
      expect(loaded?.messages).toHaveLength(1);
      expect(loaded?.messages![0]!.content).toBe('Hello');
    });
  });

  describe('get', () => {
    it('should load session from file', async () => {
      const created = await manager.create({ metadata: { value: 42 } });
      const loaded = await manager.get(created.id);

      expect(loaded?.id).toBe(created.id);
      expect(loaded?.metadata?.value).toBe(42);
    });

    it('should return undefined for non-existent session', async () => {
      const loaded = await manager.get('non-existent-id');
      expect(loaded).toBeUndefined();
    });

    it('should restore Date objects', async () => {
      const created = await manager.create({});
      const loaded = await manager.get(created.id);

      expect(loaded?.createdAt).toBeInstanceOf(Date);
      expect(loaded?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('update', () => {
    it('should update session file', async () => {
      const session = await manager.create({});

      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await manager.update(session.id, { state: 'paused' });

      expect(updated.state).toBe('paused');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(session.updatedAt.getTime());

      // Verify persisted
      const loaded = await manager.get(session.id);
      expect(loaded?.state).toBe('paused');
    });

    it('should update messages', async () => {
      const session = await manager.create({ messages: [{ role: 'user', content: 'Hi' }] });

      await manager.update(session.id, {
        messages: [
          { role: 'user', content: 'Hi' },
          { role: 'assistant', content: 'Hello!' },
        ],
      });

      const loaded = await manager.get(session.id);
      expect(loaded?.messages).toHaveLength(2);
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.update('missing', { state: 'paused' })).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete session file', async () => {
      const session = await manager.create({});
      const sessionPath = join(testDir, 'sessions', `${session.id}.json`);

      expect(existsSync(sessionPath)).toBe(true);

      await manager.delete(session.id);

      expect(existsSync(sessionPath)).toBe(false);
      expect(await manager.get(session.id)).toBeUndefined();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await manager.create({ metadata: { type: 'test1' } });
      await manager.create({ metadata: { type: 'test2' } });
      const session3 = await manager.create({ metadata: { type: 'test3' } });
      await manager.update(session3.id, { state: 'completed' });
    });

    it('should list all sessions from files', async () => {
      const sessions = await manager.list();
      expect(sessions.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by state', async () => {
      const sessions = await manager.list({ state: 'completed' });
      expect(sessions.length).toBeGreaterThanOrEqual(1);
      for (const s of sessions) {
        expect(s.state).toBe('completed');
      }
    });

    it('should filter by metadata', async () => {
      const sessions = await manager.list({ metadata: { type: 'test1' } });
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('state transitions', () => {
    it('should persist pause', async () => {
      const session = await manager.create({});
      const paused = await manager.pause(session.id, 'resume-token');

      expect(paused.state).toBe('paused');
      expect(paused.resumeToken).toBe('resume-token');

      const loaded = await manager.get(session.id);
      expect(loaded?.state).toBe('paused');
    });

    it('should persist resume', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);
      const resumed = await manager.resume(session.id);

      expect(resumed.state).toBe('active');

      const loaded = await manager.get(session.id);
      expect(loaded?.state).toBe('active');
    });

    it('should persist complete', async () => {
      const session = await manager.create({});
      const completed = await manager.complete(session.id);

      expect(completed.state).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);

      const loaded = await manager.get(session.id);
      expect(loaded?.state).toBe('completed');
      expect(loaded?.completedAt).toBeInstanceOf(Date);
    });

    it('should persist fail', async () => {
      const session = await manager.create({});
      const failed = await manager.fail(session.id, {
        message: 'Test error',
        code: 'TEST_ERROR',
      });

      expect(failed.state).toBe('failed');
      expect(failed.error?.message).toBe('Test error');

      const loaded = await manager.get(session.id);
      expect(loaded?.state).toBe('failed');
      expect(loaded?.error?.message).toBe('Test error');
    });
  });

  describe('persistence after restart', () => {
    it('should load sessions after manager recreation', async () => {
      const session1 = await manager.create({ metadata: { persist: true } });
      const session2 = await manager.create({ metadata: { persist: false } });

      // Create new manager instance (simulates restart)
      const newManager = new FileSessionManager(testDir);

      const loaded1 = await newManager.get(session1.id);
      const loaded2 = await newManager.get(session2.id);

      expect(loaded1?.id).toBe(session1.id);
      expect(loaded2?.id).toBe(session2.id);
    });

    it('should list sessions after restart', async () => {
      await manager.create({});
      await manager.create({});

      const newManager = new FileSessionManager(testDir);
      const sessions = await newManager.list();

      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });
});
