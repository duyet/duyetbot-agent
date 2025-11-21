/**
 * Rate Limiting Middleware
 */

import type { Context, Next } from 'hono';
import type { RateLimitState } from '../types.js';

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitState>();

/**
 * Get client identifier for rate limiting
 */
function getClientId(c: Context): string {
  const user = c.get('user');
  if (user) {
    return user.id;
  }

  // Fall back to IP address
  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(requestsPerMinute = 60) {
  return async (c: Context, next: Next) => {
    const clientId = getClientId(c);
    const now = Date.now();

    let state = rateLimitStore.get(clientId);

    // Reset if window has passed
    if (!state || now >= state.resetTime) {
      state = {
        requests: 0,
        resetTime: now + 60000, // 1 minute window
      };
    }

    state.requests++;
    rateLimitStore.set(clientId, state);

    // Set rate limit headers
    const remaining = Math.max(0, requestsPerMinute - state.requests);
    c.header('X-RateLimit-Limit', String(requestsPerMinute));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(state.resetTime / 1000)));

    if (state.requests > requestsPerMinute) {
      return c.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((state.resetTime - now) / 1000),
        },
        429
      );
    }

    return next();
  };
}

/**
 * Clean up expired rate limit entries
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [key, state] of rateLimitStore.entries()) {
    if (now >= state.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}
