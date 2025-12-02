/**
 * Health Routes
 *
 * Health check endpoints for the server
 */

import { Hono } from 'hono';

/**
 * Create health check routes
 */
export function createHealthRoutes(): Hono {
  const app = new Hono();

  // Basic health check
  app.get('/', (c) => {
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness probe
  app.get('/ready', (c) => {
    return c.json({
      ready: true,
    });
  });

  // Liveness probe
  app.get('/live', (c) => {
    return c.json({
      live: true,
    });
  });

  return app;
}
