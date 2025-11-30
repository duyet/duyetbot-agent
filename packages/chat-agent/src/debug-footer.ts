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

import type {
  DebugContext,
  DebugMetadata,
  ExecutionStatus,
  TokenUsage,
  WorkerDebugInfo,
} from './types.js';

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
 * Format a number with k suffix for thousands
 * Examples: 500 → "500", 1200 → "1.2k", 15000 → "15k"
 */
function formatNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    // Use 1 decimal for values < 10k, no decimal for larger
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(n);
}

/**
 * Format token usage as compact string
 * Examples: "500↓/100↑", "1.2k↓/0.5k↑/0.3k⚡", "5k↓/2k↑/1k⚡/3k🧠"
 *
 * Symbols:
 * - ↓ = input tokens (prompt)
 * - ↑ = output tokens (completion)
 * - ⚡ = cached tokens (prompt cache hits)
 * - 🧠 = reasoning tokens (o1/o3 internal reasoning)
 */
function formatTokenUsage(usage?: TokenUsage): string {
  if (!usage || usage.totalTokens === 0) {
    return '';
  }

  let result = `${formatNumber(usage.inputTokens)}↓/${formatNumber(usage.outputTokens)}↑`;

  if (usage.cachedTokens && usage.cachedTokens > 0) {
    result += `/${formatNumber(usage.cachedTokens)}⚡`;
  }
  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    result += `/${formatNumber(usage.reasoningTokens)}🧠`;
  }

  return result;
}

/**
 * Format agent/worker with timing, tokens, and status
 * Examples:
 * - "simple-agent (3.77s)" - timing only
 * - "router-agent (0.4s, 500↓/100↑)" - timing with tokens
 * - "router-agent (running)" - status only
 * - "code-worker (error, 1.2s)" - error with timing
 */
function formatAgentTiming(
  name: string,
  durationMs?: number,
  status?: ExecutionStatus,
  tokenUsage?: TokenUsage
): string {
  if (status === 'running') {
    return `${name} (running)`;
  }

  const parts: string[] = [];

  // Add timing
  if (durationMs) {
    parts.push(formatDuration(durationMs));
  }

  // Add token usage (only for completed or undefined status, not during running)
  if (tokenUsage) {
    const tokens = formatTokenUsage(tokenUsage);
    if (tokens) {
      parts.push(tokens);
    }
  }

  // Add error status
  if (status === 'error') {
    parts.push('error');
  }

  if (parts.length > 0) {
    return `${name} (${parts.join(', ')})`;
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
 *    ├─ research-worker (2.5s, 1.5k↓/0.3k↑)
 *    └─ code-worker (1.2s, 0.8k↓/0.2k↑)
 */
function formatWorkers(workers?: WorkerDebugInfo[]): string {
  if (!workers?.length) {
    return '';
  }

  return workers
    .map((worker, index, arr) => {
      const isLast = index === arr.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const timing = formatAgentTiming(
        worker.name,
        worker.durationMs,
        worker.status,
        worker.tokenUsage
      );
      return `\n   ${prefix} ${timing}`;
    })
    .join('');
}

/**
 * Format routing flow in new format:
 * router-agent (0.4s, 500↓/100↑) → [classification] → target-agent (3.77s, 1.2k↓/0.5k↑)
 *
 * New format places classification between router and target agent
 * for clearer flow visualization. Token usage is shown per-step.
 */
function formatRoutingFlow(debugContext: DebugContext): string {
  const { routingFlow, routerDurationMs, classification } = debugContext;

  // Find router and target agent steps
  const routerStep = routingFlow.find((s) => s.agent === 'router' || s.agent === 'router-agent');
  const targetStep = routingFlow.find((s) => s.agent !== 'router' && s.agent !== 'router-agent');

  // Build router part with timing and tokens
  const routerDuration = routerDurationMs ?? routerStep?.durationMs;
  const routerPart = formatAgentTiming(
    'router-agent',
    routerDuration,
    routerStep?.status,
    routerStep?.tokenUsage
  );

  // Build classification part (inline between router and target)
  const classificationPart = formatClassification(classification);

  // Build target agent part with timing, tokens, and status
  let targetPart = '';
  if (targetStep) {
    targetPart = formatAgentTiming(
      targetStep.agent,
      targetStep.durationMs,
      targetStep.status,
      targetStep.tokenUsage
    );
  }

  // Combine: router (time, tokens) → [classification] → target (time, tokens)
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
 * Format workers for MarkdownV2 with escaped tree characters and token usage
 */
function formatWorkersMarkdownV2(workers?: WorkerDebugInfo[]): string {
  if (!workers?.length) {
    return '';
  }

  return workers
    .map((worker, index, arr) => {
      const isLast = index === arr.length - 1;
      const prefix = isLast ? '└─' : '├─';
      const timing = formatAgentTiming(
        worker.name,
        worker.durationMs,
        worker.status,
        worker.tokenUsage
      );
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

/**
 * Format debug footer for GitHub-flavored Markdown
 *
 * Uses <details> for collapsible section and code block for tree structure.
 * Shows full agent flow with timing, nested workers, and error metadata.
 *
 * @example Output (simple agent):
 * ```markdown
 * <details>
 * <summary>🔍 Debug Info</summary>
 *
 * ```
 * router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * ```
 *
 * </details>
 * ```
 *
 * @example Output (orchestrator with workers):
 * ```markdown
 * <details>
 * <summary>🔍 Debug Info</summary>
 *
 * ```
 * router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * ⚠️ Tool timeout: external_api
 * ```
 *
 * </details>
 * ```
 */
export function formatDebugFooterMarkdown(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkers(debugContext.workers);
  // No escaping needed for Markdown code blocks
  const metadata = formatMetadata(debugContext.metadata, (s) => s);

  // Build content lines
  const contentLines = [`🔍 ${flow}${workers}`];
  if (metadata) {
    contentLines.push(metadata);
  }

  // GitHub-flavored Markdown with collapsible details and code block
  return `

<details>
<summary>🔍 Debug Info</summary>

\`\`\`
${contentLines.join('\n')}
\`\`\`

</details>`;
}
