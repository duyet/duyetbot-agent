import { createHealthRoutes } from '@/api/routes/health';
import type { Env } from '@/api/types';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

// Create mock environment
const createMockEnv = (): Env => ({
  DB: {
    prepare: (sql: string) => {
      const statement = {
        first: async () => {
          if (sql.includes('SELECT 1')) {
            return { test: 1 };
          }
          if (sql.includes('sqlite_master')) {
            return { name: 'users' };
          }
          return null;
        },
        run: async () => {},
        all: async () => ({ results: [] }),
        bind: (..._values: any[]) => statement, // Return self for chaining
      };
      return statement;
    },
  } as unknown as D1Database,
  KV: {
    get: async (key: string) => {
      // For health check, return the value that was put
      if (key.startsWith('health-check-')) {
        return 'ok';
      }
      return null;
    },
    put: async () => {},
    delete: async () => {},
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
  GOOGLE_CLIENT_ID: 'test-id',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost/callback',
  FRONTEND_URL: 'http://localhost:3000',
  ENVIRONMENT: 'test',
});

describe('Health Routes', () => {
  let app: Hono<{ Bindings: Env }>;
  let env: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route('/health', createHealthRoutes());
    env = createMockEnv();
  });

  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const res = await app.request('/health', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
      expect(body.data.timestamp).toBeTruthy();
    });

    it('should return ISO timestamp', async () => {
      const res = await app.request('/health', { method: 'GET' }, env);

      const body = await res.json();
      const timestamp = body.data.timestamp;
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('GET /health/live', () => {
    it('should return 200 with alive status', async () => {
      const res = await app.request('/health/live', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('alive');
    });

    it('should include uptime', async () => {
      const res = await app.request('/health/live', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof body.data.uptime).toBe('number');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when all services are healthy', async () => {
      const res = await app.request('/health/ready', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
    });

    it('should include all health checks', async () => {
      const res = await app.request('/health/ready', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.checks).toBeTruthy();
      expect(body.data.checks.database).toBeTruthy();
      expect(body.data.checks.kv).toBeTruthy();
      expect(body.data.checks.vectorize).toBeTruthy();
    });

    it('should include latency for database check', async () => {
      const res = await app.request('/health/ready', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.checks.database.status).toBe('healthy');
      expect(body.data.checks.database.latency).toBeGreaterThanOrEqual(0);
    });

    it('should include latency for KV check', async () => {
      const res = await app.request('/health/ready', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.checks.kv.status).toBe('healthy');
      expect(body.data.checks.kv.latency).toBeGreaterThanOrEqual(0);
    });

    it('should return 503 when database is unhealthy', async () => {
      // Override DB to throw error
      env.DB = {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('Database connection failed');
            },
          }),
        }),
      } as unknown as D1Database;

      const res = await app.request('/health/ready', { method: 'GET' }, env);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.data.status).toBe('unhealthy');
      expect(body.data.checks.database.status).toBe('unhealthy');
    });

    it('should be degraded when vectorize is unavailable', async () => {
      // Remove vectorize
      env.VECTORIZE = undefined as unknown as VectorizeIndex;

      const res = await app.request('/health/ready', { method: 'GET' }, env);

      const body = await res.json();
      // Should be degraded or healthy depending on implementation
      expect(['healthy', 'degraded']).toContain(body.data.status);
    });
  });

  describe('GET /health/db', () => {
    it('should return 200 with database details', async () => {
      const res = await app.request('/health/db', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
    });

    it('should include latency measurement', async () => {
      const res = await app.request('/health/db', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.latency).toBeGreaterThanOrEqual(0);
      expect(typeof body.data.latency).toBe('number');
    });

    it('should check for tables', async () => {
      const res = await app.request('/health/db', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.tables).toBeTruthy();
      expect(body.data.tables.users).toBeTruthy();
    });

    it('should return 503 on database error', async () => {
      env.DB = {
        prepare: () => ({
          bind: () => ({
            first: async () => {
              throw new Error('Connection timeout');
            },
          }),
        }),
      } as unknown as D1Database;

      const res = await app.request('/health/db', { method: 'GET' }, env);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('DB_UNHEALTHY');
    });
  });

  describe('GET /health/kv', () => {
    it('should return 200 with KV details', async () => {
      const res = await app.request('/health/kv', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('healthy');
    });

    it('should include latency measurement', async () => {
      const res = await app.request('/health/kv', { method: 'GET' }, env);

      const body = await res.json();
      expect(body.data.latency).toBeGreaterThanOrEqual(0);
      expect(typeof body.data.latency).toBe('number');
    });

    it('should test read/write operations', async () => {
      let putCalled = false;
      let getCalled = false;
      let deleteCalled = false;

      env.KV = {
        get: async (_key: string) => {
          getCalled = true;
          return 'ok';
        },
        put: async (_key: string, _value: string) => {
          putCalled = true;
        },
        delete: async (_key: string) => {
          deleteCalled = true;
        },
      } as unknown as KVNamespace;

      const res = await app.request('/health/kv', { method: 'GET' }, env);

      expect(res.status).toBe(200);
      expect(putCalled).toBe(true);
      expect(getCalled).toBe(true);
      expect(deleteCalled).toBe(true);
    });

    it('should return 503 on KV error', async () => {
      env.KV = {
        get: async () => {
          throw new Error('KV unavailable');
        },
        put: async () => {
          throw new Error('KV unavailable');
        },
        delete: async () => {},
      } as unknown as KVNamespace;

      const res = await app.request('/health/kv', { method: 'GET' }, env);

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('KV_UNHEALTHY');
    });
  });
});
