/**
 * Request Logger Middleware
 */

import type { Context, Next } from 'hono';

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Logger middleware
 */
export function loggerMiddleware() {
  return async (c: Context, next: Next) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Set request context
    c.set('requestId', requestId);
    c.set('startTime', startTime);

    // Add request ID to response headers
    c.header('X-Request-Id', requestId);

    const method = c.req.method;
    const path = c.req.path;

    try {
      await next();

      const duration = Date.now() - startTime;
      const status = c.res.status;

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          path,
          status,
          duration,
          user: c.get('user')?.id,
        })
      );
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          requestId,
          method,
          path,
          status: 500,
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );

      throw error;
    }
  };
}
