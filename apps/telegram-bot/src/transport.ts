/**
 * Telegram Transport Layer
 *
 * Implements the Transport interface for Telegram Bot API.
 */

import type { DebugContext, Transport } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import { prepareMessageWithDebug } from './debug-footer.js';

/** Telegram message length limit */
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Minimum acceptable break point threshold (50% of max length).
 * If no natural break is found above this threshold, we hard-split at max length.
 */
const MIN_BREAK_THRESHOLD = MAX_MESSAGE_LENGTH / 2;

/**
 * Split long text into chunks for Telegram's message limit.
 * Prefers breaking at newlines, then spaces, then hard-splits if necessary.
 *
 * @internal Exported for testing
 */
export function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (newline or space)
    let breakPoint = remaining.lastIndexOf('\n', MAX_MESSAGE_LENGTH);
    if (breakPoint === -1 || breakPoint < MIN_BREAK_THRESHOLD) {
      breakPoint = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
    }
    if (breakPoint === -1 || breakPoint < MIN_BREAK_THRESHOLD) {
      breakPoint = MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

/**
 * Telegram-specific context for transport operations
 *
 * Note: ExecutionContext is not included as it's not serializable
 * and Durable Objects require all data to be serializable.
 */
export interface TelegramContext {
  /** Bot token for API calls */
  token: string;
  /** Chat ID to send messages to */
  chatId: number;
  /** User ID */
  userId: number;
  /** Username (optional) */
  username?: string;
  /** Message text */
  text: string;
  /** Start time for duration tracking */
  startTime: number;
  /** Admin username for detailed errors */
  adminUsername?: string;
  /** Request ID for trace correlation across webhook and DO invocations */
  requestId?: string;
  /** Debug context for admin users (routing flow, timing, classification) */
  debugContext?: DebugContext;
  /** Whether current user is an admin (computed from username + adminUsername) */
  isAdmin: boolean;
  /** Parse mode for message formatting */
  parseMode?: 'HTML' | 'MarkdownV2';
  /** Message ID of the user's message (for reply threading) */
  messageId: number;
  /** Message ID of the quoted message (when user replied to a message) */
  replyToMessageId?: number;
}

/**
 * Send a message via Telegram Bot API
 *
 * Handles long messages by chunking and falls back to plain text
 * if parsing fails.
 *
 * @param token - Bot token
 * @param chatId - Chat to send to
 * @param text - Message text
 * @param parseMode - Parse mode ('HTML', 'Markdown', or undefined for plain text)
 * @param replyToMessageId - Message ID to reply to (creates reply threading)
 */
async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | 'Markdown' | undefined = 'HTML',
  replyToMessageId?: number
): Promise<number> {
  const chunks = splitMessage(text);
  let lastMessageId = 0;

  for (const chunk of chunks) {
    // Build payload with optional parse_mode and reply_to_message_id
    const payload: Record<string, unknown> = { chat_id: chatId, text: chunk };
    if (parseMode) {
      payload.parse_mode = parseMode;
    }
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    logger.debug('[TRANSPORT] Sending message', payload);

    // Try with parse mode first (if specified)
    let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Fallback to plain text if parsing fails (400 error)
    if (response.status === 400 && parseMode) {
      // Read and log the actual Telegram API error for debugging
      const errorBody = await response.text();
      let errorDetail = '';
      try {
        const parsed = JSON.parse(errorBody);
        errorDetail = parsed.description || errorBody;
      } catch {
        errorDetail = errorBody;
      }

      const withoutParseMode = {
        chat_id: chatId,
        text: chunk,
      };

      // Log detailed error info including the Telegram API error message
      logger.warn(`[TRANSPORT] ${parseMode} parse failed, retrying without parse_mode`, {
        ...withoutParseMode,
        telegramError: errorDetail,
        textLength: chunk.length,
        textPreview: chunk.length > 100 ? `${chunk.slice(0, 100)}...` : chunk,
      });

      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutParseMode),
      });
    }

    if (!response.ok) {
      const error = await response.text();
      logger.error('[TRANSPORT] Send message failed', {
        status: response.status,
        error,
        chatId,
      });
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const result = await response.json<{ result: { message_id: number } }>();
    lastMessageId = result.result.message_id;
    logger.debug('[TRANSPORT] Message sent', {
      chatId,
      messageId: lastMessageId,
    });
  }

  return lastMessageId;
}

/**
 * Edit an existing message via Telegram Bot API
 *
 * Falls back to plain text if parsing fails.
 *
 * @param token - Bot token
 * @param chatId - Chat containing the message
 * @param messageId - Message to edit
 * @param text - New message text
 * @param parseMode - Parse mode ('HTML', 'Markdown', or undefined for plain text)
 */
