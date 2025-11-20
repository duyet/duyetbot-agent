/**
 * CLI Sessions Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSessionManager, LocalSession } from '../sessions.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock fs
vi.mock('node:fs');

describe('FileSessionManager', () => {
  const sessionsDir = '/mock/sessions';
  let sessionManager: FileSessionManager;

  beforeEach(() => {
    sessionManager = new FileSessionManager(sessionsDir);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
    vi.mocked(fs.readFileSync).mockReturnValue('[]');
    vi.mocked(fs.readdirSync).mockReturnValue([]);
    vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await sessionManager.createSession({
        title: 'Test Session',
      });

      expect(session.id).toBeDefined();
      expect(session.title).toBe('Test Session');
      expect(session.state).toBe('active');
      expect(session.messages).toEqual([]);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession({ title: 'Session 1' });
      const session2 = await sessionManager.createSession({ title: 'Session 2' });

      expect(session1.id).not.toBe(session2.id);
    });

    it('should save session to file', async () => {
      await sessionManager.createSession({ title: 'Test Session' });

      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should create sessions directory if not exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await sessionManager.createSession({ title: 'Test Session' });

      expect(fs.mkdirSync).toHaveBeenCalledWith(sessionsDir, { recursive: true });
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const session = await sessionManager.getSession('non-existent');

      expect(session).toBeUndefined();
    });

    it('should return session if exists', async () => {
      const savedSession: LocalSession = {
        id: 'session-1',
        title: 'Test Session',
        state: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedSession));

      const session = await sessionManager.getSession('session-1');

      expect(session?.id).toBe('session-1');
      expect(session?.title).toBe('Test Session');
    });
  });

  describe('updateSession', () => {
    it('should update existing session', async () => {
      const savedSession: LocalSession = {
        id: 'session-1',
        title: 'Test Session',
        state: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedSession));

      const updated = await sessionManager.updateSession('session-1', {
        title: 'Updated Title',
        state: 'completed',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.state).toBe('completed');
    });

    it('should throw error for non-existent session', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        sessionManager.updateSession('non-existent', { title: 'New' })
      ).rejects.toThrow('Session not found');
    });

    it('should update messages', async () => {
      const savedSession: LocalSession = {
        id: 'session-1',
        title: 'Test Session',
        state: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedSession));

      const newMessages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const updated = await sessionManager.updateSession('session-1', {
        messages: newMessages,
      });

      expect(updated.messages).toEqual(newMessages);
    });
  });

  describe('deleteSession', () => {
    it('should delete session file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await sessionManager.deleteSession('session-1');

      expect(fs.unlinkSync).toHaveBeenCalledWith(
        path.join(sessionsDir, 'session-1.json')
      );
    });

    it('should not throw for non-existent session', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        sessionManager.deleteSession('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('listSessions', () => {
    it('should return empty array if no sessions', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([]);

      const sessions = await sessionManager.listSessions();

      expect(sessions).toEqual([]);
    });

    it('should return all sessions', async () => {
      const session1: LocalSession = {
        id: 'session-1',
        title: 'Session 1',
        state: 'active',
        messages: [],
        createdAt: Date.now() - 1000,
        updatedAt: Date.now() - 1000,
      };

      const session2: LocalSession = {
        id: 'session-2',
        title: 'Session 2',
        state: 'completed',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'session-1.json' as unknown as fs.Dirent,
        'session-2.json' as unknown as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(session1))
        .mockReturnValueOnce(JSON.stringify(session2));

      const sessions = await sessionManager.listSessions();

      expect(sessions).toHaveLength(2);
    });

    it('should filter by state', async () => {
      const session1: LocalSession = {
        id: 'session-1',
        title: 'Session 1',
        state: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const session2: LocalSession = {
        id: 'session-2',
        title: 'Session 2',
        state: 'completed',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'session-1.json' as unknown as fs.Dirent,
        'session-2.json' as unknown as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(session1))
        .mockReturnValueOnce(JSON.stringify(session2));

      const sessions = await sessionManager.listSessions({ state: 'active' });

      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('session-1');
    });

    it('should sort by updatedAt descending', async () => {
      const session1: LocalSession = {
        id: 'session-1',
        title: 'Session 1',
        state: 'active',
        messages: [],
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
      };

      const session2: LocalSession = {
        id: 'session-2',
        title: 'Session 2',
        state: 'active',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'session-1.json' as unknown as fs.Dirent,
        'session-2.json' as unknown as fs.Dirent,
      ]);
      vi.mocked(fs.readFileSync)
        .mockReturnValueOnce(JSON.stringify(session1))
        .mockReturnValueOnce(JSON.stringify(session2));

      const sessions = await sessionManager.listSessions();

      expect(sessions[0].id).toBe('session-2'); // most recent first
    });

    it('should apply limit', async () => {
      const sessions: LocalSession[] = Array.from({ length: 5 }, (_, i) => ({
        id: `session-${i}`,
        title: `Session ${i}`,
        state: 'active',
        messages: [],
        createdAt: Date.now() - i * 1000,
        updatedAt: Date.now() - i * 1000,
      }));

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(
        sessions.map(s => `${s.id}.json` as unknown as fs.Dirent)
      );

      let readIndex = 0;
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        return JSON.stringify(sessions[readIndex++]);
      });

      const result = await sessionManager.listSessions({ limit: 3 });

      expect(result).toHaveLength(3);
    });
  });

  describe('exportSession', () => {
    it('should export session as JSON string', async () => {
      const savedSession: LocalSession = {
        id: 'session-1',
        title: 'Test Session',
        state: 'active',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi!' },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(savedSession));

      const exported = await sessionManager.exportSession('session-1');
      const parsed = JSON.parse(exported);

      expect(parsed.id).toBe('session-1');
      expect(parsed.messages).toHaveLength(2);
    });

    it('should throw for non-existent session', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        sessionManager.exportSession('non-existent')
      ).rejects.toThrow('Session not found');
    });
  });
});
