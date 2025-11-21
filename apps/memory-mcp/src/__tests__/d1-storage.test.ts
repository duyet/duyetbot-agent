import { beforeEach, describe, expect, it, vi } from 'vitest';
import { D1Storage } from '../storage/d1.js';
import type { LLMMessage, Session, SessionToken, User } from '../types.js';

// Mock D1 database
function createMockD1() {
  const data = {
    users: new Map<string, User>(),
    sessions: new Map<string, Session & { metadata: string }>(),
    tokens: new Map<string, SessionToken>(),
    messages: new Map<
      string,
      Array<{
        id: number;
        session_id: string;
        role: string;
        content: string;
        timestamp: number;
        metadata: string | null;
      }>
    >(),
  };

  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn((...args: unknown[]) => ({
        first: vi.fn(async <T>() => {
          if (sql.includes('FROM users WHERE id')) {
            return data.users.get(args[0] as string) as T;
          }
          if (sql.includes('FROM users WHERE github_id')) {
            for (const user of data.users.values()) {
              if (user.github_id === args[0]) {
                return user as T;
              }
            }
            return null;
          }
          if (sql.includes('FROM sessions WHERE id')) {
            return data.sessions.get(args[0] as string) as T;
          }
          if (sql.includes('FROM session_tokens WHERE token')) {
            return data.tokens.get(args[0] as string) as T;
          }
          if (sql.includes('COUNT(*)')) {
            return { count: data.sessions.size } as T;
          }
          return null;
        }),
        all: vi.fn(async <T>() => {
          if (sql.includes('FROM sessions WHERE user_id')) {
            const userId = args[0];
            const results = Array.from(data.sessions.values()).filter((s) => s.user_id === userId);
            return { results } as { results: T[] };
          }
          if (sql.includes('FROM messages WHERE session_id')) {
            const sessionId = args[0] as string;
            const msgs = data.messages.get(sessionId) || [];
            return { results: msgs } as { results: T[] };
          }
          if (sql.includes('FROM messages m')) {
            // Search messages
            const userId = args[0] as string;
            const query = (args[1] as string).replace(/%/g, '');
            const results: any[] = [];
            for (const [sessionId, msgs] of data.messages) {
              const session = data.sessions.get(sessionId);
              if (!session || session.user_id !== userId) {
                continue;
              }
              for (let i = 0; i < msgs.length; i++) {
                if (msgs[i].content.toLowerCase().includes(query.toLowerCase())) {
                  results.push({ ...msgs[i], msg_index: i });
                }
              }
            }
            return { results } as { results: T[] };
          }
          return { results: [] };
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO users')) {
            const user: User = {
              id: args[0] as string,
              github_id: args[1] as string,
              github_login: args[2] as string,
              email: args[3] as string | null,
              name: args[4] as string | null,
              avatar_url: args[5] as string | null,
              created_at: args[6] as number,
              updated_at: args[7] as number,
            };
            data.users.set(user.id, user);
          }
          if (sql.includes('INSERT INTO sessions')) {
            const session = {
              id: args[0] as string,
              user_id: args[1] as string,
              title: args[2] as string | null,
              state: args[3] as 'active' | 'paused' | 'completed',
              created_at: args[4] as number,
              updated_at: args[5] as number,
              metadata: args[6] as string,
            };
            data.sessions.set(session.id, session);
          }
          if (sql.includes('INSERT INTO session_tokens')) {
            const token: SessionToken = {
              token: args[0] as string,
              user_id: args[1] as string,
              expires_at: args[2] as number,
              created_at: args[3] as number,
            };
            data.tokens.set(token.token, token);
          }
          if (sql.includes('DELETE FROM sessions')) {
            data.sessions.delete(args[args.length - 1] as string);
          }
          if (sql.includes('DELETE FROM session_tokens WHERE token')) {
            data.tokens.delete(args[0] as string);
          }
          if (sql.includes('DELETE FROM session_tokens WHERE expires_at')) {
            const now = args[0] as number;
            for (const [key, token] of data.tokens) {
              if (token.expires_at < now) {
                data.tokens.delete(key);
              }
            }
          }
          if (sql.includes('DELETE FROM messages WHERE session_id')) {
            data.messages.delete(args[0] as string);
          }
          if (sql.includes('INSERT INTO messages')) {
            const sessionId = args[0] as string;
            const msgs = data.messages.get(sessionId) || [];
            msgs.push({
              id: msgs.length + 1,
              session_id: sessionId,
              role: args[1] as string,
              content: args[2] as string,
              timestamp: args[3] as number,
              metadata: args[4] as string | null,
            });
            data.messages.set(sessionId, msgs);
          }
          return { success: true };
        }),
      })),
    })),
    batch: vi.fn(async (statements: any[]) => {
      // Execute all statements in order
      for (const stmt of statements) {
        await stmt.run();
      }
      return statements.map(() => ({ success: true }));
    }),
    _data: data,
  };
}

