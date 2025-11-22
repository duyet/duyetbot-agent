/**
 * GitHub Webhook Routes
 */

import crypto from 'node:crypto';
import { Hono } from 'hono';

const github = new Hono();

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256') {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
}

/**
 * GitHub webhook handler
 */
github.post('/webhook', async (c) => {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const body = await c.req.text();

  // Verify signature if secret is configured
  if (webhookSecret) {
    const signature = c.req.header('x-hub-signature-256');
    if (!verifyWebhookSignature(body, signature, webhookSecret)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  const event = c.req.header('x-github-event');
  const delivery = c.req.header('x-github-delivery');

  try {
    const payload = JSON.parse(body);

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'github_webhook',
        event,
        delivery,
        action: payload.action,
        repository: payload.repository?.full_name,
      })
    );

    // Handle different event types
    switch (event) {
      case 'ping':
        return c.json({ message: 'pong', zen: payload.zen });

      case 'issues':
        if (payload.action === 'opened' || payload.action === 'edited') {
          // TODO: Process issue with @duyetbot mention
          return c.json({ processed: true, event, action: payload.action });
        }
        break;

      case 'issue_comment':
        if (payload.action === 'created') {
          // Check for @duyetbot mention
          const body = payload.comment?.body || '';
          if (body.includes('@duyetbot')) {
            // TODO: Forward to agent handler
            return c.json({ processed: true, event, mentioned: true });
          }
        }
        break;

      case 'pull_request':
        if (payload.action === 'opened' || payload.action === 'synchronize') {
          // TODO: Auto-review PR
          return c.json({ processed: true, event, action: payload.action });
        }
        break;

      case 'pull_request_review_comment':
        if (payload.action === 'created') {
          const body = payload.comment?.body || '';
          if (body.includes('@duyetbot')) {
            // TODO: Forward to agent handler
            return c.json({ processed: true, event, mentioned: true });
          }
        }
        break;

      default:
        return c.json({ processed: false, event, reason: 'unhandled event type' });
    }

    return c.json({ processed: false, event });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to process webhook', details: errorMessage }, 500);
  }
});

/**
 * GitHub installation webhook
 */
github.post('/install', async (c) => {
  const body = await c.req.json();

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'github_install',
      action: body.action,
      installation: body.installation?.id,
      account: body.installation?.account?.login,
    })
  );

  return c.json({ received: true });
});

export { github };
