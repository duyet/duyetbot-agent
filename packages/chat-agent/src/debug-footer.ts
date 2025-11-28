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
 * Format routing flow as: router → agent (tool1, tool2) → subagent
 */
function formatRoutingFlow(routingFlow: DebugContext['routingFlow']): string {
  return routingFlow
    .map((step) => {
      const tools = step.tools?.length ? ` (${step.tools.join(', ')})` : '';
      return `${step.agent}${tools}`;
    })
    .join(' → ');
}

/**
 * Format duration in seconds with 2 decimal places
 */
function formatDuration(durationMs?: number): string {
  if (!durationMs) {
    return '';
  }
  return ` ${(durationMs / 1000).toFixed(2)}s`;
}

/**
 * Format classification as: type/category/complexity
 */
function formatClassification(classification?: DebugContext['classification']): string {
  if (!classification) {
    return '';
  }
  return `\n${classification.type}/${classification.category}/${classification.complexity}`;
}

/**
 * Format metadata indicators (fallback, cache, timeout, errors)
 */
function formatMetadata(metadata?: DebugMetadata): string {
  if (!metadata) {
    return '';
  }

  const parts: string[] = [];

  if (metadata.fallback) {
    parts.push('[fallback]');
  }

  if (metadata.cacheHits !== undefined || metadata.cacheMisses !== undefined) {
    parts.push(`cache:${metadata.cacheHits ?? 0}/${metadata.cacheMisses ?? 0}`);
  }

  if (metadata.toolTimeouts && metadata.toolTimeouts > 0) {
    const tools = metadata.timedOutTools?.length ? ` (${metadata.timedOutTools.join(', ')})` : '';
    parts.push(`timeout:${metadata.toolTimeouts}${tools}`);
  }

  if (metadata.toolErrors && metadata.toolErrors > 0) {
    parts.push(`err:${metadata.toolErrors}`);
  }

  let result = parts.length > 0 ? `\n${parts.join(' ')}` : '';

  // Error message on separate line
  if (metadata.lastToolError) {
    result += `\n⚠️ ${escapeHtml(metadata.lastToolError)}`;
  }

  return result;
}

/**
 * Format execution path for step-by-step tracing
 * @example: "thinking → routing:simple-agent → tool:duyet_cv → preparing"
 */
function formatExecutionPath(executionPath?: string[]): string {
  if (!executionPath || executionPath.length === 0) {
    return '';
  }

  // Simplify path for display (remove redundant prefixes and collapse)
  const simplified = executionPath.map((step) => {
    if (step.startsWith('tool:')) {
      const parts = step.split(':');
      // tool:name:start/complete/error -> just name
      return parts[1] || step;
    }
    if (step.startsWith('routing:')) {
      return step.split(':')[1] || step;
    }
    if (step.startsWith('llm:')) {
      return step; // Keep as-is: llm:2/5
    }
    return step;
  });

  // Remove consecutive duplicates and filter out intermediate states
  const deduped = simplified.filter((step, i, arr) => i === 0 || step !== arr[i - 1]);

  return `\n📋 ${deduped.join(' → ')}`;
}

/**
 * Format debug context as expandable blockquote footer
 *
 * @example Output:
 * ```
 * 🔍 router → duyet-info-agent (get_latest_posts) 2.34s
 * simple/duyet/low
 * 📋 thinking → simple-agent → duyet_cv → preparing
 * [fallback] cache:1/0 timeout:1 (get_latest_posts) err:1
 * ⚠️ get_latest_posts: Connection timeout after 12000ms
 * ```
 */
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext.routingFlow);
  const duration = formatDuration(debugContext.totalDurationMs);
  const classification = formatClassification(debugContext.classification);
  const executionPath = formatExecutionPath(debugContext.executionPath);
  const metadata = formatMetadata(debugContext.metadata);

  return `\n\n<blockquote expandable>🔍 ${flow}${duration}${classification}${executionPath}${metadata}</blockquote>`;
}
