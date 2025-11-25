/**
 * Platform Response Helper
 *
 * Sends responses directly to platforms (Telegram, GitHub) bypassing the transport layer.
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget delegation.
 */

import { logger } from '@duyetbot/hono-middleware';

/**
 * Target information for response delivery
 */
export interface ResponseTarget {
  /** Chat/conversation identifier */
  chatId: string;
  /** Reference to the message to edit */
  messageRef: { messageId: number };
  /** Platform to send response to */
  platform: 'telegram' | 'github' | string;
  /** Bot token for authentication (optional, falls back to env) */
  botToken?: string;
}

/**
 * Environment with platform tokens
 */
export interface PlatformEnv {
  TELEGRAM_BOT_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

/**
 * Send response directly to platform (bypassing transport layer)
 *
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget.
 * This allows the RouterAgent to send responses even after the original
 * TelegramAgent/CloudflareAgent has returned.
 *
 * @param env - Environment with platform tokens
 * @param target - Target information (chatId, messageRef, platform)
 * @param text - Response text to send
 */
export async function sendPlatformResponse(
  env: PlatformEnv,
  target: ResponseTarget,
  text: string
): Promise<void> {
  const { platform, chatId, messageRef, botToken } = target;

  if (platform === 'telegram') {
    await sendTelegramResponse(env, chatId, messageRef.messageId, text, botToken);
  } else if (platform === 'github') {
    // GitHub response delivery - not yet implemented
    // Would need to use GitHub API to update PR comment or issue
    logger.warn('[sendPlatformResponse] GitHub platform not yet implemented');
  } else {
    logger.warn('[sendPlatformResponse] Unknown platform', { platform });
  }
}

/**
 * Send response via Telegram Bot API
 */
async function sendTelegramResponse(
  env: PlatformEnv,
  chatId: string,
  messageId: number,
  text: string,
  botToken?: string
): Promise<void> {
  const token = botToken || env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('No Telegram bot token available');
  }

  // Truncate text to Telegram's message limit
  const truncatedText = text.slice(0, 4096);

  const url = `https://api.telegram.org/bot${token}/editMessageText`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: truncatedText,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Check for "message is not modified" error (not a real error)
    if (response.status === 400 && errorText.includes('message is not modified')) {
      logger.info('[sendTelegramResponse] Message unchanged, skipping');
      return;
    }

    logger.error('[sendTelegramResponse] Telegram API error', {
      status: response.status,
      error: errorText,
      chatId,
      messageId,
    });

    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }

  logger.info('[sendTelegramResponse] Message sent successfully', {
    chatId,
    messageId,
    textLength: truncatedText.length,
  });
}
