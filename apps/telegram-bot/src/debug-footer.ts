/**
 * Debug Footer Formatter - Telegram Transport
 *
 * Thin wrapper that adds admin user check to the shared debug footer implementation.
 * Supports both HTML and MarkdownV2 parse modes based on context configuration.
 *
 * Note: Uses direct path import to avoid cloudflare: protocol dependencies
 * that would be pulled in from the barrel export.
 */

// Direct path import to avoid cloudflare: protocol issues in tests
import {
  formatDebugFooter as coreFormatDebugFooter,
  formatDebugFooterMarkdownV2 as coreFormatDebugFooterMarkdownV2,
  escapeHtml,
  escapeMarkdownV2,
} from '@duyetbot/chat-agent/debug-footer';
import type { TelegramContext } from './transport.js';

// Re-export escape functions directly (no wrapper needed)
export { escapeHtml, escapeMarkdownV2 };

/**
 * Format debug context as expandable blockquote footer (admin only)
 *
 * Wraps the core formatDebugFooter with an admin check.
 * Returns null for non-admin users.
 * Uses the appropriate formatter based on the context's parseMode.
 */
export function formatDebugFooter(ctx: TelegramContext): string | null {
  if (!ctx.isAdmin) {
    return null;
  }

  // Use MarkdownV2 formatter if parseMode is MarkdownV2
  if (ctx.parseMode === 'MarkdownV2') {
    return coreFormatDebugFooterMarkdownV2(ctx.debugContext);
  }

  // Default to HTML formatter
  return coreFormatDebugFooter(ctx.debugContext);
}

/**
 * Prepare message with optional debug footer for sending
 *
 * Returns the message text and parse mode based on context configuration.
 * Escapes text appropriately for the target parse mode.
 * Admin users with debug context get an expandable footer appended.
 */
export function prepareMessageWithDebug(
  text: string,
  ctx: TelegramContext
): { text: string; parseMode: 'HTML' | 'MarkdownV2' | undefined } {
  const debugFooter = formatDebugFooter(ctx);

  // Use MarkdownV2 escaping and parse mode if configured
  if (ctx.parseMode === 'MarkdownV2') {
    const escapedText = escapeMarkdownV2(text);
    return {
      text: debugFooter ? escapedText + debugFooter : escapedText,
      parseMode: 'MarkdownV2',
    };
  }

  // Default to HTML escaping and parse mode
  const escapedText = escapeHtml(text);
  return {
    text: debugFooter ? escapedText + debugFooter : escapedText,
    parseMode: 'HTML',
  };
}
