/**
 * Tests for rate limiter middleware
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRateLimitStore, createRateLimiter } from '../middleware/rate-limit.js';

describe('createRateLimiter', () => {
  beforeEach(() => {
    // Clear rate limit store before each test
    clearRateLimitStore();
  });

  describe('request limiting', () => {
    it('should allow requests under limit', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 5, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        const res = await app.request('/', {
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        });
        expect(res.status).toBe(200);
      }
    });

    it('should block requests over limit', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 3, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      // Make 3 requests (at limit) - should succeed
      for (let i = 0; i < 3; i++) {
        const res = await app.request('/', {
          headers: { 'cf-connecting-ip': ip },
        });
        expect(res.status).toBe(200);
      }

      // 4th request should be blocked
      const blockedRes = await app.request('/', {
        headers: { 'cf-connecting-ip': ip },
      });
      expect(blockedRes.status).toBe(429);

      const data = await blockedRes.json();
      expect(data.error).toBe('Too Many Requests');
      expect(data.message).toMatch(/Rate limit exceeded/);
    });

    it('should return 429 status for rate limited requests', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 1, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      expect(res.status).toBe(429);
    });

    it('should include retry time in error message', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 1, window: 5000 }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', { headers: { 'cf-connecting-ip': '1.2.3.4' } });
      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      const data = await res.json();
      expect(data.message).toMatch(/Try again in \d+ seconds/);
    });
  });

  describe('window expiration and reset', () => {
    it('should reset count after window expires', async () => {
      const app = new Hono();
      const window = 100; // 100ms window
      app.use('*', createRateLimiter({ limit: 2, window }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      // Use up limit
      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      await app.request('/', { headers: { 'cf-connecting-ip': ip } });

      // Next request should fail
      let res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, window + 50));

      // Should work again after reset
      res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.status).toBe(200);
    });

    it('should track separate windows for different IPs', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 2, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      // IP1 uses up limit
      await app.request('/', { headers: { 'cf-connecting-ip': '1.1.1.1' } });
      await app.request('/', { headers: { 'cf-connecting-ip': '1.1.1.1' } });
      const res1 = await app.request('/', {
        headers: { 'cf-connecting-ip': '1.1.1.1' },
      });
      expect(res1.status).toBe(429);

      // IP2 should still have full limit
      const res2 = await app.request('/', {
        headers: { 'cf-connecting-ip': '2.2.2.2' },
      });
      expect(res2.status).toBe(200);
    });
  });

  describe('X-RateLimit-* headers', () => {
    it('should include X-RateLimit-Limit header', async () => {
      const app = new Hono();
      const limit = 10;
      app.use('*', createRateLimiter({ limit, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBe(limit.toString());
    });

    it('should include X-RateLimit-Remaining header', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 5, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      // First request
      let res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('4'); // 5 - 1

      // Second request
      res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('3'); // 5 - 2
    });

    it('should set X-RateLimit-Remaining to 0 when limit exceeded', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 1, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': ip },
      });

      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('should include X-RateLimit-Reset header with unix timestamp', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 5, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
      });

      const resetHeader = res.headers.get('X-RateLimit-Reset');
      expect(resetHeader).toBeDefined();

      // Should be a valid unix timestamp in seconds
      const resetTimestamp = Number.parseInt(resetHeader!, 10);
      expect(resetTimestamp).toBeGreaterThan(Date.now() / 1000);
      expect(resetTimestamp).toBeLessThan(Date.now() / 1000 + 120); // Within 2 minutes
    });

    it('should include rate limit headers even when limit exceeded', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 1, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': ip },
      });

      expect(res.headers.get('X-RateLimit-Limit')).toBe('1');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });

  describe('IP key generation', () => {
    it('should use cf-connecting-ip header as key', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 2, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      // Use up limit for this IP
      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      const res = await app.request('/', {
        headers: { 'cf-connecting-ip': ip },
      });

      expect(res.status).toBe(429);
    });

    it('should fallback to x-forwarded-for when cf-connecting-ip missing', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 2, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '5.6.7.8';

      // Use up limit using x-forwarded-for
      await app.request('/', { headers: { 'x-forwarded-for': ip } });
      await app.request('/', { headers: { 'x-forwarded-for': ip } });
      const res = await app.request('/', {
        headers: { 'x-forwarded-for': ip },
      });

      expect(res.status).toBe(429);
    });

    it('should extract first IP from x-forwarded-for comma-separated list', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 2, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ipList = '1.2.3.4, 5.6.7.8, 9.10.11.12';

      // Should use first IP (1.2.3.4)
      await app.request('/', { headers: { 'x-forwarded-for': ipList } });
      await app.request('/', { headers: { 'x-forwarded-for': ipList } });
      const res = await app.request('/', {
        headers: { 'x-forwarded-for': ipList },
      });

      expect(res.status).toBe(429);
    });

    it('should use "unknown" key when no IP headers present', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 2, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      // Requests without IP headers share same limit
      await app.request('/');
      await app.request('/');
      const res = await app.request('/');

      expect(res.status).toBe(429);
    });
  });

  describe('custom key generator', () => {
    it('should use custom key generator when provided', async () => {
      const app = new Hono();
      app.use(
        '*',
        createRateLimiter({
          limit: 2,
          window: 60000,
          keyGenerator: (c) => c.req.header('x-user-id') || 'anonymous',
        })
      );
      app.get('/', (c) => c.json({ ok: true }));

      const userId = 'user-123';

      // Use up limit for this user
      await app.request('/', { headers: { 'x-user-id': userId } });
      await app.request('/', { headers: { 'x-user-id': userId } });
      const res = await app.request('/', { headers: { 'x-user-id': userId } });

      expect(res.status).toBe(429);
    });

    it('should track separate limits for different custom keys', async () => {
      const app = new Hono();
      app.use(
        '*',
        createRateLimiter({
          limit: 1,
          window: 60000,
          keyGenerator: (c) => c.req.header('x-api-key') || 'default',
        })
      );
      app.get('/', (c) => c.json({ ok: true }));

      // User 1 uses up limit
      await app.request('/', { headers: { 'x-api-key': 'key1' } });
      const res1 = await app.request('/', { headers: { 'x-api-key': 'key1' } });
      expect(res1.status).toBe(429);

      // User 2 should still have limit
      const res2 = await app.request('/', { headers: { 'x-api-key': 'key2' } });
      expect(res2.status).toBe(200);
    });
  });

  describe('clearRateLimitStore', () => {
    it('should clear all rate limit data', async () => {
      const app = new Hono();
      app.use('*', createRateLimiter({ limit: 1, window: 60000 }));
      app.get('/', (c) => c.json({ ok: true }));

      const ip = '1.2.3.4';

      // Use up limit
      await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      let res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.status).toBe(429);

      // Clear store
      clearRateLimitStore();

      // Should work again after clearing
      res = await app.request('/', { headers: { 'cf-connecting-ip': ip } });
      expect(res.status).toBe(200);
    });
  });
});
