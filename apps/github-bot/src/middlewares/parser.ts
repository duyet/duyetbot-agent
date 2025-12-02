/**
 * Parser middleware for GitHub webhook
 *
 * Parses incoming webhook requests, extracts GitHub event data,
 * and builds context for downstream handlers.
 *
 * This middleware is responsible only for parsing - signature verification
 * is handled by a separate middleware.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { Env, GitHubWebhookPayload, ParserVariables, WebhookContext } from './types.js';

/**
 * Parse raw body and extract GitHub webhook payload
 *
 * @param rawBody - Raw request body string
 * @returns Parsed payload or null if invalid JSON
 * @internal Exported for testing
 */
export function parseWebhookPayload(rawBody: string): GitHubWebhookPayload | null {
  try {
    return JSON.parse(rawBody) as GitHubWebhookPayload;
  } catch (error) {
    logger.error('[PARSE] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Build webhook context from parsed payload and event metadata
 *
 * @param payload - Parsed GitHub webhook payload
 * @param eventType - GitHub event type from x-github-event header
 * @param deliveryId - Delivery ID from x-github-delivery header
 * @param requestId - Generated request ID for tracing
 * @returns WebhookContext with extracted data
 * @internal Exported for testing
 */
export function buildWebhookContext(
  payload: GitHubWebhookPayload,
  eventType: string,
  deliveryId: string,
  requestId: string
): WebhookContext {
  const pr = payload.pull_request;
  const isPullRequest = !!pr || payload.issue?.pull_request !== undefined;

  const ctx: WebhookContext = {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    event: eventType,
    action: payload.action,
    deliveryId,
    requestId,
    sender: payload.sender,
    issue: payload.issue
      ? {
          number: payload.issue.number,
          title: payload.issue.title,
          body: payload.issue.body ?? '',
          state: payload.issue.state,
        }
      : undefined,
    comment: payload.comment
      ? {
          id: payload.comment.id,
          body: payload.comment.body,
        }
      : undefined,
    isPullRequest,
  };

  // Extract PR-specific metadata when available
  if (pr) {
    if (pr.additions !== undefined) {
      ctx.additions = pr.additions;
    }
    if (pr.deletions !== undefined) {
      ctx.deletions = pr.deletions;
    }
    if (pr.commits !== undefined) {
      ctx.commits = pr.commits;
    }
    if (pr.changed_files !== undefined) {
      ctx.changedFiles = pr.changed_files;
    }
    if (pr.head?.ref !== undefined) {
      ctx.headRef = pr.head.ref;
    }
    if (pr.base?.ref !== undefined) {
      ctx.baseRef = pr.base.ref;
    }
  }

  return ctx;
}

/**
 * Check if the event type should be processed
 *
 * @param eventType - GitHub event type
 * @param action - Event action (created, opened, etc.)
 * @returns Whether the event should be processed
 */
function isProcessableEvent(eventType: string, action?: string): boolean {
  switch (eventType) {
    case 'issue_comment':
      return action === 'created';
    case 'pull_request_review_comment':
      return action === 'created';
    case 'issues':
      return action === 'opened' || action === 'edited';
    default:
      return false;
  }
}

/**
 * Create parser middleware for GitHub webhook
 *
 * The parser middleware:
 * 1. Reads the raw body from context (set by signature middleware)
 * 2. Parses the JSON payload
 * 3. Extracts event type and delivery ID from headers
 * 4. Builds WebhookContext based on event type
 * 5. Sets `skipProcessing: true` for ping and unhandled events
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createGitHubParserMiddleware } from './middlewares/parser.js';
 *
 * app.post('/webhook',
 *   createGitHubSignatureMiddleware(),
 *   createGitHubParserMiddleware(),
 *   async (c) => {
 *     if (c.get('skipProcessing')) {
 *       return c.json({ ok: true, skipped: true });
 *     }
 *     const ctx = c.get('webhookContext');
 *     // Process webhook...
 *   }
 * );
 * ```
 */
export function createGitHubParserMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: ParserVariables;
}> {
  return async (c, next) => {
    // Read raw body from context (set by signature middleware)
    const rawBody = c.get('rawBody');

    if (!rawBody) {
      logger.error('[PARSE] No raw body found in context');
      c.set('webhookContext', undefined);
      c.set('payload', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Parse JSON payload
    const payload = parseWebhookPayload(rawBody);

    if (!payload) {
      c.set('webhookContext', undefined);
      c.set('payload', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Extract headers
    const eventType = c.req.header('x-github-event') || 'unknown';
    const deliveryId = c.req.header('x-github-delivery') || '';
    const requestId = crypto.randomUUID().slice(0, 8);

    // Handle ping event
    if (eventType === 'ping') {
      logger.info(`[${requestId}] [PARSE] Ping event received`, {
        requestId,
        deliveryId,
        repository: payload.repository?.full_name,
        hookId: payload.hook_id,
      });

      c.set('webhookContext', undefined);
      c.set('payload', payload);
      c.set('skipProcessing', true);
      return next();
    }

    // Build webhook context
    const webhookCtx = buildWebhookContext(payload, eventType, deliveryId, requestId);

    // Check if event should be processed
    if (!isProcessableEvent(eventType, payload.action)) {
      logger.debug(`[${requestId}] [PARSE] Unhandled event type`, {
        requestId,
        event: eventType,
        action: payload.action,
        repository: `${webhookCtx.owner}/${webhookCtx.repo}`,
      });

      c.set('webhookContext', webhookCtx);
      c.set('payload', payload);
      c.set('skipProcessing', true);
      return next();
    }

    // Log parsed event
    logger.info(`[${requestId}] [PARSE] Event parsed`, {
      requestId,
      deliveryId,
      event: eventType,
      action: payload.action,
      repository: `${webhookCtx.owner}/${webhookCtx.repo}`,
      sender: webhookCtx.sender.login,
      issueNumber: webhookCtx.issue?.number,
      isPullRequest: webhookCtx.isPullRequest,
      commentId: webhookCtx.comment?.id,
    });

    // Set context for downstream handlers
    c.set('webhookContext', webhookCtx);
    c.set('payload', payload);
    c.set('skipProcessing', false);

    return next();
  };
}