async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  parseMode: 'HTML' | 'MarkdownV2' | 'Markdown' | undefined = 'HTML'
): Promise<void> {
  // Truncate if too long for edit
  const truncatedText =
    text.length > MAX_MESSAGE_LENGTH
      ? `${text.slice(0, MAX_MESSAGE_LENGTH - 20)}...\n\n[truncated]`
      : text;

  // Build payload with optional parse_mode
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: truncatedText,
  };
  if (parseMode) {
    payload.parse_mode = parseMode;
  }

  logger.debug('[TRANSPORT] Editing message', payload);

  // Try with parse mode first (if specified)
  let response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Fallback to plain text if parsing fails
  if (response.status === 400 && parseMode) {
    // Read and log the actual Telegram API error for debugging
    const errorBody = await response.text();
    let errorDetail = '';
    try {
      const parsed = JSON.parse(errorBody);
      errorDetail = parsed.description || errorBody;
    } catch {
      errorDetail = errorBody;
    }

    const withoutParseMode = {
      chat_id: chatId,
      message_id: messageId,
      text: truncatedText,
    };

    // Log detailed error info including the Telegram API error message
    logger.warn(`[TRANSPORT] ${parseMode} parse failed in edit, retrying without parse_mode`, {
      ...withoutParseMode,
      telegramError: errorDetail,
      textLength: truncatedText.length,
      textPreview: truncatedText.length > 100 ? `${truncatedText.slice(0, 100)}...` : truncatedText,
    });

    // Retry
    response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withoutParseMode),
    });
  }

  if (response?.ok) {
    logger.info('[TRANSPORT] Message edited successfully', {
      chatId,
      messageId,
    });
  } else {
    const error = await response.text();
    logger.error('[TRANSPORT] Edit message failed', {
      status: response.status,
      error,
      chatId,
      messageId,
    });
    // Don't throw - message might have been deleted
  }
}

/**
 * Send typing indicator via Telegram Bot API
 */
async function sendTypingIndicator(token: string, chatId: number): Promise<void> {
  logger.debug('[TRANSPORT] Sending typing indicator', { chatId });

  const response = await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing',
    }),
  });

  // Consume response body to prevent connection pool exhaustion
  // We don't need to handle errors here - typing indicators are best-effort
  await response.text();
}

/**
 * Telegram transport implementation
 *
 * Integrates debug footer for admin users via context chain pattern:
 * - CloudflareAgent populates ctx.debugContext after routing
 * - Transport calls prepareMessageWithDebug() to format footer
 * - Admin users see expandable debug info, others see plain response
 *
 * @example
 * ```typescript
 * const TelegramAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   transport: telegramTransport,
 * });
 * ```
 */
export const telegramTransport: Transport<TelegramContext> = {
  send: async (ctx, text) => {
    // Apply debug footer for admin users (context chain pattern)
    const { text: finalText, parseMode } = prepareMessageWithDebug(text, ctx);
    // Always reply to user's message for threading
    return sendTelegramMessage(ctx.token, ctx.chatId, finalText, parseMode, ctx.messageId);
  },

  edit: async (ctx, ref, text) => {
    // Apply debug footer for admin users (context chain pattern)
    const { text: finalText, parseMode } = prepareMessageWithDebug(text, ctx);
    await editTelegramMessage(ctx.token, ctx.chatId, ref as number, finalText, parseMode);
  },

  typing: async (ctx) => {
    await sendTypingIndicator(ctx.token, ctx.chatId);
  },

  parseContext: (ctx) => ({
    text: ctx.text,
    userId: ctx.userId,
    chatId: ctx.chatId,
    username: ctx.username,
    messageRef: ctx.messageId,
    replyTo: ctx.replyToMessageId,
    metadata: {
      startTime: ctx.startTime,
      requestId: ctx.requestId,
    },
  }),
};

/**
 * Normalize username by removing leading @ if present
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Compute admin status from username comparison
 * Handles both '@username' and 'username' formats
 */
function computeIsAdmin(username?: string, adminUsername?: string): boolean {
  if (!username || !adminUsername) {
    return false;
  }
  return normalizeUsername(username) === normalizeUsername(adminUsername);
}

/**
 * Create TelegramContext from webhook context
 *
 * @param token - Bot token
 * @param webhookCtx - Webhook context from middleware
 * @param adminUsername - Admin username for detailed errors
 * @param requestId - Request ID for trace correlation
 * @param parseMode - Parse mode for message formatting
 */
export function createTelegramContext(
  token: string,
  webhookCtx: {
    userId: number;
    chatId: number;
    text: string;
    username?: string;
    startTime: number;
    messageId: number;
    replyToMessageId?: number;
  },
  adminUsername?: string,
  requestId?: string,
  parseMode?: 'HTML' | 'MarkdownV2'
): TelegramContext {
  const isAdmin = computeIsAdmin(webhookCtx.username, adminUsername);

  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    requestId,
    username: webhookCtx.username,
    text: webhookCtx.text,
    startTime: webhookCtx.startTime,
    adminUsername,
    isAdmin,
    parseMode,
    messageId: webhookCtx.messageId,
    replyToMessageId: webhookCtx.replyToMessageId,
  };
}
