/**
 * Hono Middleware Wrappers
 *
 * Ready-to-use Hono middleware for API security features.
 */

import type {
  MiddlewareHandler,
  Context as HonoContext,
} from 'hono';
import type {
  SignatureVerificationOptions,
  PerKeyRateLimitConfig,
} from './types.js';
import {
  verifySignatureWithTimestamp,
  extractTimestamp,
  createSignatureOptions,
} from './signature.js';
import { checkRateLimit } from './rate-limit.js';
import { validateAndUpdateAPIKey } from './storage.js';
import { executeThrottled } from './throttle.js';

/**
 * Environment bindings for security middleware
 */
export interface SecurityEnv {
  /** D1 database for rate limiting and API keys */
  SECURITY_DB?: D1Database;
  /** API key header name (default: x-api-key) */
  API_KEY_HEADER?: string;
}

/**
 * Enhanced webhook signature verification middleware
 *
 * Verifies HMAC-SHA256 signatures with timestamp validation
 * to prevent replay attacks.
 *
 * @param getSecret - Function to get secret from context
 * @param options - Signature verification options
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * import { createSignatureMiddleware } from '@duyetbot/api-security';
 *
 * app.post('/webhook', createSignatureMiddleware(
 *   (c) => c.env.GITHUB_WEBHOOK_SECRET,
 *   { maxAge: 5 * 60 * 1000 }
 * ));
 * ```
 */
