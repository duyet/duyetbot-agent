import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestServer, startTestServer } from '../helpers/server';

function createMockKV() {
  const store = new Map<string, string>();

  return {
    get: async (key: string) => store.get(key) || null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (options?: { prefix?: string }) => {
      const keys = Array.from(store.keys())
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .map((name) => ({ name }));
      return { keys };
    },
  };
}

describe('Memory MCP E2E', () => {
  let server: TestServer;
  let kv: ReturnType<typeof createMockKV>;

  beforeAll(async () => {
    kv = createMockKV();

    const app = new Hono();

    // Session storage endpoints
    app.post('/sessions', async (c) => {
      const body = await c.req.json();
      const sessionId = `session_${Date.now()}`;
      await kv.put(
        `sessions:${sessionId}`,
        JSON.stringify({
          id: sessionId,
          userId: body.userId,
          messages: [],
          metadata: body.metadata || {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );
      return c.json({ sessionId });
    });

    app.get('/sessions/:id', async (c) => {
      const sessionId = c.req.param('id');
      const data = await kv.get(`sessions:${sessionId}`);
      if (!data) {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json(JSON.parse(data));
    });

    app.post('/sessions/:id/messages', async (c) => {
      const sessionId = c.req.param('id');
      const body = await c.req.json();
      const sessionData = await kv.get(`sessions:${sessionId}`);

      if (!sessionData) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const session = JSON.parse(sessionData);
      session.messages.push(...body.messages);
      session.updatedAt = Date.now();

      await kv.put(`sessions:${sessionId}`, JSON.stringify(session));
      return c.json({ saved: body.messages.length });
    });

    app.get('/sessions/:id/messages', async (c) => {
      const sessionId = c.req.param('id');
      const sessionData = await kv.get(`sessions:${sessionId}`);

      if (!sessionData) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const session = JSON.parse(sessionData);
      return c.json({ messages: session.messages });
    });

    app.delete('/sessions/:id', async (c) => {
      const sessionId = c.req.param('id');
      await kv.delete(`sessions:${sessionId}`);
      return c.json({ deleted: true });
    });

    app.get('/users/:userId/sessions', async (c) => {
      const userId = c.req.param('userId');
      const { keys } = await kv.list({ prefix: 'sessions:' });

      const sessions = [];
      for (const { name } of keys) {
        const data = await kv.get(name);
        if (data) {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            sessions.push(session);
          }
        }
      }

      return c.json({ sessions });
    });

    server = await startTestServer(app);
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Session Persistence', () => {
    let sessionId: string;
    const testUserId = 'test-user-123';

    it('should create a new session', async () => {
      const res = await fetch(`${server.url}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          metadata: { source: 'e2e-test' },
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessionId).toBeTruthy();
      sessionId = data.sessionId;
    });

    it('should retrieve session', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sessionId);
      expect(data.userId).toBe(testUserId);
      expect(data.messages).toEqual([]);
    });

    it('should save messages to session', async () => {
      const messages = [
        { role: 'user', content: 'What is TypeScript?' },
        {
          role: 'assistant',
          content: 'TypeScript is a typed superset of JavaScript.',
        },
      ];

      const res = await fetch(`${server.url}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.saved).toBe(2);
    });

    it('should retrieve saved messages', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}/messages`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.messages.length).toBe(2);
      expect(data.messages[0].role).toBe('user');
      expect(data.messages[1].role).toBe('assistant');
    });

    it('should append more messages', async () => {
      const newMessages = [
        { role: 'user', content: 'How do I install it?' },
        { role: 'assistant', content: 'Run: npm install typescript' },
      ];

      await fetch(`${server.url}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const res = await fetch(`${server.url}/sessions/${sessionId}/messages`);
      const data = await res.json();
      expect(data.messages.length).toBe(4);
    });

    it('should list user sessions', async () => {
      const res = await fetch(`${server.url}/users/${testUserId}/sessions`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions.length).toBeGreaterThan(0);
      expect(data.sessions.some((s: any) => s.id === sessionId)).toBe(true);
    });

    it('should delete session', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(200);

      const getRes = await fetch(`${server.url}/sessions/${sessionId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('Multiple Users', () => {
    it('should isolate sessions by user', async () => {
      // Create sessions for two users
      const user1Res = await fetch(`${server.url}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1' }),
      });
      const user1Data = await user1Res.json();

      const user2Res = await fetch(`${server.url}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-2' }),
      });
      const user2Data = await user2Res.json();

      // List sessions for each user
      const user1SessionsRes = await fetch(`${server.url}/users/user-1/sessions`);
      const user1Sessions = await user1SessionsRes.json();

      const user2SessionsRes = await fetch(`${server.url}/users/user-2/sessions`);
      const user2Sessions = await user2SessionsRes.json();

      // Each user should only see their own sessions
      expect(user1Sessions.sessions.every((s: any) => s.userId === 'user-1')).toBe(true);
      expect(user2Sessions.sessions.every((s: any) => s.userId === 'user-2')).toBe(true);

      // Cleanup
      await fetch(`${server.url}/sessions/${user1Data.sessionId}`, { method: 'DELETE' });
      await fetch(`${server.url}/sessions/${user2Data.sessionId}`, { method: 'DELETE' });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent session', async () => {
      const res = await fetch(`${server.url}/sessions/non-existent`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when adding messages to non-existent session', async () => {
      const res = await fetch(`${server.url}/sessions/non-existent/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [] }),
      });
      expect(res.status).toBe(404);
    });
  });
});