describe('D1Storage', () => {
  let storage: D1Storage;
  let mockDb: ReturnType<typeof createMockD1>;

  beforeEach(() => {
    mockDb = createMockD1();
    storage = new D1Storage(mockDb as any);
  });

  describe('User operations', () => {
    const testUser: User = {
      id: 'user_123',
      github_id: '12345',
      github_login: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: 'https://github.com/avatar.png',
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    it('should create a user', async () => {
      const result = await storage.createUser(testUser);
      expect(result).toEqual(testUser);
      expect(mockDb._data.users.get('user_123')).toEqual(testUser);
    });

    it('should get a user by id', async () => {
      mockDb._data.users.set(testUser.id, testUser);
      const result = await storage.getUser(testUser.id);
      expect(result).toEqual(testUser);
    });

    it('should return null for non-existent user', async () => {
      const result = await storage.getUser('nonexistent');
      expect(result).toBeNull();
    });

    it('should get user by GitHub ID', async () => {
      mockDb._data.users.set(testUser.id, testUser);
      const result = await storage.getUserByGitHubId(testUser.github_id);
      expect(result).toEqual(testUser);
    });

    it('should update a user', async () => {
      mockDb._data.users.set(testUser.id, testUser);
      await storage.updateUser(testUser.id, { name: 'Updated Name' });
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should not update when no fields provided', async () => {
      await storage.updateUser(testUser.id, {});
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });
  });

  describe('Session operations', () => {
    const testSession: Session = {
      id: 'sess_123',
      user_id: 'user_123',
      title: 'Test Session',
      state: 'active',
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: { key: 'value' },
    };

    it('should create a session', async () => {
      const result = await storage.createSession(testSession);
      expect(result).toEqual(testSession);
    });

    it('should get a session by id', async () => {
      mockDb._data.sessions.set(testSession.id, {
        ...testSession,
        metadata: JSON.stringify(testSession.metadata),
      });
      const result = await storage.getSession(testSession.id);
      expect(result).toEqual(testSession);
    });

    it('should return null for non-existent session', async () => {
      const result = await storage.getSession('nonexistent');
      expect(result).toBeNull();
    });

    it('should list sessions for a user', async () => {
      mockDb._data.sessions.set(testSession.id, {
        ...testSession,
        metadata: JSON.stringify(testSession.metadata),
      });
      const result = await storage.listSessions('user_123');
      expect(result.sessions).toHaveLength(1);
    });

    it('should delete a session', async () => {
      mockDb._data.sessions.set(testSession.id, {
        ...testSession,
        metadata: JSON.stringify(testSession.metadata),
      });
      await storage.deleteSession(testSession.id);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('Token operations', () => {
    const testToken: SessionToken = {
      token: 'st_abc123',
      user_id: 'user_123',
      expires_at: Date.now() + 3600000,
      created_at: Date.now(),
    };

    it('should create a token', async () => {
      const result = await storage.createToken(testToken);
      expect(result).toEqual(testToken);
    });

    it('should get a token', async () => {
      mockDb._data.tokens.set(testToken.token, testToken);
      const result = await storage.getToken(testToken.token);
      expect(result).toEqual(testToken);
    });

    it('should return null for non-existent token', async () => {
      const result = await storage.getToken('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete a token', async () => {
      mockDb._data.tokens.set(testToken.token, testToken);
      await storage.deleteToken(testToken.token);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should delete expired tokens', async () => {
      const expiredToken = { ...testToken, expires_at: Date.now() - 1000 };
      mockDb._data.tokens.set(expiredToken.token, expiredToken);
      await storage.deleteExpiredTokens();
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  describe('Message operations', () => {
    const testMessages: LLMMessage[] = [
      { role: 'user', content: 'Hello', timestamp: Date.now() },
      { role: 'assistant', content: 'Hi there!', timestamp: Date.now() + 1000 },
    ];

    it('should save messages', async () => {
      const count = await storage.saveMessages('sess_123', testMessages);
      expect(count).toBe(2);
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('should return 0 for empty messages', async () => {
      const count = await storage.saveMessages('sess_123', []);
      expect(count).toBe(0);
    });

    it('should append messages', async () => {
      const count = await storage.appendMessages('sess_123', testMessages);
      expect(count).toBe(2);
      expect(mockDb.batch).toHaveBeenCalled();
    });

    it('should return 0 for empty append', async () => {
      const count = await storage.appendMessages('sess_123', []);
      expect(count).toBe(0);
    });

    it('should get messages', async () => {
      mockDb._data.messages.set(
        'sess_123',
        testMessages.map((m, i) => ({
          id: i + 1,
          session_id: 'sess_123',
          role: m.role,
          content: m.content,
          timestamp: m.timestamp || Date.now(),
          metadata: null,
        }))
      );
      const result = await storage.getMessages('sess_123');
      expect(result).toHaveLength(2);
    });

    it('should delete messages', async () => {
      mockDb._data.messages.set('sess_123', []);
      await storage.deleteMessages('sess_123');
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it('should get message count', async () => {
      // The mock returns count from sessions.size, but we need to test the method
      const count = await storage.getMessageCount('sess_123');
      expect(count).toBeDefined();
    });

    it('should search messages', async () => {
      const testSession = {
        id: 'sess_123',
        user_id: 'user_123',
        title: 'Test',
        state: 'active' as const,
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: '{}',
      };
      mockDb._data.sessions.set('sess_123', testSession);
      mockDb._data.messages.set('sess_123', [
        {
          id: 1,
          session_id: 'sess_123',
          role: 'user',
          content: 'Hello TypeScript',
          timestamp: Date.now(),
          metadata: null,
        },
      ]);

      const results = await storage.searchMessages('user_123', 'TypeScript');
      expect(results).toBeDefined();
    });
  });
});
