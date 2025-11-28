/**
 * Debug Footer Formatter
 *
 * Shared implementation for formatting debug context as a collapsible footer
 * for admin users. Used by both direct responses and fire-and-forget paths.
 */

import type { DebugContext, DebugMetadata } from './types.js';

/**
 * Escape HTML entities in text for safe inclusion in HTML messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format duration in seconds with 2 decimal places
 */
function formatStepDuration(durationMs?: number): string {
  if (!durationMs) {
    return '';
  }
  return `${(durationMs / 1000).toFixed(2)}s`;
}

/**
 * Format routing flow as: router (0.12s) → agent (tool1 → tool2 → response, 1.23s)
 *
 * Each step shows:
 * - Agent name
 * - Tool chain (if any tools were called)
 * - Duration
 * - Error indicator if failed
 */
function formatRoutingFlow(routingFlow: DebugContext['routingFlow']): string {
  return routingFlow
    .map((step) => {
      const duration = formatStepDuration(step.durationMs);

      // Error case: agent (error, 1.23s)
      if (step.error) {
        const inner = duration ? `error, ${duration}` : 'error';
        return `${step.agent} (${inner})`;
      }

      // Build tool chain: tool1 → tool2 → response
      const chain = step.toolChain?.length ? `${step.toolChain.join(' → ')} → response` : '';

      // Combine chain and duration
      const parts = [chain, duration].filter(Boolean);
      const inner = parts.join(', ');

      return inner ? `${step.agent} (${inner})` : step.agent;
    })
    .join(' → ');
}

/**
 * Format classification as inline: [type/category/complexity]
 */
function formatClassification(classification?: DebugContext['classification']): string {
  if (!classification) {
    return '';
  }
  return ` [${classification.type}/${classification.category}/${classification.complexity}]`;
}

/**
 * Format metadata - simplified to only show error messages
 * Removed cache/timeout/err counts as they're redundant with error message
 */
function formatMetadata(metadata?: DebugMetadata): string {
  if (!metadata) {
    return '';
  }

  // Only show error message on separate line if present
  if (metadata.lastToolError) {
    return `\n⚠️ ${escapeHtml(metadata.lastToolError)}`;
  }

  return '';
}

/**
 * Format debug context as expandable blockquote footer
 *
 * @example Output:
 * ```
 * 🔍 router (0.12s) → duyet-info-agent (duyet_cv → get_posts → response, 2.34s) [simple/duyet/low]
 * ⚠️ get_latest_posts: Connection timeout after 12000ms
 * ```
 */
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext.routingFlow);
  const classification = formatClassification(debugContext.classification);
  const metadata = formatMetadata(debugContext.metadata);

  return `\n\n<blockquote expandable>🔍 ${flow}${classification}${metadata}</blockquote>`;
}
