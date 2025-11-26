/**
 * Parser middleware for Telegram webhook
 *
 * Parses incoming webhook requests, validates message structure,
 * and extracts context for downstream handlers.
 *
 * This middleware is responsible only for parsing - authorization
 * is handled by a separate middleware.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { Env, ParserVariables, TelegramUpdate, WebhookContext } from './types.js';

/**
 * Parse webhook request and extract message data
 *
 * @param request - The incoming request object
 * @returns Parsed update and message, or null if invalid
 * @internal Exported for testing
 */
export async function parseWebhookBody(request: Request): Promise<{
  update: TelegramUpdate;
  message: NonNullable<TelegramUpdate['message']>;
} | null> {
  let update: TelegramUpdate;

  try {
    update = await request.json<TelegramUpdate>();
    logger.debug('[PARSE] Webhook payload received', {
      update,
      hasMessage: !!update.message,
    });
  } catch (error) {
    logger.error('[PARSE] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    logger.debug('[PARSE] Skipping message without text or from', {
      hasText: !!message?.text,
      hasFrom: !!message?.from,
    });
    return null;
  }

  return { update, message };
}

/**
 * Extract webhook context from parsed message
 *
 * @param message - The parsed Telegram message
 * @returns WebhookContext with extracted data
 * @internal Exported for testing
 */
export function extractWebhookContext(
  message: NonNullable<TelegramUpdate['message']>
): WebhookContext {
  return {
    text: message.text!,
    userId: message.from!.id,
    chatId: message.chat.id,
    startTime: Date.now(),
    username: message.from!.username,
  };
}

/**
 * Create parser middleware for Telegram webhook
 *
 * The parser middleware:
 * 1. Parses the JSON body from the webhook request
 * 2. Validates that the message has required fields (text, from)
 * 3. Extracts webhook context for downstream handlers
 * 4. Sets `skipProcessing: true` for invalid requests
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createTelegramParserMiddleware } from './middlewares/parser.js';
 *
 * app.post('/webhook', createTelegramParserMiddleware(), async (c) => {
 *   if (c.get('skipProcessing')) {
 *     return c.json({ ok: true });
 *   }
 *   const ctx = c.get('webhookContext');
 *   // Process message...
 * });
 * ```
 */
export function createTelegramParserMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: ParserVariables;
}> {
  return async (c, next) => {
    // Parse request body
    const parsed = await parseWebhookBody(c.req.raw);

    if (!parsed) {
      c.set('webhookContext', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Extract context from parsed message
    const { message } = parsed;
    const webhookCtx = extractWebhookContext(message);

    logger.info('[WEBHOOK] Message received', {
      userId: webhookCtx.userId,
      chatId: webhookCtx.chatId,
      username: webhookCtx.username,
      textLength: webhookCtx.text.length,
    });

    // Set context for downstream handlers
    c.set('webhookContext', webhookCtx);
    c.set('skipProcessing', false);

    return next();
  };
}