export function createSignatureMiddleware<E extends SecurityEnv>(
  getSecret: (c: HonoContext<E>) => string | undefined,
  options: SignatureVerificationOptions = {}
): MiddlewareHandler<E> {
  const opts = createSignatureOptions(options);

  return async (c, next) => {
    const rawBody = await c.req.text();
    const signature = c.req.header('x-hub-signature-256') || c.req.header('x-webhook-signature') || '';
    const timestamp = extractTimestamp(c.req.raw.headers);

    // Re-set raw body for downstream middlewares
    c.set('rawBody', rawBody);

    const secret = getSecret(c);

    // Verify signature if secret is configured
    if (secret) {
      const isValid = await verifySignatureWithTimestamp(rawBody, signature, secret, timestamp, opts);

      if (!isValid) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    return next();
  };
}

/**
 * API key authentication middleware
 *
 * Validates API keys from header and updates usage statistics.
 * Sets `apiKey` and `apiKeyRecord` in context for downstream handlers.
 *
 * @param options - Authentication options
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * import { createAPIKeyAuthMiddleware } from '@duyetbot/api-security';
 *
 * app.use('/api/*', createAPIKeyAuthMiddleware({
 *   headerName: 'x-api-key',
 *   required: true,
 * }));
 *
 * app.get('/api/data', (c) => {
 *   const record = c.get('apiKeyRecord');
 *   return c.json({ data: '...', keyName: record?.name });
 * });
 * ```
 */
export function createAPIKeyAuthMiddleware<E extends SecurityEnv>(
  options: {
    headerName?: string;
    required?: boolean;
    skipPaths?: string[];
  } = {}
): MiddlewareHandler<E> {
  const headerName = options.headerName || 'x-api-key';

  return async (c, next) => {
    // Check if path should be skipped
    if (options.skipPaths?.includes(c.req.path)) {
      return next();
    }

    const apiKey = c.req.header(headerName);

    if (!apiKey) {
      if (options.required) {
        return c.json({ error: 'API key required' }, 401);
      }
      return next();
    }

    // Validate API key
    if (!c.env.SECURITY_DB) {
      return c.json({ error: 'Security database not configured' }, 500);
    }

    const result = await validateAndUpdateAPIKey(c.env.SECURITY_DB, apiKey);

    if (!result.valid) {
      const status = result.error === 'KEY_NOT_FOUND' ? 401 : 403;
      return c.json({ error: result.error }, status);
    }

    // Set API key info in context
    c.set('apiKey', apiKey);
    c.set('apiKeyRecord', result.record);

    return next();
  };
}

/**
 * Per-API-key rate limiting middleware
 *
 * Enforces rate limits based on API key ID using D1 storage.
 *
 * @param getConfig - Function to get rate limit config
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * import { createRateLimitMiddleware } from '@duyetbot/api-security';
 *
 * app.use('/api/*', createRateLimitMiddleware((c) => ({
 *   requestsPerMinute: 60,
 *   maxBurst: 10,
 * })));
 * ```
 */
export function createRateLimitMiddleware<E extends SecurityEnv>(
  getConfig: (c: HonoContext<E>) => Partial<PerKeyRateLimitConfig> | Promise<Partial<PerKeyRateLimitConfig>>
): MiddlewareHandler<E> {
  return async (c, next) => {
    if (!c.env.SECURITY_DB) {
      // No database - skip rate limiting
      return next();
    }

    // Get API key record from auth middleware
    const record = c.get('apiKeyRecord');
    if (!record) {
      // No API key - skip rate limiting or use IP-based
      return next();
    }

    const config = await getConfig(c);
    const result = await checkRateLimit(c.env.SECURITY_DB, record.keyId, config);

    if (!result.allowed) {
      c.header('X-RateLimit-Limit', '60');
      c.header('X-RateLimit-Remaining', '0');
      c.header('X-RateLimit-Reset', new Date(Date.now() + result.retryAfter).toISOString());
      c.header('Retry-After', Math.ceil(result.retryAfter / 1000).toString());

      return c.json(
        {
          error: 'Rate limit exceeded',
          reason: result.reason,
          retryAfter: result.retryAfter,
        },
        429
      );
    }

    c.header('X-RateLimit-Remaining', result.remaining.toString());

    return next();
  };
}

/**
 * Request throttling middleware for expensive operations
 *
 * Limits concurrent operations and adds delays between operations.
 *
 * @param operationType - Type of operation for throttling
 * @param config - Throttle configuration
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * import { createThrottleMiddleware } from '@duyetbot/api-security';
 *
 * app.post('/api/ai/generate',
 *   createThrottleMiddleware('llm_call', {
 *     maxConcurrent: 3,
 *     perOperationDelay: 1000,
 *   }),
 *   async (c) => {
 *     // This will be throttled
 *     const result = await generateAIResponse();
 *     return c.json(result);
 *   }
 * );
 * ```
 */
export function createThrottleMiddleware<E extends SecurityEnv>(
  operationType: string,
  config?: Parameters<typeof executeThrottled>[2]
): MiddlewareHandler<E> {
  return async (c, next) => {
    // Wrap next() in throttled execution
    await executeThrottled(operationType, async () => next(), config);
  };
}

/**
 * Combined API security middleware
 *
 * Convenience middleware that combines API key auth, rate limiting,
 * and optional throttling.
 *
 * @param options - Security options
 * @returns Hono middleware
 *
 * @example
 * ```typescript
 * import { createSecurityMiddleware } from '@duyetbot/api-security';
 *
 * app.use('/api/*', createSecurityMiddleware({
 *   rateLimitConfig: { requestsPerMinute: 60 },
 *   throttle: { maxConcurrent: 3 },
 * }));
 * ```
 */
export function createSecurityMiddleware<E extends SecurityEnv>(
  options: {
    apiKeyRequired?: boolean;
    apiKeyHeaderName?: string;
    rateLimitConfig?: Partial<PerKeyRateLimitConfig>;
    throttleConfig?: Parameters<typeof executeThrottled>[2];
  } = {}
): MiddlewareHandler<E>[] {
  const middlewares: MiddlewareHandler<E>[] = [];

  // API key auth
  middlewares.push(createAPIKeyAuthMiddleware<E>({
    headerName: options.apiKeyHeaderName,
    required: options.apiKeyRequired ?? true,
  }));

  // Rate limiting
  if (options.rateLimitConfig) {
    middlewares.push(createRateLimitMiddleware<E>(() => options.rateLimitConfig ?? {}));
  }

  return middlewares;
}
