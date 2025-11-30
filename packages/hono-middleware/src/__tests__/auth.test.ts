/**
 * Tests for authentication middleware
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuth } from '../middleware/auth.js';

describe('createAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('bearer authentication', () => {
    it('should require Authorization header', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer' }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toMatch(/Missing bearer token/);
    });

    it('should reject invalid Authorization header format', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer' }));
      app.get('/', (c) => c.json({ ok: true }));

      // Missing "Bearer " prefix
      const res = await app.request('/', {
        headers: { Authorization: 'some-token' },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toMatch(/Missing bearer token/);
    });

    it('should allow requests with valid Bearer token format', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer' }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { Authorization: 'Bearer valid-token-123' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should call validate function when provided', async () => {
      const validateFn = vi.fn().mockResolvedValue({ id: 123, name: 'Test User' });

      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', {
        headers: { Authorization: 'Bearer test-token' },
      });

      expect(validateFn).toHaveBeenCalledTimes(1);
      expect(validateFn).toHaveBeenCalledWith('test-token', expect.anything());
    });

    it('should reject when validate returns null', async () => {
      const validateFn = vi.fn().mockResolvedValue(null);

      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toMatch(/Invalid token/);
    });

    it('should set user on context when validate succeeds', async () => {
      const mockUser = { id: 123, name: 'Test User', role: 'admin' };
      const validateFn = vi.fn().mockResolvedValue(mockUser);

      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer', validate: validateFn }));
      app.get('/', (c) => {
        const user = c.get('user');
        return c.json({ user });
      });

      const res = await app.request('/', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toEqual(mockUser);
    });

    it('should extract token correctly from Bearer header', async () => {
      const validateFn = vi.fn().mockResolvedValue({ id: 1 });

      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', {
        headers: { Authorization: 'Bearer my-secret-token-xyz' },
      });

      expect(validateFn).toHaveBeenCalledWith('my-secret-token-xyz', expect.anything());
    });
  });

  describe('API key authentication', () => {
    it('should check default x-api-key header', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key' }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/');

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toMatch(/Missing API key/);
    });

    it('should allow requests with valid API key', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key' }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { 'x-api-key': 'valid-api-key-123' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it('should support custom header name', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key', headerName: 'x-custom-auth' }));
      app.get('/', (c) => c.json({ ok: true }));

      // Default header should not work
      let res = await app.request('/', {
        headers: { 'x-api-key': 'my-key' },
      });
      expect(res.status).toBe(401);

      // Custom header should work
      res = await app.request('/', {
        headers: { 'x-custom-auth': 'my-key' },
      });
      expect(res.status).toBe(200);
    });

    it('should call validate function when provided', async () => {
      const validateFn = vi.fn().mockResolvedValue({ id: 456, plan: 'premium' });

      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', {
        headers: { 'x-api-key': 'test-key' },
      });

      expect(validateFn).toHaveBeenCalledTimes(1);
      expect(validateFn).toHaveBeenCalledWith('test-key', expect.anything());
    });

    it('should reject when validate returns null', async () => {
      const validateFn = vi.fn().mockResolvedValue(null);

      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      const res = await app.request('/', {
        headers: { 'x-api-key': 'invalid-key' },
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toMatch(/Invalid API key/);
    });

    it('should set user on context when validate succeeds', async () => {
      const mockUser = {
        id: 789,
        email: 'test@example.com',
        subscription: 'pro',
      };
      const validateFn = vi.fn().mockResolvedValue(mockUser);

      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key', validate: validateFn }));
      app.get('/', (c) => {
        const user = c.get('user');
        return c.json({ user });
      });

      const res = await app.request('/', {
        headers: { 'x-api-key': 'valid-key' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user).toEqual(mockUser);
    });

    it('should pass correct API key to validate function', async () => {
      const validateFn = vi.fn().mockResolvedValue({ id: 1 });

      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key', validate: validateFn }));
      app.get('/', (c) => c.json({ ok: true }));

      await app.request('/', {
        headers: { 'x-api-key': 'my-secret-api-key' },
      });

      expect(validateFn).toHaveBeenCalledWith('my-secret-api-key', expect.anything());
    });
  });

  describe('without validation', () => {
    it('should allow bearer requests without validate function', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer' }));
      app.get('/', (c) => c.json({ authenticated: true }));

      const res = await app.request('/', {
        headers: { Authorization: 'Bearer any-token' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
    });

    it('should allow api-key requests without validate function', async () => {
      const app = new Hono();
      app.use('*', createAuth({ type: 'api-key' }));
      app.get('/', (c) => c.json({ authenticated: true }));

      const res = await app.request('/', {
        headers: { 'x-api-key': 'any-key' },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.authenticated).toBe(true);
    });
  });

  describe('context passing', () => {
    it('should pass context to validate function', async () => {
      let receivedContext: unknown;
      const validateFn = vi.fn().mockImplementation(async (_token, c) => {
        receivedContext = c;
        return { id: 1 };
      });

      const app = new Hono();
      app.use('*', createAuth({ type: 'bearer', validate: validateFn }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test', {
        headers: { Authorization: 'Bearer token' },
      });

      expect(receivedContext).toBeDefined();
      expect(typeof receivedContext).toBe('object');
    });
  });
});
