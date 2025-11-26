/**
 * Tests for logger middleware
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../middleware/logger.js';

describe('createLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to capture output
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('request ID generation', () => {
    it('should generate request IDs using crypto.randomUUID', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/', (c) => c.json({ requestId: c.get('requestId') }));

      const res = await app.request('/');
      const data = await res.json();

      expect(data.requestId).toBeDefined();
      expect(typeof data.requestId).toBe('string');
    });

    it('should generate 8-character request IDs', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/', (c) => c.json({ requestId: c.get('requestId') }));

      const res = await app.request('/');
      const data = await res.json();

      expect(data.requestId).toHaveLength(8);
    });

    it('should generate unique request IDs for concurrent requests', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/', (c) => c.json({ requestId: c.get('requestId') }));

      // Make multiple concurrent requests
      const requests = await Promise.all([app.request('/'), app.request('/'), app.request('/')]);

      const ids = await Promise.all(requests.map((r) => r.json().then((d) => d.requestId)));

      // All IDs should be unique
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('context integration', () => {
    it('should add request ID to context', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/', (c) => {
        const requestId = c.get('requestId');
        return c.json({ requestId, hasRequestId: !!requestId });
      });

      const res = await app.request('/');
      const data = await res.json();

      expect(data.hasRequestId).toBe(true);
      expect(data.requestId).toBeDefined();
    });
  });

  describe('JSON format logging', () => {
    it('should log in JSON format by default', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/test', (c) => c.json({ success: true }));

      await app.request('/test');

      expect(console.log).toHaveBeenCalledTimes(1);
      const logCall = vi.mocked(console.log).mock.calls[0][0];

      // Should be valid JSON
      expect(() => JSON.parse(logCall)).not.toThrow();

      const logData = JSON.parse(logCall);
      expect(logData).toMatchObject({
        method: 'GET',
        path: '/test',
        status: 200,
      });
      expect(logData.id).toBeDefined();
      expect(logData.duration).toBeTypeOf('number');
    });

    it('should log request method correctly', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.post('/api/test', (c) => c.json({ ok: true }));

      await app.request('/api/test', { method: 'POST' });

      const logCall = vi.mocked(console.log).mock.calls[0][0];
      const logData = JSON.parse(logCall);

      expect(logData.method).toBe('POST');
    });

    it('should log request path correctly', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/api/users/123', (c) => c.json({ id: 123 }));

      await app.request('/api/users/123');

      const logCall = vi.mocked(console.log).mock.calls[0][0];
      const logData = JSON.parse(logCall);

      expect(logData.path).toBe('/api/users/123');
    });

    it('should log response status correctly', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/success', (c) => c.json({ ok: true }, 201));
      app.get('/error', (c) => c.json({ error: 'Not found' }, 404));

      await app.request('/success');
      await app.request('/error');

      const successLog = JSON.parse(vi.mocked(console.log).mock.calls[0][0]);
      const errorLog = JSON.parse(vi.mocked(console.log).mock.calls[1][0]);

      expect(successLog.status).toBe(201);
      expect(errorLog.status).toBe(404);
    });
  });

  describe('text format logging', () => {
    it('should log in text format when specified', async () => {
      const app = new Hono();
      app.use('*', createLogger({ format: 'text' }));
      app.get('/test', (c) => c.json({ success: true }));

      await app.request('/test');

      const logCall = vi.mocked(console.log).mock.calls[0][0];

      // Should NOT be valid JSON (should be text format)
      expect(() => JSON.parse(logCall)).toThrow();

      // Should contain key information
      expect(logCall).toMatch(/GET/);
      expect(logCall).toMatch(/\/test/);
      expect(logCall).toMatch(/200/);
      expect(logCall).toMatch(/ms/);
    });

    it('should include request ID in text format', async () => {
      const app = new Hono();
      app.use('*', createLogger({ format: 'text' }));
      app.get('/', (c) => c.text('OK'));

      await app.request('/');

      const logCall = vi.mocked(console.log).mock.calls[0][0];

      // Should contain request ID in brackets
      expect(logCall).toMatch(/\[.{8}\]/);
    });
  });

  describe('duration measurement', () => {
    it('should measure request duration', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/slow', async (c) => {
        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 50));
        return c.json({ done: true });
      });

      await app.request('/slow');

      const logCall = vi.mocked(console.log).mock.calls[0][0];
      const logData = JSON.parse(logCall);

      // Duration should be at least 50ms
      expect(logData.duration).toBeGreaterThanOrEqual(50);
      expect(logData.duration).toBeTypeOf('number');
    });

    it('should measure duration for fast requests', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/fast', (c) => c.json({ done: true }));

      await app.request('/fast');

      const logCall = vi.mocked(console.log).mock.calls[0][0];
      const logData = JSON.parse(logCall);

      // Duration should be a non-negative number
      expect(logData.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should log even when handler throws error', async () => {
      const app = new Hono();
      app.use('*', createLogger());
      app.get('/error', () => {
        throw new Error('Test error');
      });

      try {
        await app.request('/error');
      } catch {
        // Expected to throw
      }

      // Logger should still have logged
      expect(console.log).toHaveBeenCalled();
    });
  });
});
