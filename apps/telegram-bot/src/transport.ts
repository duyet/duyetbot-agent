/**
 * Telegram Transport Layer
 *
 * Implements the Transport interface for Telegram Bot API.
 */

import type { Transport } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';

/** Telegram message length limit */
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Split long text into chunks for Telegram's message limit
 */
function splitMessage(text: string): string[] {
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
    if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
      breakPoint = remaining.lastIndexOf(' ', MAX_MESSAGE_LENGTH);
    }
    if (breakPoint === -1 || breakPoint < MAX_MESSAGE_LENGTH / 2) {
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
}

/**
 * Send a message via Telegram Bot API
 *
 * Handles long messages by chunking and falls back to plain text
 * if Markdown parsing fails.
 */
async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<number> {
  const chunks = splitMessage(text);
  let lastMessageId = 0;

  for (const chunk of chunks) {
    const payload = { chat_id: chatId, text: chunk, parse_mode: 'Markdown' };
    logger.debug('[TRANSPORT] Sending message', payload);

    // Try with Markdown first
    let response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Fallback to plain text if Markdown parsing fails (400 error)
    if (response.status === 400) {
      // Consume the error response body to prevent connection pool exhaustion
      await response.text();

      const withoutMarkdown = {
        chat_id: chatId,
        text: chunk,
      };
      logger.warn(
        '[TRANSPORT] Markdown parse failed, retrying without parse_mode',
        withoutMarkdown
      );

      response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withoutMarkdown),
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
 * Falls back to plain text if Markdown parsing fails.
 */
async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  // Truncate if too long for edit
  const truncatedText =
    text.length > MAX_MESSAGE_LENGTH
      ? `${text.slice(0, MAX_MESSAGE_LENGTH - 20)}...\n\n[truncated]`
      : text;

  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: truncatedText,
    parse_mode: 'Markdown',
  };

  logger.debug('[TRANSPORT] Editing message', payload);

  // Try with Markdown first
  let response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Fallback to plain text if Markdown parsing fails
  if (response.status === 400) {
    // Consume the error response body to prevent connection pool exhaustion
    await response.text();

    const withoutParseMode = {
      chat_id: chatId,
      message_id: messageId,
      text: truncatedText,
    };
    logger.warn(
      '[TRANSPORT] Markdown parse failed in edit, retrying without parse_mode',
      withoutParseMode
    );

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
    return sendTelegramMessage(ctx.token, ctx.chatId, text);
  },

  edit: async (ctx, ref, text) => {
    await editTelegramMessage(ctx.token, ctx.chatId, ref as number, text);
  },

  typing: async (ctx) => {
    await sendTypingIndicator(ctx.token, ctx.chatId);
  },

  parseContext: (ctx) => ({
    text: ctx.text,
    userId: ctx.userId,
    chatId: ctx.chatId,
    metadata: {
      username: ctx.username,
      startTime: ctx.startTime,
      requestId: ctx.requestId,
    },
  }),
};

/**
 * Create TelegramContext from webhook context
 *
 * @param token - Bot token
 * @param webhookCtx - Webhook context from middleware
 * @param adminUsername - Admin username for detailed errors
 * @param requestId - Request ID for trace correlation
 */
export function createTelegramContext(
  token: string,
  webhookCtx: {
    userId: number;
    chatId: number;
    text: string;
    username?: string;
    startTime: number;
  },
  adminUsername?: string,
  requestId?: string
): TelegramContext {
  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    requestId,
    username: webhookCtx.username,
    text: webhookCtx.text,
    startTime: webhookCtx.startTime,
    adminUsername,
  };
}
