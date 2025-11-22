import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type TestServer, startTestServer } from '../helpers/server';

describe('API Gateway E2E', () => {
  let server: TestServer;

  beforeAll(async () => {
    // Create a self-contained test API app
    const app = new Hono();

    // Request ID middleware - must be registered BEFORE routes
    app.use('*', async (c, next) => {
      const requestId = `req_${Math.random().toString(36).slice(2)}`;
      c.header('x-request-id', requestId);
      await next();
    });

    // Health endpoints
    app.get('/health', (c) => c.json({ status: 'healthy', timestamp: Date.now() }));
    app.get('/health/ready', (c) => c.json({ ready: true }));
    app.get('/health/live', (c) => c.json({ live: true }));

    // Simple rate limiting (in-memory)
    const requestCounts = new Map<string, { count: number; resetTime: number }>();
    app.use('/api/*', async (c, next) => {
      const ip = c.req.header('x-forwarded-for') || 'unknown';
      const now = Date.now();
      const windowMs = 60000;
      const max = 100;

      let record = requestCounts.get(ip);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
        requestCounts.set(ip, record);
      }

      record.count++;
      c.header('x-ratelimit-limit', max.toString());
      c.header('x-ratelimit-remaining', Math.max(0, max - record.count).toString());

      if (record.count > max) {
        return c.json({ error: 'Too many requests' }, 429);
      }

      await next();
    });

    // Test API route
    app.get('/api/test', (c) => c.json({ message: 'ok' }));

    // Auth protected route
    app.get('/api/auth/profile', (c) => {
      const apiKey = c.req.header('x-api-key');
      const authHeader = c.req.header('authorization');

      if (!apiKey && !authHeader) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      // Simple validation
      if (apiKey === 'valid-key' || authHeader === 'Bearer valid-token') {
        return c.json({ user: { id: 'user-1', name: 'Test User' } });
      }

      return c.json({ error: 'Invalid credentials' }, 401);
    });

    server = await startTestServer(app);
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Health Endpoints', () => {
    it('should return health status', async () => {
      const res = await fetch(`${server.url}/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
    });

    it('should return ready status', async () => {
      const res = await fetch(`${server.url}/health/ready`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ready).toBe(true);
    });

    it('should return live status', async () => {
      const res = await fetch(`${server.url}/health/live`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.live).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers', async () => {
      const res = await fetch(`${server.url}/api/test`);
      expect(res.status).toBe(200);
      expect(res.headers.get('x-ratelimit-limit')).toBe('100');
      expect(res.headers.get('x-ratelimit-remaining')).toBeTruthy();
    });
  });

  describe('Authentication', () => {
    it('should reject unauthenticated requests', async () => {
      const res = await fetch(`${server.url}/api/auth/profile`);
      expect(res.status).toBe(401);
    });

    it('should accept valid API key', async () => {
      const res = await fetch(`${server.url}/api/auth/profile`, {
        headers: { 'x-api-key': 'valid-key' },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toBeDefined();
    });

    it('should accept valid bearer token', async () => {
      const res = await fetch(`${server.url}/api/auth/profile`, {
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(res.status).toBe(200);
    });

    it('should reject invalid credentials', async () => {
      const res = await fetch(`${server.url}/api/auth/profile`, {
        headers: { 'x-api-key': 'invalid-key' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('Request Tracking', () => {
    it('should add request ID to response', async () => {
      const res = await fetch(`${server.url}/health`);
      const requestId = res.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(/^req_/);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await fetch(`${server.url}/unknown/route`);
      expect(res.status).toBe(404);
    });
  });
});
