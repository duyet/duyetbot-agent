/**
 * API Gateway Entry Point
 *
 * Unified HTTP API for duyetbot services
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';
import { loggerMiddleware } from './middleware/logger.js';
import { cleanupRateLimits, rateLimitMiddleware } from './middleware/rate-limit.js';
import { agent } from './routes/agent.js';
import { github } from './routes/github.js';
import { health } from './routes/health.js';
import { telegram } from './routes/telegram.js';
import type { APIConfig } from './types.js';

export { authMiddleware, optionalAuthMiddleware } from './middleware/auth.js';
export { loggerMiddleware } from './middleware/logger.js';
export { rateLimitMiddleware } from './middleware/rate-limit.js';
export { agent } from './routes/agent.js';
export { github } from './routes/github.js';
export { health } from './routes/health.js';
export { telegram } from './routes/telegram.js';
export type { APIConfig, AgentRequest, AgentResponse, AuthUser } from './types.js';

/**
 * Create API Gateway app
 */
export function createApp(config: Partial<APIConfig> = {}) {
  const app = new Hono();

  // CORS middleware
  app.use(
    '*',
    cors({
      origin: config.corsOrigins || '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposeHeaders: [
        'X-Request-Id',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-RateLimit-Reset',
      ],
    })
  );

  // Logging middleware
  if (config.enableLogging !== false) {
    app.use('*', loggerMiddleware());
  }

  // Rate limiting middleware
  if (config.enableRateLimit !== false) {
    app.use('*', rateLimitMiddleware(config.rateLimit || 60));
  }

  // Health routes (no auth required)
  app.route('/health', health);

  // Agent routes (auth required)
  app.use('/agent/*', authMiddleware());
  app.route('/agent', agent);

  // GitHub webhook routes (signature verification in route)
  app.route('/github', github);

  // Telegram webhook routes (token verification in route)
  app.route('/telegram', telegram);

  // Root endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'duyetbot-api',
      version: process.env.npm_package_version || '0.1.0',
      endpoints: {
        health: '/health',
        agent: '/agent',
        github: '/github',
        telegram: '/telegram',
      },
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: 'Not found' }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(
      {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  });

  return app;
}

/**
 * Start the API server
 */
export async function startServer(config: Partial<APIConfig> = {}): Promise<void> {
  const app = createApp(config);
  const port = config.port || Number(process.env.PORT) || 3000;

  // Clean up rate limits periodically
  const cleanupInterval = setInterval(cleanupRateLimits, 60000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    clearInterval(cleanupInterval);
    console.log('API server shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(cleanupInterval);
    console.log('API server shutting down...');
    process.exit(0);
  });

  console.log(`API Gateway starting on port ${port}...`);

  // biome-ignore lint/correctness/noUndeclaredVariables: Bun global is available at runtime
  const server = Bun.serve({
    port,
    fetch: app.fetch,
  });

  console.log(`API Gateway running at http://localhost:${server.port}`);
}

// Start server if run directly
if (import.meta.main) {
  startServer().catch(console.error);
}

export default createApp;
