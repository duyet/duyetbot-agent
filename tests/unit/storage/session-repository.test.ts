/**
 * Session Repository Tests
 */

import { SessionRepository } from '@/api/repositories/session';
import type { D1Database } from '@cloudflare/workers-types';
import { beforeEach, describe, expect, it } from 'vitest';

// Mock D1 database
function createMockDB(): D1Database {
  const data: {
    sessions: Array<{
      id: string;
      user_id: string;
      state: string;
      title: string | null;
      created_at: number;
      updated_at: number;
      metadata: string | null;
    }>;
  } = {
    sessions: [],
  };

  return {
    prepare(sql: string) {
      const boundValues: unknown[] = [];

      return {
        bind(...values: unknown[]) {
          boundValues.push(...values);
          return this;
        },
        async run() {
          // INSERT
          if (sql.includes('INSERT INTO sessions')) {
            const [id, user_id, state, title, created_at, updated_at, metadata] = boundValues;
            data.sessions.push({
              id: id as string,
              user_id: user_id as string,
              state: state as string,
              title: title as string | null,
              created_at: created_at as number,
              updated_at: updated_at as number,
              metadata: metadata as string | null,
            });
          }
          // UPDATE
          else if (sql.includes('UPDATE sessions')) {
            const sessionId = boundValues[boundValues.length - 2];
            const userId = boundValues[boundValues.length - 1];
            const sessionIndex = data.sessions.findIndex(
              (s) => s.id === sessionId && s.user_id === userId
            );

            if (sessionIndex >= 0) {
              const session = data.sessions[sessionIndex];
              let valueIndex = 0;
              if (sql.includes('state =')) {
                session.state = boundValues[valueIndex++] as string;
              }
              if (sql.includes('title =')) {
                session.title = boundValues[valueIndex++] as string | null;
              }
              if (sql.includes('metadata =')) {
                session.metadata = boundValues[valueIndex++] as string | null;
              }
              session.updated_at = boundValues[
                boundValues.length - 3
              ] as number;
            }
          }
          // DELETE
          else if (sql.includes('DELETE FROM sessions')) {
            if (sql.includes('user_id = ?') && boundValues.length === 1) {
              // Delete all for user
              data.sessions = data.sessions.filter((s) => s.user_id !== boundValues[0]);
            } else {
              // Delete specific session
              const [sessionId, userId] = boundValues;
              data.sessions = data.sessions.filter(
                (s) => !(s.id === sessionId && s.user_id === userId)
              );
            }
          }

          return { success: true };
        },
        async first() {
          // SELECT with WHERE id = ? AND user_id = ?
          if (sql.includes('WHERE id = ? AND user_id = ?')) {
            const [sessionId, userId] = boundValues;
            return data.sessions.find((s) => s.id === sessionId && s.user_id === userId) || null;
          }
          // COUNT
          if (sql.includes('COUNT(*)')) {
            const userId = boundValues[0];
            let count = data.sessions.filter((s) => s.user_id === userId).length;

            // Filter by state if provided
            if (sql.includes('AND state = ?') && boundValues.length > 1) {
              const state = boundValues[1];
              count = data.sessions.filter((s) => s.user_id === userId && s.state === state).length;
            }

            return { count };
          }
          return null;
        },
        async all() {
          const userId = boundValues[0];
          let sessions = data.sessions.filter((s) => s.user_id === userId);

          // Filter by state if provided
          if (sql.includes('AND state = ?') && boundValues.length > 1) {
            const state = boundValues[1];
            sessions = sessions.filter((s) => s.state === state);
          }

          // Sort by updated_at DESC
          sessions.sort((a, b) => b.updated_at - a.updated_at);

          // Apply limit and offset
          const limit = boundValues[boundValues.length - 2] as number;
          const offset = boundValues[boundValues.length - 1] as number;
          sessions = sessions.slice(offset, offset + limit);

          return { results: sessions };
        },
      };
    },
  } as D1Database;
}

