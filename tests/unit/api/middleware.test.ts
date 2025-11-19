import { generateAccessToken } from '@/api/auth/jwt';
import { authMiddleware, getOptionalUser, getUser } from '@/api/middleware/auth';
import { corsMiddleware } from '@/api/middleware/cors';
import { rateLimitMiddleware } from '@/api/middleware/rate-limit';
import type { Env, User } from '@/api/types';
import type { R2Bucket, VectorizeIndex } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock user for tests
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  picture: null,
  provider: 'github',
  providerId: 'gh-123',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Create mock environment
const createMockEnv = (): Env => ({
  DB: {
    prepare: (sql: string) => ({
      bind: (..._values: any[]) => ({
        first: async () => {
          if (sql.includes('SELECT * FROM users WHERE id')) {
            return {
              id: mockUser.id,
              email: mockUser.email,
              name: mockUser.name,
              picture: mockUser.picture,
              provider: mockUser.provider,
              provider_id: mockUser.providerId,
              created_at: mockUser.createdAt.getTime(),
              updated_at: mockUser.updatedAt.getTime(),
              settings: null,
            };
          }
          return null;
        },
        run: async () => {},
        all: async () => ({ results: [] }),
      }),
    }),
  } as unknown as D1Database,
  KV: {
    get: vi.fn(async () => null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  } as unknown as KVNamespace,
  VECTORIZE: {} as VectorizeIndex,
  R2: {} as R2Bucket,
  JWT_SECRET: 'test-secret',
  ANTHROPIC_API_KEY: 'test-key',
  OPENAI_API_KEY: 'test-key',
  OPENROUTER_API_KEY: 'test-key',
  GITHUB_CLIENT_ID: 'test-id',
  GITHUB_CLIENT_SECRET: 'test-secret',
  GITHUB_REDIRECT_URI: 'http://localhost/callback',
  GITHUB_WEBHOOK_SECRET: 'test-secret',
  GOOGLE_CLIENT_ID: 'test-id',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost/callback',
  FRONTEND_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:8787',
  WEB_URL: 'http://localhost:3000',
  ENVIRONMENT: 'test',
});

describe('Auth Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
  });

  describe('authMiddleware', () => {
    it('should reject request without token', async () => {
      app.get('/test', authMiddleware, (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        method: 'GET',
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject request with malformed token', async () => {
      app.get('/test', authMiddleware, (c) => c.json({ success: true }));

      const res = await app.request(
        '/test',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        },
        env
      );

      expect(res.status).toBe(401);
    });

    it('should accept request with valid token', async () => {
      const token = await generateAccessToken(mockUser, env.JWT_SECRET);

      app.get('/test', authMiddleware, (c) => {
        const user = getUser(c as any);
        return c.json({ userId: user.id });
      });

      const res = await app.request(
        '/test',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.userId).toBe(mockUser.id);
    });

    it('should reject token with wrong secret', async () => {
      const token = await generateAccessToken(mockUser, 'wrong-secret');

      app.get('/test', authMiddleware, (c) => c.json({ success: true }));

      const res = await app.request(
        '/test',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env
      );

      expect(res.status).toBe(401);
    });
  });

  describe('getUser', () => {
    it('should return user from context', async () => {
      const token = await generateAccessToken(mockUser, env.JWT_SECRET);

      app.get('/test', authMiddleware, (c) => {
        const user = getUser(c as any);
        expect(user).toBeTruthy();
        expect(user.id).toBe(mockUser.id);
        return c.json({ success: true });
      });

      await app.request(
        '/test',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env
      );
    });

    it('should throw if user not in context', () => {
      app.get('/test', (c) => {
        expect(() => getUser(c as any)).toThrow('User not found in context');
        return c.json({ success: true });
      });

      app.request('/test', { method: 'GET' }, env);
    });
  });

  describe('getOptionalUser', () => {
    it('should return user if authenticated', async () => {
      const token = await generateAccessToken(mockUser, env.JWT_SECRET);

      app.get('/test', authMiddleware, (c) => {
        const user = getOptionalUser(c as any);
        expect(user).toBeTruthy();
        expect(user?.id).toBe(mockUser.id);
        return c.json({ success: true });
      });

      await app.request(
        '/test',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        env
      );
    });

    it('should return undefined if not authenticated', async () => {
      app.get('/test', (c) => {
        const user = getOptionalUser(c as any);
        expect(user).toBeUndefined();
        return c.json({ success: true });
      });

      await app.request('/test', { method: 'GET' }, env);
    });
  });
});

