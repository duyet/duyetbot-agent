/**
 * Platform Response Helper
 *
 * Sends responses directly to platforms (Telegram, GitHub) bypassing the transport layer.
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget delegation.
 *
 * Phase 5: Full Debug Footer Support
 * ===================================
 * Debug footer IS NOW SUPPORTED in fire-and-forget flow:
 *
 * 1. ResponseTarget includes adminUsername + username
 * 2. sendPlatformResponse() accepts optional debugContext parameter
 * 3. Admin users see expandable debug footer with routing flow, tools, and timing
 *
 * The footer shows:
 * - Agent chain: router → simple-agent → (sub-agents if any)
 * - Tools used: (search, calculator) per agent
 * - Duration: 2.34s total processing time
 * - Classification: type/category/complexity
 */

import { logger } from '@duyetbot/hono-middleware';
import type { DebugContext } from './types.js';

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
  /** Admin username for debug footer (Phase 5) */
  adminUsername?: string;
  /** Current user's username for admin check (Phase 5) */
  username?: string;
}

/**
 * Environment with platform tokens
 */
export interface PlatformEnv {
  TELEGRAM_BOT_TOKEN?: string;
  GITHUB_TOKEN?: string;
}

/**
 * Normalize username by removing leading @ if present
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Check if current user is admin
 */
function isAdminUser(target: ResponseTarget): boolean {
  if (!target.adminUsername || !target.username) {
    return false;
  }
  return normalizeUsername(target.username) === normalizeUsername(target.adminUsername);
}

/**
 * Escape HTML entities in text for safe inclusion in HTML messages
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Format debug context as expandable blockquote footer
 *
 * Example output:
 * 🔍 router → simple-agent (search, calculator) 2.34s
 * simple/general/low
 */
function formatDebugFooter(debugContext: DebugContext): string {
  const flow = debugContext.routingFlow;

  // Format: router → agent (tool1, tool2) → subagent
  const flowStr = flow
    .map((step) => {
      const tools = step.tools?.length ? ` (${step.tools.join(', ')})` : '';
      return `${step.agent}${tools}`;
    })
    .join(' → ');

  const duration = debugContext.totalDurationMs
    ? ` ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`
    : '';

  const classification = debugContext.classification
    ? `\n${debugContext.classification.type}/${debugContext.classification.category}/${debugContext.classification.complexity}`
    : '';

  return `\n\n<blockquote expandable>🔍 ${flowStr}${duration}${classification}</blockquote>`;
}

/**
 * Send response directly to platform (bypassing transport layer)
 *
 * Used by RouterAgent alarm handler to deliver responses after fire-and-forget.
 * This allows the RouterAgent to send responses even after the original
 * TelegramAgent/CloudflareAgent has returned.
 *
 * @param env - Environment with platform tokens
 * @param target - Target information (chatId, messageRef, platform, adminUsername, username)
 * @param text - Response text to send
 * @param debugContext - Optional debug context for admin users
 */
export async function sendPlatformResponse(
  env: PlatformEnv,
  target: ResponseTarget,
  text: string,
  debugContext?: DebugContext
): Promise<void> {
  const { platform, chatId, messageRef, botToken } = target;

  if (platform === 'telegram') {
    // Determine if admin and should show debug footer
    let finalText = text;
    let parseMode: 'HTML' | 'Markdown' = 'Markdown';

    if (isAdminUser(target) && debugContext?.routingFlow?.length) {
      finalText = escapeHtml(text) + formatDebugFooter(debugContext);
      parseMode = 'HTML';

      logger.debug('[sendPlatformResponse] Debug footer applied', {
        username: target.username,
        flowLength: debugContext.routingFlow.length,
      });
    }

    await sendTelegramResponse(env, chatId, messageRef.messageId, finalText, botToken, parseMode);
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
 *
 * @param env - Environment with tokens
 * @param chatId - Chat to send to
 * @param messageId - Message to edit
 * @param text - Message text
 * @param botToken - Optional bot token override
 * @param parseMode - Parse mode ('HTML' or 'Markdown')
 */
async function sendTelegramResponse(
  env: PlatformEnv,
  chatId: string,
  messageId: number,
  text: string,
  botToken?: string,
  parseMode: 'HTML' | 'Markdown' = 'Markdown'
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
      parse_mode: parseMode,
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
