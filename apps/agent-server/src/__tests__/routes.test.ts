import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAgentRoutes } from '../routes/agent';
import { createHealthRoutes } from '../routes/health';
import { AgentSessionManager } from '../session-manager';

describe('Health Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/health', createHealthRoutes());
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status', async () => {
      const res = await app.request('/health/ready');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ready).toBe(true);
    });
  });

  describe('GET /health/live', () => {
    it('should return live status', async () => {
      const res = await app.request('/health/live');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.live).toBe(true);
    });
  });
});

describe('Agent Routes', () => {
  let app: Hono;
  let sessionManager: AgentSessionManager;

  beforeEach(() => {
    sessionManager = new AgentSessionManager();
    app = new Hono();
    app.route('/agent', createAgentRoutes(sessionManager));
  });

  describe('POST /agent/sessions', () => {
    it('should create a new session', async () => {
      const res = await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.user_id).toBe('user-123');
      expect(data.state).toBe('active');
    });

    it('should return 400 for missing user_id', async () => {
      const res = await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /agent/sessions/:id', () => {
    it('should get an existing session', async () => {
      // Create session first
      const createRes = await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });
      const created = await createRes.json();

      const res = await app.request(`/agent/sessions/${created.id}`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(created.id);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/agent/sessions/non-existent');

      expect(res.status).toBe(404);
    });
  });

  describe('POST /agent/execute', () => {
    it('should execute a message in a session', { timeout: 10000 }, async () => {
      // Create session first
      const createRes = await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });
      const created = await createRes.json();

      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: created.id,
          message: 'Hello',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session_id).toBe(created.id);
      expect(data.response).toBeDefined();
    });

    it('should return 400 for missing session_id', async () => {
      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello' }),
      });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'non-existent',
          message: 'Hello',
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /agent/sessions/:id', () => {
    it('should delete a session', async () => {
      // Create session first
      const createRes = await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });
      const created = await createRes.json();

      const res = await app.request(`/agent/sessions/${created.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(204);

      // Verify deletion
      const getRes = await app.request(`/agent/sessions/${created.id}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe('GET /agent/sessions', () => {
    it('should list sessions for a user', async () => {
      // Create sessions
      await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });
      await app.request('/agent/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'user-123' }),
      });

      const res = await app.request('/agent/sessions?user_id=user-123');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.sessions).toHaveLength(2);
    });

    it('should return 400 for missing user_id', async () => {
      const res = await app.request('/agent/sessions');

      expect(res.status).toBe(400);
    });
  });
});
