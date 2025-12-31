/**
 * Mention detection middleware for GitHub webhook
 *
 * Detects @bot mentions in comments and issues, extracts the task text,
 * and sets context variables for downstream handlers.
 *
 * This middleware is part of the GitHub webhook processing chain:
 * signature -> parser -> mention -> handler
 */

import { logger } from '@duyetbot/hono-middleware';
import { extractTask, hasMention } from '@duyetbot/types/mention-parser';
import type { MiddlewareHandler } from 'hono';
import type { Env, MentionVariables, WebhookContext } from './types.js';

// Re-export for backward compatibility
export {
  extractTask,
  hasMention as hasBotMention,
} from '@duyetbot/types/mention-parser';

/**
 * Get the text content from webhook context
 *
 * Extracts the relevant text from different event types:
 * - For comments: comment.body
 * - For issues: issue.body
 *
 * @param ctx - Webhook context
 * @returns Text content or undefined if not available
 */
function getTextFromContext(ctx: WebhookContext): string | undefined {
  // Priority: comment body > issue body
  if (ctx.comment?.body) {
    return ctx.comment.body;
  }
  if (ctx.issue?.body) {
    return ctx.issue.body;
  }
  return undefined;
}

/**
 * Create mention detection middleware for GitHub webhook
 *
 * This middleware:
 * 1. Checks if processing should be skipped (signature/parser failed)
 * 2. Extracts text from the webhook context (comment, issue, or PR body)
 * 3. Checks for bot mention in the text
 * 4. Extracts task text after the mention
 * 5. Sets skipProcessing if no mention or empty task
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createGitHubMentionMiddleware } from './middlewares/mention.js';
 *
 * app.post('/webhook',
 *   createGitHubSignatureMiddleware(),
 *   createGitHubParserMiddleware(),
 *   createGitHubMentionMiddleware(),
 *   async (c) => {
 *     if (c.get('skipProcessing')) {
 *       return c.json({ ok: true });
 *     }
 *     const task = c.get('task')!;
 *     // Process the task...
 *   }
 * );
 * ```
 */
export function createGitHubMentionMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: MentionVariables;
}> {
  return async (c, next) => {
    // Initialize mention variables
    c.set('hasMention', false);
    c.set('task', undefined);

    // Check if processing should be skipped (set by signature or parser)
    const skipProcessing = c.get('skipProcessing');
    if (skipProcessing) {
      logger.debug('[MENTION] Skipping - skipProcessing already set');
      return next();
    }

    // Get webhook context from parser middleware
    const webhookContext = c.get('webhookContext') as WebhookContext | undefined;
    if (!webhookContext) {
      logger.warn('[MENTION] No webhookContext found - parser middleware may not have run');
      c.set('skipProcessing', true);
      return next();
    }

    // Get bot username from environment
    const botUsername = c.env.BOT_USERNAME || 'duyetbot';

    // Handle review request events - bypass mention check if bot is the requested reviewer
    if (webhookContext.isReviewRequest && webhookContext.requestedReviewer) {
      const requestedReviewer = webhookContext.requestedReviewer.toLowerCase();
      const normalizedBotUsername = botUsername.toLowerCase();
      // Handle both "duyetbot" and "duyetbot[bot]" (GitHub Apps format)
      const isBotRequested =
        requestedReviewer === normalizedBotUsername ||
        requestedReviewer === `${normalizedBotUsername}[bot]`;

      if (isBotRequested) {
        c.set('hasMention', true);
        c.set('task', 'Please review this pull request');

        logger.info('[MENTION] Review requested from bot', {
          requestId: webhookContext.requestId,
          repository: `${webhookContext.owner}/${webhookContext.repo}`,
          event: webhookContext.event,
          action: webhookContext.action,
          requestedReviewer: webhookContext.requestedReviewer,
        });

        return next();
      }

      // Review requested but not for our bot - skip processing
      logger.debug('[MENTION] Review requested for different user', {
        requestId: webhookContext.requestId,
        repository: `${webhookContext.owner}/${webhookContext.repo}`,
        requestedReviewer: webhookContext.requestedReviewer,
        botUsername,
      });
      c.set('skipProcessing', true);
      return next();
    }

    // Extract text from context (comment body, issue body, or PR body)
    const text = getTextFromContext(webhookContext);
    if (!text) {
      logger.debug('[MENTION] No text content found in webhook context', {
        requestId: webhookContext.requestId,
        event: webhookContext.event,
        action: webhookContext.action,
      });
      c.set('skipProcessing', true);
      return next();
    }

    // Check for bot mention
    if (!hasMention(text, botUsername)) {
      logger.debug('[MENTION] No bot mention found', {
        requestId: webhookContext.requestId,
        repository: `${webhookContext.owner}/${webhookContext.repo}`,
        event: webhookContext.event,
      });
      c.set('skipProcessing', true);
      return next();
    }

    // Extract task from mention
    const task = extractTask(text, botUsername);
    if (!task) {
      logger.debug('[MENTION] Empty task after mention', {
        requestId: webhookContext.requestId,
        repository: `${webhookContext.owner}/${webhookContext.repo}`,
      });
      c.set('skipProcessing', true);
      return next();
    }

    // Set mention context for downstream handlers
    c.set('hasMention', true);
    c.set('task', task);

    logger.info('[MENTION] Bot mentioned with task', {
      requestId: webhookContext.requestId,
      repository: `${webhookContext.owner}/${webhookContext.repo}`,
      event: webhookContext.event,
      action: webhookContext.action,
      taskLength: task.length,
      taskPreview: task.substring(0, 100),
    });

    return next();
  };
}
