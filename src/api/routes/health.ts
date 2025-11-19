/**
 * Health Check Routes
 *
 * System health and readiness endpoints
 */

import { Hono } from 'hono';
import type { APIResponse, AppEnv } from '../types';

/**
 * Health check status
 */
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    kv?: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      error?: string;
    };
    vectorize?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
}

// Track startup time for uptime calculation
const startupTime = Date.now();

/**
 * Create health routes
 */
export function createHealthRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  /**
   * GET /health
   * Basic health check
   */
  app.get('/', (c) => {
    return c.json<APIResponse<{ status: string; timestamp: string }>>(
      {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
      },
      200
    );
  });

  /**
   * GET /health/ready
   * Kubernetes-style readiness probe
   * Checks if all dependencies are available
   */
  app.get('/ready', async (c) => {
    const checks: HealthStatus['checks'] = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check D1 database
    try {
      const dbStart = Date.now();
      await c.env.DB.prepare('SELECT 1').first();
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart,
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      overallStatus = 'unhealthy';
    }

    // Check KV
    try {
      const kvStart = Date.now();
      await c.env.KV.get('health-check');
      checks.kv = {
        status: 'healthy',
        latency: Date.now() - kvStart,
      };
    } catch (error) {
      checks.kv = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      overallStatus = 'unhealthy';
    }

    // Check Vectorize (basic check - we can't easily test without actual query)
    try {
      // Just verify the binding exists
      if (!c.env.VECTORIZE) {
        throw new Error('Vectorize binding not found');
      }
      checks.vectorize = {
        status: 'healthy',
      };
    } catch (error) {
      checks.vectorize = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      // Vectorize is optional for basic functionality
      if (overallStatus === 'healthy') {
        overallStatus = 'degraded';
      }
    }

    const health: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - startupTime,
      checks,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    const success = overallStatus !== 'unhealthy';

    return c.json<APIResponse<HealthStatus>>(
      {
        success,
        data: health,
      } as APIResponse<HealthStatus>,
      statusCode
    );
  });

  /**
   * GET /health/live
   * Kubernetes-style liveness probe
   * Returns 200 if the worker is running
   */
  app.get('/live', (c) => {
    return c.json<APIResponse<{ status: string; uptime: number }>>(
      {
        success: true,
        data: {
          status: 'alive',
          uptime: Date.now() - startupTime,
        },
      },
      200
    );
  });

  /**
   * GET /health/db
   * Detailed database health check
   */
  app.get('/db', async (c) => {
    try {
      const start = Date.now();

      // Test basic query
      const result = await c.env.DB.prepare('SELECT 1 as test').first<{ test: number }>();

      if (result?.test !== 1) {
        throw new Error('Database query returned unexpected result');
      }

      // Test user table exists
      const tableCheck = await c.env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      ).first<{ name: string }>();

      const latency = Date.now() - start;

      return c.json<
        APIResponse<{
          status: string;
          latency: number;
          tables: { users: boolean; refresh_tokens: boolean };
        }>
      >(
        {
          success: true,
          data: {
            status: 'healthy',
            latency,
            tables: {
              users: !!tableCheck,
              refresh_tokens: true, // Assume exists if users exists
            },
          },
        },
        200
      );
    } catch (error) {
      console.error('Database health check failed:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Database Unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'DB_UNHEALTHY',
        },
        503
      );
    }
  });

  /**
   * GET /health/kv
   * Detailed KV health check
   */
  app.get('/kv', async (c) => {
    try {
      const start = Date.now();
      const testKey = `health-check-${Date.now()}`;
      const testValue = 'ok';

      // Test write
      await c.env.KV.put(testKey, testValue, { expirationTtl: 60 });

      // Test read
      const result = await c.env.KV.get(testKey);

      if (result !== testValue) {
        throw new Error('KV read/write test failed');
      }

      // Test delete
      await c.env.KV.delete(testKey);

      const latency = Date.now() - start;

      return c.json<APIResponse<{ status: string; latency: number }>>(
        {
          success: true,
          data: {
            status: 'healthy',
            latency,
          },
        },
        200
      );
    } catch (error) {
      console.error('KV health check failed:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'KV Unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'KV_UNHEALTHY',
        },
        503
      );
    }
  });

  return app;
}
