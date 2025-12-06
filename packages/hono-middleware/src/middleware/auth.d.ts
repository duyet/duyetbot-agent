import type { MiddlewareHandler } from 'hono';
import type { AuthOptions } from '../types.js';
/**
 * Create authentication middleware
 *
 * Supports:
 * - bearer: Bearer token authentication
 * - api-key: API key authentication (custom header)
 *
 * Note: GitHub webhook signature verification is handled by
 * app-specific middleware. See github-bot/src/middlewares/signature.ts
 */
export declare function createAuth(options: AuthOptions): MiddlewareHandler;
//# sourceMappingURL=auth.d.ts.map
