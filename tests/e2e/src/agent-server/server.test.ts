import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { startTestServer, type TestServer } from '../helpers/server';

// Simple session manager for E2E testing
class TestSessionManager {
  private sessions = new Map<string, any>();

  createSession(userId: string, metadata?: any) {
    const id = `session_${Math.random().toString(36).slice(2)}`;
    const session = { id, userId, messages: [] as any[], metadata: metadata || {}, createdAt: Date.now(), updatedAt: Date.now() };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string) { return this.sessions.get(id) || null; }
  listSessions() { return Array.from(this.sessions.values()); }
  deleteSession(id: string) { return this.sessions.delete(id); }
  appendMessages(id: string, msgs: any[]) {
    const s = this.sessions.get(id);
    if (s) { s.messages.push(...msgs); s.updatedAt = Date.now(); }
  }
}

describe('Agent Server E2E', () => {
  let server: TestServer;
  let sessionManager: TestSessionManager;

  beforeAll(async () => {
    sessionManager = new TestSessionManager();

    const app = new Hono();

    // Health routes
    app.get('/health', (c) => c.json({ status: 'healthy' }));

    // Session management routes
    app.get('/sessions', (c) => {
      const sessions = sessionManager.listSessions();
      return c.json({ sessions });
    });

    app.post('/sessions', async (c) => {
      const body = await c.req.json();
      const session = sessionManager.createSession(body.userId, body.metadata);
      return c.json({ session });
    });

    app.get('/sessions/:id', (c) => {
      const session = sessionManager.getSession(c.req.param('id'));
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ session });
    });

    app.delete('/sessions/:id', (c) => {
      const deleted = sessionManager.deleteSession(c.req.param('id'));
      return c.json({ deleted });
    });

    app.post('/sessions/:id/messages', async (c) => {
      const sessionId = c.req.param('id');
      const body = await c.req.json();
      sessionManager.appendMessages(sessionId, body.messages);
      return c.json({ success: true });
    });

    server = await startTestServer(app);
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const res = await fetch(`${server.url}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
    });
  });

  describe('Session Lifecycle', () => {
    let sessionId: string;

    it('should create a new session', async () => {
      const res = await fetch(`${server.url}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test-user',
          metadata: { source: 'e2e-test' },
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session).toBeDefined();
      expect(data.session.id).toBeTruthy();
      expect(data.session.userId).toBe('test-user');
      sessionId = data.session.id;
    });

    it('should list sessions', async () => {
      const res = await fetch(`${server.url}/sessions`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions).toBeInstanceOf(Array);
      expect(data.sessions.length).toBeGreaterThan(0);
    });

    it('should get session by ID', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session.id).toBe(sessionId);
    });

    it('should append messages to session', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there!' },
          ],
        }),
      });

      expect(res.status).toBe(200);

      // Verify messages were added
      const sessionRes = await fetch(`${server.url}/sessions/${sessionId}`);
      const sessionData = await sessionRes.json();
      expect(sessionData.session.messages.length).toBe(2);
    });

    it('should delete session', async () => {
      const res = await fetch(`${server.url}/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.deleted).toBe(true);

      // Verify session is deleted
      const getRes = await fetch(`${server.url}/sessions/${sessionId}`);
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await fetch(`${server.url}/sessions/non-existent-id`);
      expect(res.status).toBe(404);
    });
  });

  describe('Multiple Sessions', () => {
    it('should handle multiple concurrent sessions', async () => {
      // Create multiple sessions
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        fetch(`${server.url}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: `user-${i}`,
            metadata: { index: i },
          }),
        }).then((r) => r.json())
      );

      const results = await Promise.all(createPromises);
      const sessionIds = results.map((r) => r.session.id);

      // Verify all sessions were created
      expect(sessionIds.length).toBe(5);
      expect(new Set(sessionIds).size).toBe(5); // All unique

      // Add messages to each session concurrently
      const messagePromises = sessionIds.map((id) =>
        fetch(`${server.url}/sessions/${id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: `Message for ${id}` }],
          }),
        })
      );

      await Promise.all(messagePromises);

      // Verify each session has its message
      for (const id of sessionIds) {
        const res = await fetch(`${server.url}/sessions/${id}`);
        const data = await res.json();
        expect(data.session.messages.length).toBe(1);
        expect(data.session.messages[0].content).toContain(id);
      }

      // Cleanup
      await Promise.all(
        sessionIds.map((id) =>
          fetch(`${server.url}/sessions/${id}`, { method: 'DELETE' })
        )
      );
    });
  });
});
