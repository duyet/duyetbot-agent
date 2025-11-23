/**
 * Telegram Transport Layer
 *
 * Implements the Transport interface for Telegram Bot API.
 */

import type { Transport } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';

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
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<number> {
  logger.debug('[TRANSPORT] Sending message', {
    chatId,
    textLength: text.length,
  });

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

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
  logger.debug('[TRANSPORT] Message sent', {
    chatId,
    messageId: result.result.message_id,
  });

  return result.result.message_id;
}

/**
 * Edit an existing message via Telegram Bot API
 */
async function editTelegramMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  logger.debug('[TRANSPORT] Editing message', {
    chatId,
    messageId,
    textLength: text.length,
  });

  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (response.ok) {
    logger.debug('[TRANSPORT] Message edited', { chatId, messageId });
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

  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action: 'typing',
    }),
  });
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
    },
  }),
};

/**
 * Create TelegramContext from webhook context
 *
 * @param token - Bot token
 * @param webhookCtx - Webhook context from middleware
 * @param adminUsername - Admin username for detailed errors
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
  adminUsername?: string
): TelegramContext {
  return {
    token,
    chatId: webhookCtx.chatId,
    userId: webhookCtx.userId,
    username: webhookCtx.username,
    text: webhookCtx.text,
    startTime: webhookCtx.startTime,
    adminUsername,
  };
}