describe('SessionRepository', () => {
  let db: D1Database;
  let repo: SessionRepository;

  beforeEach(() => {
    db = createMockDB();
    repo = new SessionRepository(db);
  });

  describe('create', () => {
    it('should create a new session', async () => {
      const session = await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
        title: 'Test Session',
        metadata: { key: 'value' },
      });

      expect(session.id).toBe('session-1');
      expect(session.user_id).toBe('user-1');
      expect(session.state).toBe('active');
      expect(session.title).toBe('Test Session');
      expect(session.metadata).toBe(JSON.stringify({ key: 'value' }));
      expect(session.created_at).toBeGreaterThan(0);
      expect(session.updated_at).toBeGreaterThan(0);
    });

    it('should create session without optional fields', async () => {
      const session = await repo.create({
        id: 'session-2',
        userId: 'user-1',
        state: 'active',
      });

      expect(session.id).toBe('session-2');
      expect(session.title).toBeNull();
      expect(session.metadata).toBeNull();
    });
  });

  describe('get', () => {
    it('should get session by ID', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      const session = await repo.get('user-1', 'session-1');
      expect(session).not.toBeNull();
      expect(session?.id).toBe('session-1');
      expect(session?.user_id).toBe('user-1');
    });

    it('should return null for non-existent session', async () => {
      const session = await repo.get('user-1', 'non-existent');
      expect(session).toBeNull();
    });

    it('should not get session from different user', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      const session = await repo.get('user-2', 'session-1');
      expect(session).toBeNull();
    });
  });

  describe('update', () => {
    it('should update session state', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      const updated = await repo.update('user-1', 'session-1', {
        state: 'paused',
      });

      expect(updated).not.toBeNull();
      expect(updated?.state).toBe('paused');
    });

    it('should update session title', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      const updated = await repo.update('user-1', 'session-1', {
        title: 'New Title',
      });

      expect(updated?.title).toBe('New Title');
    });

    it('should update session metadata', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
        metadata: { old: 'value' },
      });

      const updated = await repo.update('user-1', 'session-1', {
        metadata: { new: 'value' },
      });

      expect(updated?.metadata).toBe(JSON.stringify({ new: 'value' }));
    });

    it('should return null when updating non-existent session', async () => {
      const updated = await repo.update('user-1', 'non-existent', {
        state: 'paused',
      });

      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete session', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      await repo.delete('user-1', 'session-1');

      const session = await repo.get('user-1', 'session-1');
      expect(session).toBeNull();
    });

    it('should not delete session from different user', async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });

      await repo.delete('user-2', 'session-1');

      const session = await repo.get('user-1', 'session-1');
      expect(session).not.toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });
      await repo.create({
        id: 'session-2',
        userId: 'user-1',
        state: 'paused',
      });
      await repo.create({
        id: 'session-3',
        userId: 'user-2',
        state: 'active',
      });
    });

    it('should list all sessions for user', async () => {
      const sessions = await repo.list({ userId: 'user-1' });
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.id)).toContain('session-1');
      expect(sessions.map((s) => s.id)).toContain('session-2');
    });

    it('should filter sessions by state', async () => {
      const sessions = await repo.list({ userId: 'user-1', state: 'active' });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe('session-1');
    });

    it('should respect limit and offset', async () => {
      const sessions = await repo.list({
        userId: 'user-1',
        limit: 1,
        offset: 0,
      });
      expect(sessions).toHaveLength(1);
    });

    it('should return empty array for user with no sessions', async () => {
      const sessions = await repo.list({ userId: 'user-3' });
      expect(sessions).toHaveLength(0);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });
      await repo.create({
        id: 'session-2',
        userId: 'user-1',
        state: 'paused',
      });
      await repo.create({
        id: 'session-3',
        userId: 'user-2',
        state: 'active',
      });
    });

    it('should count all sessions for user', async () => {
      const count = await repo.count('user-1');
      expect(count).toBe(2);
    });

    it('should count sessions by state', async () => {
      const count = await repo.count('user-1', 'active');
      expect(count).toBe(1);
    });

    it('should return 0 for user with no sessions', async () => {
      const count = await repo.count('user-3');
      expect(count).toBe(0);
    });
  });

  describe('deleteAllForUser', () => {
    beforeEach(async () => {
      await repo.create({
        id: 'session-1',
        userId: 'user-1',
        state: 'active',
      });
      await repo.create({
        id: 'session-2',
        userId: 'user-1',
        state: 'paused',
      });
      await repo.create({
        id: 'session-3',
        userId: 'user-2',
        state: 'active',
      });
    });

    it('should delete all sessions for user', async () => {
      await repo.deleteAllForUser('user-1');

      const count = await repo.count('user-1');
      expect(count).toBe(0);

      const user2Count = await repo.count('user-2');
      expect(user2Count).toBe(1);
    });
  });
});
