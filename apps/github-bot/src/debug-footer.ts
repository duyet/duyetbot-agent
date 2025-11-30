/**
 * Debug Footer Formatter - GitHub Transport
 *
 * Thin wrapper that adds admin user check to the shared debug footer implementation.
 * Uses GitHub-flavored Markdown with collapsible <details> section.
 *
 * Note: Uses direct path import to avoid cloudflare: protocol dependencies
 * that would be pulled in from the barrel export.
 */

import type { DebugContext } from '@duyetbot/chat-agent';
// Direct path import to avoid cloudflare: protocol issues in tests
import { formatDebugFooterMarkdown as coreFormatDebugFooterMarkdown } from '@duyetbot/chat-agent/debug-footer';
import type { GitHubContext } from './transport.js';

/**
 * Format debug context as collapsible details section (admin only)
 *
 * Wraps the core formatDebugFooterMarkdown with an admin check.
 * Returns null for non-admin users.
 *
 * Uses GitHub-flavored Markdown <details> element for collapsible section.
 */
export function formatDebugFooter(ctx: GitHubContext): string | null {
  if (!ctx.isAdmin) {
    return null;
  }

  // Use the GitHub-specific Markdown format from core
  return formatGitHubDebugFooter(ctx.debugContext);
}

/**
 * Format debug footer for GitHub (Markdown format)
 *
 * Delegates to the shared core formatter which provides:
 * - Full agent flow with timing: router-agent (0.4s) → [type/cat/complexity] → agent (3.77s)
 * - Nested workers with tree structure: ├─ worker (2.5s), └─ worker (1.2s)
 * - Error metadata: ⚠️ error message
 * - Collapsible <details> wrapper with code block for monospace formatting
 */
export function formatGitHubDebugFooter(debugContext?: DebugContext): string | null {
  return coreFormatDebugFooterMarkdown(debugContext);
}

/**
 * Prepare message with optional debug footer for sending
 *
 * Returns the message text with debug footer appended for admin users.
 * Non-admin users receive the message without modification.
 */
export function prepareMessageWithDebug(text: string, ctx: GitHubContext): string {
  const debugFooter = formatDebugFooter(ctx);
  return debugFooter ? text + debugFooter : text;
}
