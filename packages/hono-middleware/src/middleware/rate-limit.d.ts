import type { MiddlewareHandler } from 'hono';
import type { RateLimitOptions } from '../types.js';
/**
 * Create rate limiter middleware
 */
export declare function createRateLimiter(options: RateLimitOptions): MiddlewareHandler;
/**
 * Clear the rate limit store (for testing)
 */
export declare function clearRateLimitStore(): void;
//# sourceMappingURL=rate-limit.d.ts.map