describe('CORS Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
    app.use('*', corsMiddleware);
    app.get('/test', (c) => c.json({ success: true }));
  });

  it('should add CORS headers for allowed origin', async () => {
    const res = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      },
      env
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('should not add CORS headers for non-allowed origin', async () => {
    const res = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          Origin: 'https://evil.com',
        },
      },
      env
    );

    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('should handle OPTIONS preflight request', async () => {
    const res = await app.request(
      '/test',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
        },
      },
      env
    );

    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
  });

  it('should set allowed methods', async () => {
    const res = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          Origin: 'http://localhost:3000',
        },
      },
      env
    );

    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('Rate Limit Middleware', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;
  let kvStore: Map<string, any>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    env = createMockEnv();
    kvStore = new Map();

    // Mock KV with in-memory store
    env.KV = {
      get: vi.fn(async (key: string, type?: string) => {
        const value = kvStore.get(key);
        if (!value) {
          return null;
        }
        if (type === 'json') {
          return JSON.parse(value);
        }
        return value;
      }),
      put: vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      }),
      delete: vi.fn(async (key: string) => {
        kvStore.delete(key);
      }),
    } as unknown as KVNamespace;
  });

  it('should allow requests under limit', async () => {
    app.use('*', rateLimitMiddleware({ maxRequests: 5, windowSeconds: 60 }));
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
  });

  it('should block requests over limit', async () => {
    app.use('*', rateLimitMiddleware({ maxRequests: 2, windowSeconds: 60 }));
    app.get('/test', (c) => c.json({ success: true }));

    // First request - OK
    await app.request('/test', { method: 'GET' }, env);

    // Second request - OK
    await app.request('/test', { method: 'GET' }, env);

    // Third request - Rate limited
    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.status).toBe(429);
    const body = (await res.json()) as any;
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should set rate limit headers', async () => {
    app.use('*', rateLimitMiddleware({ maxRequests: 10, windowSeconds: 60 }));
    app.get('/test', (c) => c.json({ success: true }));

    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
    expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
  });

  it('should set Retry-After header when rate limited', async () => {
    app.use('*', rateLimitMiddleware({ maxRequests: 1, windowSeconds: 60 }));
    app.get('/test', (c) => c.json({ success: true }));

    // First request - OK
    await app.request('/test', { method: 'GET' }, env);

    // Second request - Rate limited
    const res = await app.request('/test', { method: 'GET' }, env);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    const retryAfterHeader = res.headers.get('Retry-After');
    if (!retryAfterHeader) {
      throw new Error('Expected Retry-After header');
    }
    const retryAfter = Number.parseInt(retryAfterHeader);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('should track separate limits per IP', async () => {
    app.use('*', rateLimitMiddleware({ maxRequests: 1, windowSeconds: 60 }));
    app.get('/test', (c) => c.json({ success: true }));

    // Request from IP 1 - OK
    const res1 = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          'CF-Connecting-IP': '1.1.1.1',
        },
      },
      env
    );
    expect(res1.status).toBe(200);

    // Another request from IP 1 - Rate limited
    const res2 = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          'CF-Connecting-IP': '1.1.1.1',
        },
      },
      env
    );
    expect(res2.status).toBe(429);

    // Request from IP 2 - OK (different IP)
    const res3 = await app.request(
      '/test',
      {
        method: 'GET',
        headers: {
          'CF-Connecting-IP': '2.2.2.2',
        },
      },
      env
    );
    expect(res3.status).toBe(200);
  });
});
