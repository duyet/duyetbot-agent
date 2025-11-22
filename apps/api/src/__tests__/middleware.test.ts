/**
 * Middleware Tests
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { loggerMiddleware } from '../middleware/logger.js';
import { cleanupRateLimits, rateLimitMiddleware } from '../middleware/rate-limit.js';

// Mock fetch for auth tests
vi.stubGlobal('fetch', vi.fn());

describe('authMiddleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    vi.mocked(fetch).mockReset();
  });

  it('should reject request without authorization header', async () => {
    app.use('*', authMiddleware());
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authorization');
  });

  it('should accept valid GitHub token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 123, login: 'testuser' }),
    } as Response);

    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      return c.json({ user });
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe('github:123');
    expect(body.user.username).toBe('testuser');
  });

  it('should reject invalid GitHub token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    app.use('*', authMiddleware());
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    expect(res.status).toBe(401);
  });

  it('should accept API key when set', async () => {
    process.env.API_KEY = 'test-api-key';
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    app.use('*', authMiddleware());
    app.get('/test', (c) => {
      const user = c.get('user');
      return c.json({ user });
    });

    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer test-api-key' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.type).toBe('api');

    process.env.API_KEY = undefined;
  });
});

describe('optionalAuthMiddleware', () => {
  it('should allow request without token', async () => {
    const app = new Hono();
    app.use('*', optionalAuthMiddleware());
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    cleanupRateLimits();
  });

  it('should allow requests within limit', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware(10));
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
  });

  it('should block requests exceeding limit', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware(2));
    app.get('/test', (c) => c.json({ success: true }));

    // First two requests should succeed
    await app.request('/test');
    await app.request('/test');

    // Third request should be rate limited
    const res = await app.request('/test');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Rate limit');
  });

  it('should set rate limit headers', async () => {
    const app = new Hono();
    app.use('*', rateLimitMiddleware(100));
    app.get('/test', (c) => c.json({ success: true }));

    // Use unique IP to avoid state from other tests
    const res = await app.request('/test', {
      headers: { 'x-forwarded-for': `unique-ip-${Date.now()}` },
    });
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('99');
    expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});

describe('loggerMiddleware', () => {
  it('should add request ID header', async () => {
    const app = new Hono();
    app.use('*', loggerMiddleware());
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Request-Id')).toBeDefined();
    expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
  });

  it('should set request context', async () => {
    const app = new Hono();
    app.use('*', loggerMiddleware());
    app.get('/test', (c) => {
      return c.json({
        requestId: c.get('requestId'),
        startTime: c.get('startTime'),
      });
    });

    const res = await app.request('/test');
    const body = await res.json();
    expect(body.requestId).toMatch(/^req_/);
    expect(body.startTime).toBeTypeOf('number');
  });
});
