/**
 * Enhanced signature verification middleware for GitHub webhook
 *
 * Verifies the HMAC-SHA256 signature of incoming webhook requests
 * to ensure they originated from GitHub and haven't been tampered with.
 *
 * ENHANCED: Now includes timestamp validation to prevent replay attacks.
 *
 * This middleware is responsible only for signature verification -
 * parsing and processing are handled by subsequent middlewares.
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

import { verifySignatureWithTimestamp, extractTimestamp, createSignatureOptions } from '@duyetbot/api-security';
import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { Env, SignatureVariables } from './types.js';

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 *
 * DEPRECATED: Use verifySignatureWithTimestamp from @duyetbot/api-security instead.
 * This function is kept for backward compatibility but internally uses the enhanced version.
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 * Computes HMAC-SHA256 and compares using timing-safe comparison.
 *
 * @param payload - Raw request body as string
 * @param signature - Signature from x-hub-signature-256 header
 * @param secret - Webhook secret configured in GitHub
 * @returns true if signature is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = await verifySignature(
 *   '{"action":"created",...}',
 *   'sha256=abc123...',
 *   'my-webhook-secret'
 * );
 * ```
 */
export async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  // Use enhanced verification without timestamp requirement for backward compatibility
  return verifySignatureWithTimestamp(payload, signature, secret, undefined, {
    requireTimestamp: false,
  });
}

/**
 * Create signature verification middleware for GitHub webhook
 *
 * ENHANCED: Now validates timestamps from delivery ID to prevent replay attacks.
 *
 * The signature middleware:
 * 1. Reads the raw request body
 * 2. Gets the signature from x-hub-signature-256 header
 * 3. Extracts timestamp from x-github-delivery header
 * 4. Verifies signature using HMAC-SHA256 with timestamp validation
 * 5. Returns 401 if signature is invalid or timestamp is too old
 * 6. Sets rawBody in context for downstream middlewares
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
      // Extract timestamp from delivery ID (format: unix-timestamp-uuid)
      const timestamp = extractTimestamp(c.req.raw.headers);

      // Use enhanced verification with timestamp validation
      const options = createSignatureOptions({
        maxAge: 5 * 60 * 1000, // 5 minutes
        requireTimestamp: false, // Don't require timestamp for backward compatibility
      });

      const isValid = await verifySignatureWithTimestamp(
        rawBody,
        signature,
        c.env.GITHUB_WEBHOOK_SECRET,
        timestamp,
        options
      );

      if (!isValid) {
        logger.warn(`[${requestId}] [SIGNATURE] Invalid webhook signature or expired timestamp`, {
          requestId,
          deliveryId,
          hasTimestamp: !!timestamp,
        });
        return c.json({ error: 'Invalid signature' }, 401);
      }

      logger.debug(`[${requestId}] [SIGNATURE] Signature verified`, {
        requestId,
        deliveryId,
        timestampAge: timestamp ? Date.now() - timestamp : undefined,
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
