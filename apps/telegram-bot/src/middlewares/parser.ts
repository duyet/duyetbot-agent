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
import { extractTask, hasMention } from '@duyetbot/types/mention-parser';
import type { MiddlewareHandler } from 'hono';

import type {
  CallbackContext,
  Env,
  ParserVariables,
  TelegramUpdate,
  WebhookContext,
} from './types.js';

/** Default bot username for mention detection */
const DEFAULT_BOT_USERNAME = 'duyetbot';

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
 * Parse callback query from update and extract context
 *
 * @param callbackQuery - The callback_query field from Telegram update
 * @returns CallbackContext with extracted data, or null if invalid
 * @internal Exported for testing
 */
export function parseCallbackQuery(
  callbackQuery: NonNullable<TelegramUpdate['callback_query']>
): CallbackContext | null {
  // Validate required fields
  if (!callbackQuery.id || !callbackQuery.from || callbackQuery.data === undefined) {
    logger.debug('[PARSE] Skipping callback query with missing required fields', {
      hasId: !!callbackQuery.id,
      hasFrom: !!callbackQuery.from,
      hasData: callbackQuery.data !== undefined,
    });
    return null;
  }

  // Validate message context
  if (!callbackQuery.message?.message_id || !callbackQuery.message?.chat?.id) {
    logger.debug('[PARSE] Skipping callback query with missing message context', {
      hasMessageId: !!callbackQuery.message?.message_id,
      hasChatId: !!callbackQuery.message?.chat?.id,
    });
    return null;
  }

  // Extract and validate data - must be non-empty string
  const data = callbackQuery.data.trim();
  if (!data) {
    logger.debug('[PARSE] Skipping callback query with empty data payload');
    return null;
  }

  return {
    callbackQueryId: callbackQuery.id,
    chatId: callbackQuery.message.chat.id,
    messageId: callbackQuery.message.message_id,
    userId: callbackQuery.from.id,
    username: callbackQuery.from.username,
    data,
    startTime: Date.now(),
  };
}

/**
 * Extract webhook context from parsed message
 *
 * @param message - The parsed Telegram message
 * @param botUsername - Bot username for mention detection (without @)
 * @returns WebhookContext with extracted data
 * @internal Exported for testing
 */
export function extractWebhookContext(
  message: NonNullable<TelegramUpdate['message']>,
  botUsername: string = DEFAULT_BOT_USERNAME
): WebhookContext {
  const replyTo = message.reply_to_message;
  const text = message.text!;

  // Extract chat type (default to 'private' for backward compatibility)
  const chatType = message.chat.type ?? 'private';
  const isGroupChat = chatType === 'group' || chatType === 'supergroup';

  // Detect bot mention in message text
  const hasBotMention = hasMention(text, botUsername);

  // Check if this message is a reply to any message
  const isReply = !!replyTo;

  // Check if this is a reply to the bot's previous message
  const replyToUsername = replyTo?.from?.username?.toLowerCase();
  const isReplyToBot = replyToUsername === botUsername.toLowerCase();

  // Extract task text (message without @mention) if mention is present
  const task = hasBotMention ? extractTask(text, botUsername) : undefined;

  return {
    text,
    userId: message.from!.id,
    chatId: message.chat.id,
    startTime: Date.now(),
    username: message.from!.username,
    messageId: message.message_id,
    replyToMessageId: replyTo?.message_id,
    quotedText: replyTo?.text,
    quotedUsername: replyTo?.from?.username,
    chatType,
    chatTitle: message.chat.title,
    isGroupChat,
    hasBotMention,
    isReply,
    isReplyToBot,
    task,
  };
}

/**
 * Create parser middleware for Telegram webhook
 *
 * The parser middleware:
 * 1. Parses the JSON body from the webhook request
 * 2. Detects update type (message or callback_query)
 * 3. For messages:
 *    - Validates that the message has required fields (text, from)
 *    - Extracts webhook context for downstream handlers
 *    - For group chats: skips processing unless bot is mentioned or replied to
 * 4. For callbacks:
 *    - Validates callback structure
 *    - Extracts callback context for downstream handlers
 * 5. Sets `skipProcessing: true` for invalid requests or non-targeted group messages
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
 *   const webhookCtx = c.get('webhookContext');
 *   const callbackCtx = c.get('callbackContext');
 *   // Process message or callback...
 * });
 * ```
 */
export function createTelegramParserMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: ParserVariables;
}> {
  return async (c, next) => {
    // Parse request body
    let update: TelegramUpdate;

    try {
      update = await c.req.json<TelegramUpdate>();
      logger.debug('[PARSE] Webhook payload received', {
        hasMessage: !!update.message,
        hasCallback: !!update.callback_query,
      });
    } catch (error) {
      logger.error('[PARSE] Invalid JSON payload', {
        error: error instanceof Error ? error.message : String(error),
      });
      c.set('webhookContext', undefined);
      c.set('callbackContext', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Handle callback query (inline keyboard button clicks)
    if (update.callback_query) {
      const callbackCtx = parseCallbackQuery(update.callback_query);

      if (!callbackCtx) {
        logger.debug('[PARSE] Invalid callback query structure');
        c.set('webhookContext', undefined);
        c.set('callbackContext', undefined);
        c.set('skipProcessing', true);
        return next();
      }

      logger.info('[WEBHOOK] Callback query received', {
        callbackQueryId: callbackCtx.callbackQueryId,
        chatId: callbackCtx.chatId,
        userId: callbackCtx.userId,
        username: callbackCtx.username,
        data: callbackCtx.data.substring(0, 100),
      });

      // Set context for downstream handlers
      c.set('webhookContext', undefined);
      c.set('callbackContext', callbackCtx);
      c.set('skipProcessing', false);

      return next();
    }

    // Handle regular message
    const message = update.message;
    if (!message?.text || !message.from) {
      logger.debug('[PARSE] Skipping message without text or from', {
        hasText: !!message?.text,
        hasFrom: !!message?.from,
      });
      c.set('webhookContext', undefined);
      c.set('callbackContext', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Get bot username from environment (default: 'duyetbot')
    const botUsername = c.env.BOT_USERNAME ?? DEFAULT_BOT_USERNAME;

    // Extract context from parsed message
    const webhookCtx = extractWebhookContext(message, botUsername);

    logger.info('[WEBHOOK] Message received', JSON.parse(JSON.stringify(webhookCtx)));

    // In group chats: only process if bot is mentioned OR message is a reply (to anyone)
    // This allows users to engage with the bot by:
    // 1. Mentioning @bot in their message
    // 2. Replying to any message (including bot's previous responses or other users' messages)
    if (webhookCtx.isGroupChat && !webhookCtx.hasBotMention && !webhookCtx.isReply) {
      logger.debug('[PARSE] Skipping group message without mention or reply', {
        chatId: webhookCtx.chatId,
        chatType: webhookCtx.chatType,
        chatTitle: webhookCtx.chatTitle,
      });
      c.set('webhookContext', webhookCtx);
      c.set('callbackContext', undefined);
      c.set('skipProcessing', true);
      return next();
    }

    // Set context for downstream handlers
    c.set('webhookContext', webhookCtx);
    c.set('callbackContext', undefined);
    c.set('skipProcessing', false);

    return next();
  };
}
