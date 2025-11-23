import type { Context, MiddlewareHandler } from 'hono';
import type { RateLimitOptions } from '../types.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store for rate limiting
const store = new Map<string, RateLimitEntry>();

/**
 * Default key generator using client IP
 */
function defaultKeyGenerator(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0] || 'unknown'
  );
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const { limit, window, keyGenerator = defaultKeyGenerator } = options;

  return async (c, next) => {
    const key = keyGenerator(c);
    const now = Date.now();

    let entry = store.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + window,
      };
    }

    entry.count++;
    store.set(key, entry);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', Math.max(0, limit - entry.count).toString());
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());

    if (entry.count > limit) {
      return c.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)} seconds.`,
        },
        429
      );
    }

    await next();
  };
}

/**
 * Clear the rate limit store (for testing)
 */
export function clearRateLimitStore(): void {
  store.clear();
}
