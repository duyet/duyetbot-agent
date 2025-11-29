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
import { formatDebugFooter as coreFormatDebugFooter } from '@duyetbot/chat-agent/debug-footer';
import type { GitHubContext } from './transport.js';

/**
 * Format debug context as collapsible details section (admin only)
 *
 * Wraps the core formatDebugFooter with an admin check.
 * Returns null for non-admin users.
 *
 * Uses GitHub-flavored Markdown <details> element for collapsible section.
 */
export function formatDebugFooter(ctx: GitHubContext): string | null {
  if (!ctx.isAdmin) {
    return null;
  }

  // Use the GitHub-specific format from core
  return formatGitHubDebugFooter(ctx.debugContext);
}

/**
 * Format debug footer for GitHub (Markdown format)
 *
 * Uses <details> for collapsible debug info similar to Telegram's HTML format.
 */
export function formatGitHubDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const { routingFlow, classification, totalDurationMs } = debugContext;

  // Build agent chain with tools
  const agentChain = routingFlow
    .map((step) => {
      let entry = step.agent;
      if (step.tools && step.tools.length > 0) {
        entry += ` (${step.tools.join(', ')})`;
      }
      return entry;
    })
    .join(' \u2192 ');

  // Build classification info
  const classInfo = [
    classification?.type && `type: ${classification.type}`,
    classification?.category && `category: ${classification.category}`,
    classification?.complexity && `complexity: ${classification.complexity}`,
  ]
    .filter(Boolean)
    .join(', ');

  // Format duration
  const duration = totalDurationMs ? `${(totalDurationMs / 1000).toFixed(2)}s` : 'N/A';

  // GitHub-flavored Markdown with collapsible details
  return `

<details>
<summary>\ud83d\udd27 Debug Info</summary>

| Property | Value |
|----------|-------|
| **Flow** | ${agentChain} |
| **Classification** | ${classInfo || 'N/A'} |
| **Duration** | ${duration} |

</details>`;
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
