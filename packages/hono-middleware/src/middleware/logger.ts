import type { MiddlewareHandler } from 'hono';
import type { LoggerOptions } from '../types.js';

/**
 * Generate a unique request ID using cryptographically secure random
 */
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Create logger middleware
 */
export function createLogger(options: LoggerOptions = {}): MiddlewareHandler {
  const { format = 'json' } = options;

  return async (c, next) => {
    const requestId = generateRequestId();
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    // Add request ID to context
    c.set('requestId', requestId);

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    if (format === 'json') {
      console.log(
        JSON.stringify({
          id: requestId,
          method,
          path,
          status,
          duration,
        })
      );
    } else {
      console.log(`[${requestId}] ${method} ${path} ${status} ${duration}ms`);
    }
  };
}
