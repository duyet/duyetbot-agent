/**
 * Signature verification middleware for GitHub webhook
 *
 * Verifies the HMAC-SHA256 signature of incoming webhook requests
 * to ensure they originated from GitHub and haven't been tampered with.
 *
 * This middleware is responsible only for signature verification -
 * parsing and processing are handled by subsequent middlewares.
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 *
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { Env, SignatureVariables } from './types.js';

/**
 * Verify GitHub webhook signature using HMAC-SHA256
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
  try {
    // Import crypto from global scope (Cloudflare Workers provides this)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Compute HMAC
    const signature_bytes = await crypto.subtle.sign('HMAC', key, payloadData);

    // Convert to hex string
    const digest = `sha256=${Array.from(new Uint8Array(signature_bytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    // Use timing-safe comparison to prevent timing attacks
    // For constant-time comparison, compare byte lengths first
    if (digest.length !== signature.length) {
      return false;
    }

    // Convert both to ArrayBuffers for timing-safe comparison
    const digestBytes = new TextEncoder().encode(digest);
    const signatureBytes = new TextEncoder().encode(signature);

    // Timing-safe comparison
    let result = 0;
    for (let i = 0; i < digestBytes.length; i++) {
      result |= digestBytes[i] ^ signatureBytes[i];
    }

    return result === 0;
  } catch (error) {
    logger.error('[SIGNATURE] Verification error', {
      error: error instanceof Error ? error.message : String(error),
    });
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
      const isValid = await verifySignature(rawBody, signature, c.env.GITHUB_WEBHOOK_SECRET);
      if (!isValid) {
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
