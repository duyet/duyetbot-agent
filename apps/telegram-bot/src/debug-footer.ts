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
  smartEscapeMarkdownV2,
} from '@duyetbot/cloudflare-agent/debug-footer';
import { sanitizeLLMResponseForTelegram } from '@duyetbot/cloudflare-agent/sanitization';
import type { TelegramContext } from './transport.js';

// Re-export escape functions directly (no wrapper needed)
export { escapeHtml, escapeMarkdownV2, smartEscapeMarkdownV2 };

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
 * For HTML mode: Sanitizes LLM response to convert markdown to valid Telegram HTML.
 * This handles common markdown patterns like headers, bold, italic, links, and code.
 *
 * Admin users with debug context get an expandable footer appended.
 *
 * @see packages/cloudflare-agent/src/sanitization/telegram-sanitizer.ts
 */
export function prepareMessageWithDebug(
  text: string,
  ctx: TelegramContext
): { text: string; parseMode: 'HTML' | 'MarkdownV2' | undefined } {
  const debugFooter = formatDebugFooter(ctx);

  // Use MarkdownV2 parse mode if configured
  // Text is NOT escaped - LLM produces properly formatted MarkdownV2
  if (ctx.parseMode === 'MarkdownV2') {
    return {
      text: debugFooter ? text + debugFooter : text,
      parseMode: 'MarkdownV2',
    };
  }

  // Default to HTML parse mode
  // Sanitize LLM response to convert markdown to valid Telegram HTML
  const sanitizedText = sanitizeLLMResponseForTelegram(text);
  return {
    text: debugFooter ? sanitizedText + debugFooter : sanitizedText,
    parseMode: 'HTML',
  };
}
