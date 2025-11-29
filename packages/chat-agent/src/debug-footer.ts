/**
 * Debug Footer Formatter
 *
 * Shared implementation for formatting debug context as a collapsible footer
 * for admin users. Used by both direct responses and fire-and-forget paths.
 *
 * Format:
 * - Simple: 🔍 router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * - Orchestrator:
 *   🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *      ├─ research-worker (2.5s)
 *      └─ code-worker (1.2s)
 * - Progressive: Shows (running) for active agents/workers
 */

import type { DebugContext, DebugMetadata, ExecutionStatus, WorkerDebugInfo } from './types.js';

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
 * Escape special characters for Telegram MarkdownV2 format
 *
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdownV2(text: string): string {
  // All special characters that need escaping in MarkdownV2
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format agent/worker with timing or status
 * Examples: "simple-agent (3.77s)", "router-agent (running)", "code-worker (error)"
 */
function formatAgentTiming(name: string, durationMs?: number, status?: ExecutionStatus): string {
  if (status === 'running') {
    return `${name} (running)`;
  }
  if (status === 'error') {
    return durationMs ? `${name} (error, ${formatDuration(durationMs)})` : `${name} (error)`;
  }
  if (durationMs) {
    return `${name} (${formatDuration(durationMs)})`;
  }
  return name;
}

/**
 * Format duration in seconds with 2 decimal places
 */
function formatDuration(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

/**
 * Format classification as inline: [type/category/complexity]
 */
function formatClassification(classification?: DebugContext['classification']): string {
  if (!classification) {
    return '';
  }
  return `[${classification.type}/${classification.category}/${classification.complexity}]`;
}

/**
 * Format workers as nested list with tree characters
 * Example:
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 */
function formatWorkers(workers?: WorkerDebugInfo[]): string {
  if (!workers?.length) {
    return '';
  }

  return workers
    .map((worker, index, arr) => {
      const isLast = index === arr.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const timing = formatAgentTiming(worker.name, worker.durationMs, worker.status);
      return `\n   ${prefix} ${timing}`;
    })
    .join('');
}

/**
 * Format routing flow in new format:
 * router-agent (0.4s) → [classification] → target-agent (3.77s)
 *
 * New format places classification between router and target agent
 * for clearer flow visualization.
 */
function formatRoutingFlow(debugContext: DebugContext): string {
  const { routingFlow, routerDurationMs, classification } = debugContext;

  // Find router and target agent steps
  const routerStep = routingFlow.find((s) => s.agent === 'router' || s.agent === 'router-agent');
  const targetStep = routingFlow.find((s) => s.agent !== 'router' && s.agent !== 'router-agent');

  // Build router part with timing
  const routerDuration = routerDurationMs ?? routerStep?.durationMs;
  const routerPart = formatAgentTiming('router-agent', routerDuration, routerStep?.status);

  // Build classification part (inline between router and target)
  const classificationPart = formatClassification(classification);

  // Build target agent part with timing and status
  let targetPart = '';
  if (targetStep) {
    targetPart = formatAgentTiming(targetStep.agent, targetStep.durationMs, targetStep.status);
  }

  // Combine: router (time) → [classification] → target (time)
  const parts = [routerPart];
  if (classificationPart) {
    parts.push(classificationPart);
  }
  if (targetPart) {
    parts.push(targetPart);
  }

  return parts.join(' → ');
}

/**
 * Format metadata - simplified to only show error messages (HTML version)
 * Removed cache/timeout/err counts as they're redundant with error message
 */
function formatMetadata(
  metadata?: DebugMetadata,
  escapeFn: (text: string) => string = escapeHtml
): string {
  if (!metadata) {
    return '';
  }

  // Only show error message on separate line if present
  if (metadata.lastToolError) {
    return `\n⚠️ ${escapeFn(metadata.lastToolError)}`;
  }

  return '';
}

/**
 * Format debug context as expandable blockquote footer
 *
 * @example Output (simple agent):
 * ```
 * 🔍 router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * ```
 *
 * @example Output (orchestrator with workers):
 * ```
 * 🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * ```
 */
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkers(debugContext.workers);
  const metadata = formatMetadata(debugContext.metadata);

  return `\n\n<blockquote expandable>🔍 ${flow}${workers}${metadata}</blockquote>`;
}

/**
 * Format workers for MarkdownV2 with escaped tree characters
 */
function formatWorkersMarkdownV2(workers?: WorkerDebugInfo[]): string {
  if (!workers?.length) {
    return '';
  }

  return workers
    .map((worker, index, arr) => {
      const isLast = index === arr.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const timing = formatAgentTiming(worker.name, worker.durationMs, worker.status);
      return `\n   ${prefix} ${escapeMarkdownV2(timing)}`;
    })
    .join('');
}

/**
 * Format debug context as expandable quote for MarkdownV2
 *
 * Uses MarkdownV2 expandable blockquote syntax: **>content||
 * All special characters in content are escaped.
 *
 * @example Output (simple agent):
 * ```
 * **>🔍 router\-agent \(0\.4s\) → \[simple/general/low\] → simple\-agent \(3\.77s\)||
 * ```
 */
export function formatDebugFooterMarkdownV2(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkersMarkdownV2(debugContext.workers);
  const metadata = formatMetadata(debugContext.metadata, escapeMarkdownV2);

  // Escape the flow for MarkdownV2
  const escapedFlow = escapeMarkdownV2(flow);

  // MarkdownV2 expandable blockquote: **>content||
  return `\n\n**>🔍 ${escapedFlow}${workers}${metadata}||`;
}

/**
 * Format progressive debug footer for loading states (no blockquote wrapper)
 *
 * Used during loading to show debug info below the rotating loading message.
 * This version doesn't include the blockquote wrapper since it's meant for
 * transient display during execution.
 *
 * @example Output:
 * ```
 * 🔍 router-agent (0.4s) → [complex/research/low] → orchestrator-agent (running)
 *    ├─ research-worker (running)
 * ```
 */
export function formatProgressiveDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkers(debugContext.workers);

  return `🔍 ${flow}${workers}`;
}
