/**
 * Debug Footer Formatter - Telegram Transport
 *
 * Thin wrapper that adds admin user check to the shared debug footer implementation.
 *
 * Note: Uses direct path import to avoid cloudflare: protocol dependencies
 * that would be pulled in from the barrel export.
 */

// Direct path import to avoid cloudflare: protocol issues in tests
import {
  formatDebugFooter as coreFormatDebugFooter,
  escapeHtml,
} from '@duyetbot/chat-agent/debug-footer';
import type { TelegramContext } from './transport.js';

// Re-export escapeHtml directly (no wrapper needed)
export { escapeHtml };

/**
 * Format debug context as expandable blockquote footer (admin only)
 *
 * Wraps the core formatDebugFooter with an admin check.
 * Returns null for non-admin users.
 */
export function formatDebugFooter(ctx: TelegramContext): string | null {
  if (!ctx.isAdmin) {
    return null;
  }
  return coreFormatDebugFooter(ctx.debugContext);
}

/**
 * Prepare message with optional debug footer for sending
 *
 * Returns the message text and parse mode.
 * Always uses HTML mode with escaped text for reliable formatting.
 * Admin users with debug context get an expandable footer appended.
 */
export function prepareMessageWithDebug(
  text: string,
  ctx: TelegramContext
): { text: string; parseMode: 'HTML' | 'Markdown' | undefined } {
  const debugFooter = formatDebugFooter(ctx);
  const escapedText = escapeHtml(text);

  return {
    text: debugFooter ? escapedText + debugFooter : escapedText,
    parseMode: 'HTML',
  };
}
