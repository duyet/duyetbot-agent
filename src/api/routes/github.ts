/**
 * GitHub Routes
 *
 * Webhook and integration endpoints for GitHub
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  type GitHubEvent,
  handleGitHubWebhook,
  verifyWebhookSignature,
} from '../../github/webhook-handler';
import { getLogger } from '../middleware/logger';
import type { APIResponse, Env } from '../types';

/**
 * Create GitHub routes
 */
export function createGitHubRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * POST /github/webhook
   * GitHub webhook receiver
   */
  app.post('/webhook', async (c) => {
    const logger = getLogger(c);

    // Get webhook signature
    const signature = c.req.header('X-Hub-Signature-256');
    if (!signature) {
      logger.warn('GitHub webhook missing signature');
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Signature',
          message: 'X-Hub-Signature-256 header is required',
          code: 'MISSING_SIGNATURE',
        },
        401
      );
    }

    // Get event type
    const event = c.req.header('X-GitHub-Event') as GitHubEvent;
    if (!event) {
      logger.warn('GitHub webhook missing event type');
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Event',
          message: 'X-GitHub-Event header is required',
          code: 'MISSING_EVENT',
        },
        400
      );
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();

    // Verify signature
    const webhookSecret = c.env.GITHUB_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('GitHub webhook secret not configured');
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Configuration Error',
          message: 'Webhook secret not configured',
          code: 'WEBHOOK_NOT_CONFIGURED',
        },
        500
      );
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      logger.warn('GitHub webhook signature verification failed');
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Invalid Signature',
          message: 'Webhook signature verification failed',
          code: 'INVALID_SIGNATURE',
        },
        401
      );
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error('Failed to parse webhook payload', error as Error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Invalid Payload',
          message: 'Failed to parse JSON payload',
          code: 'INVALID_PAYLOAD',
        },
        400
      );
    }

    // Handle webhook
    return await handleGitHubWebhook(c, event, payload);
  });

  /**
   * GET /github/status
   * GitHub integration status
   */
  app.get('/status', (c) => {
    const configured = !!c.env.GITHUB_WEBHOOK_SECRET;

    return c.json<APIResponse<{ configured: boolean; events: string[] }>>(
      {
        success: true,
        data: {
          configured,
          events: [
            'issues',
            'issue_comment',
            'pull_request',
            'pull_request_review',
            'pull_request_review_comment',
          ],
        },
      },
      200
    );
  });

  return app;
}
