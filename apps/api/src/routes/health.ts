/**
 * Health Check Routes
 */

import { Hono } from 'hono';

const health = new Hono();

/**
 * Basic health check
 */
health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  });
});

/**
 * Detailed health check
 */
health.get('/detailed', async (c) => {
  const checks = {
    api: 'healthy',
    memory: 'healthy',
    uptime: process.uptime(),
  };

  // Check MCP server if configured
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (mcpUrl) {
    try {
      const response = await fetch(`${mcpUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      checks.memory = response.ok ? 'healthy' : 'degraded';
    } catch {
      checks.memory = 'unhealthy';
    }
  }

  const allHealthy = Object.values(checks).every((v) => v === 'healthy' || typeof v === 'number');

  return c.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    allHealthy ? 200 : 503
  );
});

/**
 * Readiness check
 */
health.get('/ready', (c) => {
  return c.json({ ready: true });
});

/**
 * Liveness check
 */
health.get('/live', (c) => {
  return c.json({ live: true });
});

export { health };
