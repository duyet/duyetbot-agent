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
 * Returns the message text and parse mode based on context configuration.
 *
 * IMPORTANT: Text is NOT escaped because the LLM is instructed to produce
 * properly formatted output (HTML tags for HTML mode, MarkdownV2 syntax for
 * MarkdownV2 mode). Escaping would break the LLM's intentional formatting.
 *
 * The system prompts instruct the LLM to:
 * - Use <b>, <i>, <code> tags in HTML mode
 * - Escape special chars (&lt;, &gt;, &amp;) in regular text
 * - Use *bold*, _italic_, `code` in MarkdownV2 mode
 *
 * Admin users with debug context get an expandable footer appended.
 *
 * @see packages/prompts/src/sections/guidelines.ts for LLM formatting instructions
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
  // Text is NOT escaped - LLM produces properly formatted HTML
  return {
    text: debugFooter ? text + debugFooter : text,
    parseMode: 'HTML',
  };
}
