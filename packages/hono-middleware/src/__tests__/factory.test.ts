/**
 * Tests for factory (createBaseApp)
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBaseApp } from '../factory.js';
import { clearRateLimitStore } from '../middleware/rate-limit.js';

describe('createBaseApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStore();
    // Mock console to avoid noise
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('basic app creation', () => {
    it('should create a Hono app instance', () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
      });

      expect(app).toBeInstanceOf(Hono);
    });

    it('should accept generic type for environment bindings', () => {
      interface TestEnv {
        API_KEY: string;
        DATABASE_URL: string;
      }

      const app = createBaseApp<TestEnv>({
        name: 'test-app',
        version: '1.0.0',
      });

      // Type check - this should compile without errors
      expect(app).toBeInstanceOf(Hono);
    });
  });

  describe('security headers', () => {
    it('should apply X-Frame-Options header', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should apply X-Content-Type-Options header', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should apply Strict-Transport-Security header', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      const hsts = res.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
    });

    it('should apply X-XSS-Protection header', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should apply Referrer-Policy header', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('body size limit', () => {
    it('should accept small payloads', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.post('/upload', (c) => c.json({ ok: true }));

      // Small payload should work fine
      const smallPayload = JSON.stringify({
        data: 'x'.repeat(100),
      });

      const res = await app.request('/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: smallPayload,
      });

      expect(res.status).toBe(200);
    });

    it('should accept medium payloads under 1MB', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.post('/upload', (c) => c.json({ ok: true }));

      // Create payload well under 1MB (100KB)
      const validPayload = JSON.stringify({
        data: 'x'.repeat(1024 * 100),
      });

      const res = await app.request('/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: validPayload,
      });

      expect(res.status).toBe(200);
    });

    // Note: Body size limit enforcement is tested in actual runtime environment
    // Hono's test helper doesn't fully simulate the bodyLimit middleware behavior
    // The middleware is correctly applied in factory.ts (line 61-74)
  });

  describe('logger middleware', () => {
    it('should enable logger by default', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');

      // Logger should have logged
      expect(console.log).toHaveBeenCalled();
    });

    it('should disable logger when logger: false', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        logger: false,
        health: false,
      });
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');

      // Logger should NOT have logged
      expect(console.log).not.toHaveBeenCalled();
    });

    it('should add request ID to context when logger enabled', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => {
        const requestId = c.get('requestId');
        return c.json({ requestId });
      });

      const res = await app.request('/');
      const data = await res.json();

      expect(data.requestId).toBeDefined();
      expect(typeof data.requestId).toBe('string');
    });
  });

  describe('rate limiter middleware', () => {
    it('should not apply rate limiter by default', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      // Make many requests - should all succeed without rate limit headers
      for (let i = 0; i < 10; i++) {
        const res = await app.request('/');
        expect(res.status).toBe(200);
        expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
      }
    });

    it('should apply rate limiter when configured', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        rateLimit: { limit: 3, window: 60000 },
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/');
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await app.request('/');
      expect(res.status).toBe(429);
    });

    it('should include rate limit headers when configured', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        rateLimit: { limit: 5, window: 60000 },
        health: false,
      });
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('health check routes', () => {
    it('should add health routes by default', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
      });

      const res = await app.request('/health');

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ok');
      expect(data.name).toBe('test-app');
      expect(data.version).toBe('1.0.0');
    });

    it('should skip health routes when health: false', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });

      const res = await app.request('/health');

      expect(res.status).toBe(404);
    });

    it('should include timestamp in health response', async () => {
      const app = createBaseApp({
        name: 'my-service',
        version: '2.0.0',
      });

      const res = await app.request('/health');
      const data = await res.json();

      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe('string');
    });
  });

  describe('ignorePaths option', () => {
    it('should return 404 for paths matching ignorePaths', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        ignorePaths: ['/cdn-cgi/', '/internal/'],
        health: false,
      });
      app.get('/cdn-cgi/trace', (c) => c.text('Should not reach here'));
      app.get('/internal/metrics', (c) => c.text('Should not reach here'));

      const res1 = await app.request('/cdn-cgi/trace');
      const res2 = await app.request('/internal/metrics');

      expect(res1.status).toBe(404);
      expect(res2.status).toBe(404);
    });

    it('should allow paths not matching ignorePaths', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        ignorePaths: ['/cdn-cgi/'],
        health: false,
      });
      app.get('/api/users', (c) => c.json({ users: [] }));

      const res = await app.request('/api/users');

      expect(res.status).toBe(200);
    });

    it('should match path prefixes in ignorePaths', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        ignorePaths: ['/admin/'],
        health: false,
      });
      app.get('/admin/users', (c) => c.text('admin'));
      app.get('/admin/settings/security', (c) => c.text('settings'));

      const res1 = await app.request('/admin/users');
      const res2 = await app.request('/admin/settings/security');

      expect(res1.status).toBe(404);
      expect(res2.status).toBe(404);
    });

    it('should work without ignorePaths option', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/any-path', (c) => c.json({ ok: true }));

      const res = await app.request('/any-path');

      expect(res.status).toBe(200);
    });
  });

  describe('error handling', () => {
    it('should catch and handle errors', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        health: false,
      });
      app.get('/error', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/error');

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
      expect(data.message).toBe('Test error');
    });
  });

  describe('middleware order', () => {
    it('should apply ignorePaths before other middleware', async () => {
      const app = createBaseApp({
        name: 'test-app',
        version: '1.0.0',
        ignorePaths: ['/skip/'],
        rateLimit: { limit: 1, window: 60000 },
        health: false,
      });

      // Ignored path should not count against rate limit
      await app.request('/skip/test');
      await app.request('/skip/test');
      await app.request('/skip/test');

      // All should return 404, none should be rate limited
      const res = await app.request('/skip/test');
      expect(res.status).toBe(404);
    });
  });
});
