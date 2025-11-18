/**
 * Cloud Session Manager Tests
 */

import { SessionError } from '@/agent/session';
import type { ToolResult } from '@/agent/session';
import type { SessionRepository } from '@/api/repositories/session';
import type { LLMMessage } from '@/providers/types';
import { CloudSessionManager } from '@/storage/cloud-session-manager';
import type { MessageStore } from '@/storage/kv-message-store';
import type { ToolResultStore } from '@/storage/kv-tool-result-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
function createMockSessionRepo(): SessionRepository {
  const sessions = new Map();

  return {
    async create(input: any) {
      const session = {
        id: input.id,
        user_id: input.userId,
        state: input.state,
        title: input.title || null,
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      };
      sessions.set(input.id, session);
      return session;
    },
    async get(userId: string, sessionId: string) {
      const session = sessions.get(sessionId);
      if (!session || session.user_id !== userId) {
        return null;
      }
      return session;
    },
    async update(userId: string, sessionId: string, input: any) {
      const session = sessions.get(sessionId);
      if (!session || session.user_id !== userId) {
        return null;
      }
      const updated = {
        ...session,
        ...input,
        updated_at: Date.now(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : session.metadata,
      };
      sessions.set(sessionId, updated);
      return updated;
    },
    async delete(userId: string, sessionId: string) {
      const session = sessions.get(sessionId);
      if (session && session.user_id === userId) {
        sessions.delete(sessionId);
      }
    },
    async list(options: any) {
      const userSessions = Array.from(sessions.values()).filter(
        (s: any) => s.user_id === options.userId
      );
      if (options.state) {
        return userSessions.filter((s: any) => s.state === options.state);
      }
      return userSessions;
    },
    async count(userId: string) {
      return Array.from(sessions.values()).filter((s: any) => s.user_id === userId).length;
    },
    async deleteAllForUser(userId: string) {
      for (const [id, session] of sessions.entries()) {
        if ((session as any).user_id === userId) {
          sessions.delete(id);
        }
      }
    },
  } as SessionRepository;
}

function createMockMessageStore(): MessageStore {
  const messages = new Map<string, LLMMessage[]>();

  return {
    async append(userId: string, sessionId: string, message: LLMMessage) {
      const key = `${userId}:${sessionId}`;
      const existing = messages.get(key) || [];
      existing.push(message);
      messages.set(key, existing);
    },
    async getAll(userId: string, sessionId: string) {
      const key = `${userId}:${sessionId}`;
      return messages.get(key) || [];
    },
    async getRecent(userId: string, sessionId: string, limit: number) {
      const all = await this.getAll(userId, sessionId);
      return all.slice(-limit);
    },
    async clear(userId: string, sessionId: string) {
      const key = `${userId}:${sessionId}`;
      messages.delete(key);
    },
    async count(userId: string, sessionId: string) {
      const all = await this.getAll(userId, sessionId);
      return all.length;
    },
    async deleteAllForUser(userId: string) {
      for (const key of messages.keys()) {
        if (key.startsWith(`${userId}:`)) {
          messages.delete(key);
        }
      }
    },
  } as MessageStore;
}

function createMockToolStore(): ToolResultStore {
  const tools = new Map<string, ToolResult[]>();

  return {
    async append(userId: string, sessionId: string, result: ToolResult) {
      const key = `${userId}:${sessionId}`;
      const existing = tools.get(key) || [];
      existing.push(result);
      tools.set(key, existing);
    },
    async getAll(userId: string, sessionId: string) {
      const key = `${userId}:${sessionId}`;
      return tools.get(key) || [];
    },
    async getRecent(userId: string, sessionId: string, limit: number) {
      const all = await this.getAll(userId, sessionId);
      return all.slice(-limit);
    },
    async clear(userId: string, sessionId: string) {
      const key = `${userId}:${sessionId}`;
      tools.delete(key);
    },
    async count(userId: string, sessionId: string) {
      const all = await this.getAll(userId, sessionId);
      return all.length;
    },
    async deleteAllForUser(userId: string) {
      for (const key of tools.keys()) {
        if (key.startsWith(`${userId}:`)) {
          tools.delete(key);
        }
      }
    },
  } as ToolResultStore;
}

describe('CloudSessionManager', () => {
  let sessionRepo: SessionRepository;
  let messageStore: MessageStore;
  let toolStore: ToolResultStore;
  let manager: CloudSessionManager;

  beforeEach(() => {
    sessionRepo = createMockSessionRepo();
    messageStore = createMockMessageStore();
    toolStore = createMockToolStore();
    manager = new CloudSessionManager('user-1', sessionRepo, messageStore, toolStore);
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const session = await manager.create({
        metadata: { title: 'Test Session' },
      });

      expect(session.id).toBeDefined();
      expect(session.state).toBe('active');
      expect(session.metadata?.title).toBe('Test Session');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.updatedAt).toBeInstanceOf(Date);
    });

    it('should create session with initial messages', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const session = await manager.create({
        messages,
      });

      const storedMessages = await manager.getMessages(session.id);
      expect(storedMessages).toHaveLength(2);
      expect(storedMessages[0]?.content).toBe('Hello');
      expect(storedMessages[1]?.content).toBe('Hi there!');
    });
  });

  describe('get', () => {
    it('should get session by ID', async () => {
      const created = await manager.create({});
      const session = await manager.get(created.id);

      expect(session).toBeDefined();
      expect(session?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', async () => {
      const session = await manager.get('non-existent');
      expect(session).toBeUndefined();
    });

    it('should not get session from different user', async () => {
      const created = await manager.create({});

      const otherManager = new CloudSessionManager('user-2', sessionRepo, messageStore, toolStore);
      const session = await otherManager.get(created.id);

      expect(session).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update session state', async () => {
      const session = await manager.create({});

      const updated = await manager.update(session.id, {
        state: 'paused',
      });

      expect(updated.state).toBe('paused');
    });

    it('should append messages', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        messages: [{ role: 'user', content: 'New message' }],
      });

      const messages = await manager.getMessages(session.id);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe('New message');
    });

    it('should append tool results', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        toolResults: [
          {
            toolName: 'test-tool',
            status: 'success',
            output: 'result',
          },
        ],
      });

      const results = await manager.getToolResults(session.id);
      expect(results).toHaveLength(1);
      expect(results[0]?.toolName).toBe('test-tool');
    });

    it('should merge metadata', async () => {
      const session = await manager.create({
        metadata: { key1: 'value1' },
      });

      await manager.update(session.id, {
        metadata: { key2: 'value2' },
      });

      const updated = await manager.get(session.id);
      expect(updated?.metadata).toEqual({
        key1: 'value1',
        key2: 'value2',
      });
    });

    it('should throw error for non-existent session', async () => {
      await expect(manager.update('non-existent', { state: 'paused' })).rejects.toThrow(
        SessionError
      );
    });
  });

  describe('delete', () => {
    it('should delete session and associated data', async () => {
      const session = await manager.create({
        messages: [{ role: 'user', content: 'Test' }],
      });

      await manager.update(session.id, {
        toolResults: [
          {
            toolName: 'test',
            status: 'success',
          },
        ],
      });

      await manager.delete(session.id);

      const deleted = await manager.get(session.id);
      expect(deleted).toBeUndefined();

      const messages = await manager.getMessages(session.id);
      expect(messages).toHaveLength(0);

      const tools = await manager.getToolResults(session.id);
      expect(tools).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('should list all sessions for user', async () => {
      await manager.create({});
      await manager.create({});

      const sessions = await manager.list();
      expect(sessions).toHaveLength(2);
    });

    it('should filter by state', async () => {
      const session1 = await manager.create({});
      await manager.create({});

      await manager.update(session1.id, { state: 'paused' });

      const activeSessions = await manager.list({ state: 'active' });
      expect(activeSessions).toHaveLength(1);

      const pausedSessions = await manager.list({ state: 'paused' });
      expect(pausedSessions).toHaveLength(1);
    });

    it('should filter by metadata', async () => {
      await manager.create({ metadata: { type: 'test' } });
      await manager.create({ metadata: { type: 'production' } });

      const testSessions = await manager.list({
        metadata: { type: 'test' },
      });
      expect(testSessions).toHaveLength(1);
    });
  });

  describe('resume', () => {
    it('should resume paused session', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      const resumed = await manager.resume(session.id);
      expect(resumed.state).toBe('active');
    });

    it('should throw error if session not paused', async () => {
      const session = await manager.create({});

      await expect(manager.resume(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('pause', () => {
    it('should pause active session', async () => {
      const session = await manager.create({});

      const paused = await manager.pause(session.id);
      expect(paused.state).toBe('paused');
    });

    it('should store resume token', async () => {
      const session = await manager.create({});

      const paused = await manager.pause(session.id, 'resume-token-123');
      expect(paused.metadata?.resumeToken).toBe('resume-token-123');
    });

    it('should throw error if session not active', async () => {
      const session = await manager.create({});
      await manager.pause(session.id);

      await expect(manager.pause(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('complete', () => {
    it('should complete session', async () => {
      const session = await manager.create({});

      const completed = await manager.complete(session.id);
      expect(completed.state).toBe('completed');
    });
  });

  describe('fail', () => {
    it('should fail session with error', async () => {
      const session = await manager.create({});

      const failed = await manager.fail(session.id, {
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { extra: 'info' },
      });

      expect(failed.state).toBe('failed');
      expect(failed.metadata?.error).toEqual({
        message: 'Test error',
        code: 'TEST_ERROR',
        details: { extra: 'info' },
      });
    });
  });

  describe('cancel', () => {
    it('should cancel session', async () => {
      const session = await manager.create({});

      const cancelled = await manager.cancel(session.id);
      expect(cancelled.state).toBe('cancelled');
    });
  });

  describe('getMessages', () => {
    it('should get all messages', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        messages: [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Message 2' },
          { role: 'user', content: 'Message 3' },
        ],
      });

      const messages = await manager.getMessages(session.id);
      expect(messages).toHaveLength(3);
    });

    it('should get recent messages with limit', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        messages: [
          { role: 'user', content: 'Message 1' },
          { role: 'assistant', content: 'Message 2' },
          { role: 'user', content: 'Message 3' },
        ],
      });

      const messages = await manager.getMessages(session.id, 2);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.content).toBe('Message 2');
      expect(messages[1]?.content).toBe('Message 3');
    });
  });

  describe('getToolResults', () => {
    it('should get all tool results', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        toolResults: [
          { toolName: 'tool1', status: 'success' },
          { toolName: 'tool2', status: 'error' },
        ],
      });

      const results = await manager.getToolResults(session.id);
      expect(results).toHaveLength(2);
    });

    it('should get recent tool results with limit', async () => {
      const session = await manager.create({});

      await manager.update(session.id, {
        toolResults: [
          { toolName: 'tool1', status: 'success' },
          { toolName: 'tool2', status: 'success' },
          { toolName: 'tool3', status: 'success' },
        ],
      });

      const results = await manager.getToolResults(session.id, 2);
      expect(results).toHaveLength(2);
      expect(results[0]?.toolName).toBe('tool2');
      expect(results[1]?.toolName).toBe('tool3');
    });
  });
});
