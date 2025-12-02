import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { errorHandler } from './middleware/error-handler.js';
import { createLogger } from './middleware/logger.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { healthRoutes } from './routes/health.js';
import type { AppOptions } from './types.js';

/**
 * Create a Hono app with standard middleware and routes
 *
 * @example
 * ```typescript
 * const app = createBaseApp<Env>({
 *   name: 'telegram-bot',
 *   version: '1.0.0',
 *   logger: true,
 *   rateLimit: { limit: 100, window: 60000 },
 *   health: true,
 * });
 *
 * app.post('/webhook', async (c) => {
 *   // Handle webhook
 * });
 *
 * export default app;
 * ```
 */
export function createBaseApp<TEnv extends object = object>(
  options: AppOptions
): Hono<{ Bindings: TEnv }> {
  const app = new Hono<{ Bindings: TEnv }>();

  // Early-exit for ignored paths (e.g., Cloudflare internal requests)
  if (options.ignorePaths?.length) {
    app.use('*', async (c, next) => {
      const path = c.req.path;
      for (const prefix of options.ignorePaths!) {
        if (path.startsWith(prefix)) {
          return c.text('Not Found', 404);
        }
      }
      await next();
    });
  }

  // Security headers - protect against clickjacking, XSS, MIME sniffing
  app.use(
    '*',
    secureHeaders({
      xFrameOptions: 'DENY',
      xContentTypeOptions: 'nosniff',
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xXssProtection: '1; mode=block',
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  );

  // Body size limit - prevent JSON bomb attacks and memory exhaustion
  app.use(
    '*',
    bodyLimit({
      maxSize: 1024 * 1024, // 1MB
      onError: (c) =>
        c.json(
          {
            error: 'Payload too large',
            message: 'Request body exceeds 1MB limit',
          },
          413
        ),
    })
  );

  // Error handler
  app.onError(errorHandler);

  // Logger middleware
  if (options.logger !== false) {
    app.use('*', createLogger());
  }

  // Rate limiting middleware
  if (options.rateLimit) {
    app.use('*', createRateLimiter(options.rateLimit));
  }

  // Health check routes
  if (options.health !== false) {
    app.route('/', healthRoutes(options.name, options.version));
  }

  return app;
}
