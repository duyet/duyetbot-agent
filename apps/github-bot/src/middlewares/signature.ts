/**
 * Signature verification middleware for GitHub webhook
 *
 * Verifies the HMAC-SHA256 signature of incoming webhook requests
 * to ensure they originated from GitHub and haven't been tampered with.
 *
 * This middleware is responsible only for signature verification -
 * parsing and processing are handled by subsequent middlewares.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { Env, SignatureVariables } from './types.js';

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 *
 * Compares the provided signature against a computed HMAC digest
 * using timing-safe comparison to prevent timing attacks.
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from x-hub-signature-256 header
 * @param secret - Webhook secret configured in GitHub
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = verifySignature(
 *   '{"action":"created",...}',
 *   'sha256=abc123...',
 *   'my-webhook-secret'
 * );
 * ```
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    // Buffer lengths may differ if signature is malformed
    return false;
  }
}

/**
 * Create signature verification middleware for GitHub webhook
 *
 * The signature middleware:
 * 1. Reads the raw request body
 * 2. Gets the signature from x-hub-signature-256 header
 * 3. Verifies signature using HMAC-SHA256
 * 4. Returns 401 if signature is invalid
 * 5. Sets rawBody in context for downstream middlewares
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createGitHubSignatureMiddleware } from './middlewares/signature.js';
 *
 * app.post('/webhook', createGitHubSignatureMiddleware(), async (c) => {
 *   if (c.get('skipProcessing')) {
 *     return c.json({ error: 'Invalid signature' }, 401);
 *   }
 *   const rawBody = c.get('rawBody');
 *   // Continue processing...
 * });
 * ```
 */
export function createGitHubSignatureMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: SignatureVariables;
}> {
  return async (c, next) => {
    // Read raw body for signature verification
    const rawBody = await c.req.text();

    // Get signature from header
    const signature = c.req.header('x-hub-signature-256');
    const deliveryId = c.req.header('x-github-delivery') || 'unknown';

    // Generate request ID for trace correlation
    const requestId = crypto.randomUUID().slice(0, 8);

    logger.debug(`[${requestId}] [SIGNATURE] Verifying webhook signature`, {
      requestId,
      deliveryId,
      hasSignature: !!signature,
      hasSecret: !!c.env.GITHUB_WEBHOOK_SECRET,
      bodyLength: rawBody.length,
    });

    // Verify signature if both signature and secret are present
    if (signature && c.env.GITHUB_WEBHOOK_SECRET) {
      if (!verifySignature(rawBody, signature, c.env.GITHUB_WEBHOOK_SECRET)) {
        logger.warn(`[${requestId}] [SIGNATURE] Invalid webhook signature`, {
          requestId,
          deliveryId,
        });
        return c.json({ error: 'Invalid signature' }, 401);
      }

      logger.debug(`[${requestId}] [SIGNATURE] Signature verified`, {
        requestId,
        deliveryId,
      });
    } else if (!signature && c.env.GITHUB_WEBHOOK_SECRET) {
      // Secret is configured but no signature provided - reject
      logger.warn(`[${requestId}] [SIGNATURE] Missing signature header`, {
        requestId,
        deliveryId,
      });
      return c.json({ error: 'Missing signature' }, 401);
    } else if (signature && !c.env.GITHUB_WEBHOOK_SECRET) {
      // Signature provided but no secret configured - log warning but continue
      logger.warn(`[${requestId}] [SIGNATURE] Signature provided but no secret configured`, {
        requestId,
        deliveryId,
      });
    }

    // Set variables for downstream middlewares
    c.set('rawBody', rawBody);
    c.set('skipProcessing', false);

    return next();
  };
}
