import type { MiddlewareHandler } from 'hono';
import type { AuthOptions } from '../types.js';

/**
 * Verify GitHub webhook signature
 */
async function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const computedSignature = `sha256=${signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('')}`;

  return signature === computedSignature;
}

/**
 * Create authentication middleware
 */
export function createAuth(options: AuthOptions): MiddlewareHandler {
  const { type, validate, secret, headerName = 'x-api-key' } = options;

  return async (c, next) => {
    if (type === 'bearer') {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized', message: 'Missing bearer token' }, 401);
      }

      const token = authHeader.slice(7);
      if (validate) {
        const user = await validate(token, c);
        if (!user) {
          return c.json({ error: 'Unauthorized', message: 'Invalid token' }, 401);
        }
        c.set('user', user);
      }
    } else if (type === 'api-key') {
      const apiKey = c.req.header(headerName);
      if (!apiKey) {
        return c.json({ error: 'Unauthorized', message: 'Missing API key' }, 401);
      }

      if (validate) {
        const user = await validate(apiKey, c);
        if (!user) {
          return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
        }
        c.set('user', user);
      }
    } else if (type === 'github-webhook') {
      const signature = c.req.header('x-hub-signature-256');
      if (!signature) {
        return c.json({ error: 'Unauthorized', message: 'Missing webhook signature' }, 401);
      }

      const webhookSecret = typeof secret === 'function' ? secret(c) : secret;
      if (!webhookSecret) {
        return c.json({ error: 'Server Error', message: 'Webhook secret not configured' }, 500);
      }

      const payload = await c.req.text();
      const isValid = await verifyGitHubSignature(payload, signature, webhookSecret);

      if (!isValid) {
        return c.json({ error: 'Unauthorized', message: 'Invalid webhook signature' }, 401);
      }

      // Store the parsed body for later use
      c.set('webhookPayload', JSON.parse(payload));
    }

    await next();
  };
}
