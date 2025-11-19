/**
 * Rate Limiting Middleware
 *
 * Per-user and per-IP rate limiting using Cloudflare KV
 */

import type { Context, Next } from 'hono';
import type { AppEnv, RateLimitConfig, RateLimitResult } from '../types';
import { getOptionalUser } from './auth';

/**
 * Default rate limit configuration
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowSeconds: 60, // 1 minute
};

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = {
    ...DEFAULT_RATE_LIMIT,
    ...config,
  };

  return async (c: Context<AppEnv>, next: Next) => {
    const env = c.env;
    const user = getOptionalUser(c);

    // Use user ID if authenticated, otherwise use IP
    const identifier = user?.id || c.req.header('CF-Connecting-IP') || 'unknown';

    const result = await checkRateLimit(env.KV, identifier, finalConfig);

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(finalConfig.maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));

      return c.json(
        {
          error: 'Rate Limit Exceeded',
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        429
      );
    }

    await next();
  };
}

/**
 * Check rate limit
 */
async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate-limit:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;

  // Get current counter
  const data = (await kv.get(key, 'json')) as RateLimitData | null;

  if (!data) {
    // First request in this window
    const resetAt = new Date(now + windowMs);
    await kv.put(key, JSON.stringify({ count: 1, resetAt: resetAt.getTime() }), {
      expirationTtl: config.windowSeconds,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  const resetAt = new Date(data.resetAt);

  // Check if window has expired
  if (now >= data.resetAt) {
    // Reset counter for new window
    const newResetAt = new Date(now + windowMs);
    await kv.put(key, JSON.stringify({ count: 1, resetAt: newResetAt.getTime() }), {
      expirationTtl: config.windowSeconds,
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: newResetAt,
    };
  }

  // Check if limit exceeded
  if (data.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Increment counter
  const newCount = data.count + 1;
  await kv.put(key, JSON.stringify({ count: newCount, resetAt: data.resetAt }), {
    expirationTtl: Math.ceil((data.resetAt - now) / 1000),
  });

  return {
    allowed: true,
    remaining: config.maxRequests - newCount,
    resetAt,
  };
}

/**
 * Rate limit data stored in KV
 */
interface RateLimitData {
  count: number;
  resetAt: number;
}
