/**
 * Debug Footer Formatter
 *
 * Formats routing debug information as a collapsible footer
 * for admin users in Telegram messages.
 */

import type { DebugContext } from '@duyetbot/chat-agent';
import type { TelegramContext } from './transport.js';

/**
 * Normalize username by removing leading @ if present
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Check if the current user is an admin
 * Handles both '@username' and 'username' formats
 */
export function isAdminUser(ctx: TelegramContext): boolean {
  if (!ctx.adminUsername || !ctx.username) {
    return false;
  }
  return normalizeUsername(ctx.username) === normalizeUsername(ctx.adminUsername);
}

/**
 * Format debug context as an expandable blockquote footer
 *
 * Uses Telegram's HTML <blockquote expandable> for collapsible display.
 * Only returns content for admin users with valid debug context.
 *
 * @example Output:
 * ```
 * <blockquote expandable>🔍 router → simple-agent 1.23s
 * simple/general/low</blockquote>
 * ```
 */
export function formatDebugFooter(ctx: TelegramContext): string | null {
  // Only show for admin users
  if (!isAdminUser(ctx)) {
    return null;
  }

  const debugContext = ctx.debugContext;
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = debugContext.routingFlow;

  // Format routing flow: agent1 (tool1, tool2) → agent2 → ...
  const flowStr = flow
    .map((step) => {
      const tools = step.tools?.length ? ` (${step.tools.join(', ')})` : '';
      return `${step.agent}${tools}`;
    })
    .join(' → ');

  // Format duration
  const duration = debugContext.totalDurationMs
    ? ` ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`
    : '';

  // Format classification
  const classification = debugContext.classification
    ? `\n${debugContext.classification.type}/${debugContext.classification.category}/${debugContext.classification.complexity}`
    : '';

  return `\n\n<blockquote expandable>🔍 ${flowStr}${duration}${classification}</blockquote>`;
}

/**
 * Escape HTML entities in text for safe inclusion in HTML messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Prepare message with optional debug footer for sending
 *
 * Returns the message text and the parse mode to use.
 * If debug footer is present, uses HTML mode and escapes the main message.
 * Otherwise, uses Markdown mode as before.
 */
export function prepareMessageWithDebug(
  text: string,
  ctx: TelegramContext
): { text: string; parseMode: 'HTML' | 'Markdown' | undefined } {
  const debugFooter = formatDebugFooter(ctx);

  if (debugFooter) {
    // Use HTML mode when debug footer is present
    // Escape HTML entities in the main message to prevent injection
    const escapedText = escapeHtml(text);
    return {
      text: escapedText + debugFooter,
      parseMode: 'HTML',
    };
  }

  // Default to Markdown for non-admin users
  return {
    text,
    parseMode: 'Markdown',
  };
}
