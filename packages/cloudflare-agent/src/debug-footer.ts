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
 * Escape special characters for Telegram MarkdownV2 format (simple version)
 *
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * This is a simple escape that escapes ALL special characters.
 * Use smartEscapeMarkdownV2() to preserve formatting syntax.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdownV2(text: string): string {
  // All special characters that need escaping in MarkdownV2
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Smart escape for Telegram MarkdownV2 that preserves formatting syntax
 *
 * Handles these MarkdownV2 constructs:
 * - *bold*, _italic_, __underline__, ~strikethrough~, ||spoiler||
 * - [text](url) links - escapes text, preserves URL (only escape ) and \)
 * - *[text](url)* bold-wrapped links - preserves outer markers
 * - _[text](url)_ italic-wrapped links - preserves outer markers
 * - `inline code` and ```code blocks```
 * - >blockquotes (at line start)
 *
 * Per Telegram docs: "Any character with code between 1 and 126 can be escaped
 * anywhere with a preceding '\' character"
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export function smartEscapeMarkdownV2(text: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Check for code blocks first (```...```)
    if (text.slice(i, i + 3) === '```') {
      const endIndex = text.indexOf('```', i + 3);
      if (endIndex !== -1) {
        // Preserve code block, only escape ` and \ inside
        const codeBlock = text.slice(i, endIndex + 3);
        result.push(escapeInsideCodeBlock(codeBlock));
        i = endIndex + 3;
        continue;
      }
    }

    // Check for inline code (`...`)
    if (text[i] === '`') {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex !== -1) {
        // Preserve inline code, only escape ` and \ inside
        const inlineCode = text.slice(i, endIndex + 1);
        result.push(escapeInsideInlineCode(inlineCode));
        i = endIndex + 1;
        continue;
      }
    }

    // Check for formatted links: *[text](url)* or _[text](url)_
    // Must check BEFORE plain links to preserve outer formatting markers
    if (text[i] === '*' || text[i] === '_') {
      const marker = text[i] as string;
      const formattedLink = matchFormattedLink(text, i, marker);
      if (formattedLink) {
        result.push(formattedLink.formatted);
        i = formattedLink.endIndex;
        continue;
      }
    }

    // Check for plain links [text](url)
    if (text[i] === '[') {
      const linkMatch = matchLink(text, i);
      if (linkMatch) {
        result.push(formatLink(linkMatch.text, linkMatch.url));
        i = linkMatch.endIndex;
        continue;
      }
    }

    // Check for formatting markers that should be preserved
    // Bold: *text* (not escaped)
    // Italic: _text_ (not escaped at boundaries)
    // Underline: __text__
    // Strikethrough: ~text~
    // Spoiler: ||text||
    // These are tricky - we preserve the markers but escape content

    // For simplicity, escape special chars that are not part of recognized patterns
    const char = text[i] as string;
    if (isMarkdownV2Special(char)) {
      // Check if this is a formatting marker we should preserve
      if (isFormattingMarker(text, i)) {
        result.push(char);
      } else {
        result.push(`\\${char}`);
      }
    } else {
      result.push(char);
    }
    i++;
  }

  return result.join('');
}

/**
 * Match a formatted link pattern: *[text](url)* or _[text](url)_
 * Returns the formatted result and end index
 */
function matchFormattedLink(
  text: string,
  start: number,
  marker: string
): { formatted: string; endIndex: number } | null {
  // Must start with marker followed by [
  if (text[start] !== marker || text[start + 1] !== '[') {
    return null;
  }

  // Try to match the link starting after the opening marker
  const linkMatch = matchLink(text, start + 1);
  if (!linkMatch) {
    return null;
  }

  // Must have closing marker after the link
  if (text[linkMatch.endIndex] !== marker) {
    return null;
  }

  // Format as marker + link + marker (don't escape the link text for bold links)
  const escapedUrl = linkMatch.url.replace(/([)\\])/g, '\\$1');
  // For formatted links, preserve the link text as-is (it's the title)
  // Only escape truly problematic chars, not formatting markers
  const escapedText = escapeLinkTextForFormattedLink(linkMatch.text);

  return {
    formatted: `${marker}[${escapedText}](${escapedUrl})${marker}`,
    endIndex: linkMatch.endIndex + 1,
  };
}

/**
 * Escape link text for formatted links (*[text](url)*)
 * Less aggressive escaping - preserves readability of titles
 * Only escapes characters that would break the link syntax itself
 */
function escapeLinkTextForFormattedLink(text: string): string {
  // In link text, we only need to escape: [ ] \ and `
  // Other special chars are safe inside [...]
  return text.replace(/([[\\`\]])/g, '\\$1');
}

/**
 * Characters that need escaping in MarkdownV2 plain text
 */
function isMarkdownV2Special(char: string): boolean {
  return '_*[]()~`>#+-=|{}.!\\'.includes(char);
}

/**
 * Check if character at position is a formatting marker to preserve
 */
function isFormattingMarker(text: string, pos: number): boolean {
  const char = text[pos];

  // Bold: *
  if (char === '*') {
    // Check if it's opening or closing bold
    return isBalancedMarker(text, pos, '*');
  }

  // Italic: _ (but not __ which is underline)
  if (char === '_') {
    // __underline__ uses double underscore
    if (text[pos + 1] === '_' || (pos > 0 && text[pos - 1] === '_')) {
      return isBalancedMarker(text, pos, '__');
    }
    return isBalancedMarker(text, pos, '_');
  }

  // Strikethrough: ~
  if (char === '~') {
    return isBalancedMarker(text, pos, '~');
  }

  // Spoiler: ||
  if (char === '|' && text[pos + 1] === '|') {
    return isBalancedMarker(text, pos, '||');
  }

  // Blockquote: > at start of line
  if (char === '>') {
    return pos === 0 || text[pos - 1] === '\n';
  }

  return false;
}

/**
 * Check if marker has a matching closing marker
 */
function isBalancedMarker(text: string, pos: number, marker: string): boolean {
  // Simple heuristic: look for closing marker after some content
  const afterMarker = pos + marker.length;
  const restOfText = text.slice(afterMarker);
  const closingIndex = restOfText.indexOf(marker);

  // Has closing marker with content between
  if (closingIndex > 0) {
    return true;
  }

  // Check if this IS the closing marker (has content before)
  if (pos >= marker.length) {
    const beforeMarker = text.slice(0, pos);
    const openingIndex = beforeMarker.lastIndexOf(marker);
    if (openingIndex !== -1 && openingIndex < pos - marker.length) {
      return true;
    }
  }

  return false;
}

/**
 * Match a markdown link [text](url) starting at position
 */
function matchLink(
  text: string,
  start: number
): { text: string; url: string; endIndex: number } | null {
  if (text[start] !== '[') {
    return null;
  }

  // Find closing ]
  let depth = 1;
  let i = start + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '[') {
      depth++;
    } else if (text[i] === ']') {
      depth--;
    }
    i++;
  }

  if (depth !== 0) {
    return null;
  }
  const textEnd = i - 1;

  // Must be followed by (url)
  if (text[i] !== '(') {
    return null;
  }

  const urlStart = i + 1;
  // Find closing ) - handle nested parens in URL
  depth = 1;
  i = urlStart;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
    }
    i++;
  }

  if (depth !== 0) {
    return null;
  }

  return {
    text: text.slice(start + 1, textEnd),
    url: text.slice(urlStart, i - 1),
    endIndex: i,
  };
}

/**
 * Format a link with proper escaping
 * - Link text: escape special chars
 * - URL: only escape ) and \
 */
function formatLink(linkText: string, url: string): string {
  // Escape special chars in link text (but preserve nested formatting)
  const escapedText = escapeMarkdownV2(linkText);
  // In URL, only ) and \ need escaping
  const escapedUrl = url.replace(/([)\\])/g, '\\$1');
  return `[${escapedText}](${escapedUrl})`;
}

/**
 * Escape inside code block - only ` and \ need escaping
 */
function escapeInsideCodeBlock(codeBlock: string): string {
  // Keep the ``` markers, escape ` and \ inside
  const match = codeBlock.match(/^```([\s\S]*?)```$/);
  if (!match || match[1] === undefined) {
    return codeBlock;
  }

  const content = match[1];
  const escapedContent = content.replace(/([`\\])/g, '\\$1');
  return `\`\`\`${escapedContent}\`\`\``;
}

/**
 * Escape inside inline code - only ` and \ need escaping
 */
function escapeInsideInlineCode(inlineCode: string): string {
  // Keep the ` markers, escape ` and \ inside
  const content = inlineCode.slice(1, -1);
  const escapedContent = content.replace(/([`\\])/g, '\\$1');
  return `\`${escapedContent}\``;
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
 * Format tool chain for display
 * Shows the ordered list of tools called: search, calculator, get_posts
 */
function formatToolChain(toolChain?: string[]): string {
  if (!toolChain || toolChain.length === 0) {
    return '';
  }
  return `🔧 Tools: ${toolChain.join(', ')}`;
}

/**
 * Format routing flow in new format:
 * router-agent (0.4s, 500↓/100↑) → [classification] → target-agent (3.77s, 1.2k↓/0.5k↑)
 *   🔧 Tools: search, calculator
 *
 * New format places classification between router and target agent
 * for clearer flow visualization. Token usage is shown per-step.
 * Tools used by the target agent are shown below the main flow.
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
  let toolsLine = '';
  if (targetStep) {
    targetPart = formatAgentTiming(
      targetStep.agent,
      targetStep.durationMs,
      targetStep.status,
      targetStep.tokenUsage
    );
    // Add tools used by target agent
    toolsLine = formatToolChain(targetStep.toolChain);
  }

  // Combine: router (time, tokens) → [classification] → target (time, tokens)
  const parts = [routerPart];
  if (classificationPart) {
    parts.push(classificationPart);
  }
  if (targetPart) {
    parts.push(targetPart);
  }

  const mainFlow = parts.join(' → ');

  // Add tools line if present
  return toolsLine ? `${mainFlow}\n   ${toolsLine}` : mainFlow;
}

/**
 * Format metadata with model, trace ID, and error info
 *
 * Enhanced to show:
 * - Model name (short form)
 * - Trace ID (truncated for readability)
 * - Error messages
 */
function formatMetadata(
  metadata?: DebugMetadata,
  escapeFn: (text: string) => string = escapeHtml
): string {
  if (!metadata) {
    return '';
  }

  const lines: string[] = [];

  // Add model info on same line if present
  const infoParts: string[] = [];
  if (metadata.model) {
    // Shorten model name for readability
    const shortModel = shortenModelName(metadata.model);
    infoParts.push(`📊 ${shortModel}`);
  }

  if (metadata.traceId) {
    // Show first 8 chars of trace ID
    infoParts.push(`🆔 ${metadata.traceId.slice(0, 8)}`);
  }

  if (metadata.requestId) {
    infoParts.push(`📋 ${metadata.requestId.slice(0, 8)}`);
  }

  if (infoParts.length > 0) {
    lines.push(`\n   ${infoParts.join(' | ')}`);
  }

  // Show error message on separate line if present
  if (metadata.lastToolError) {
    lines.push(`\n⚠️ ${escapeFn(metadata.lastToolError)}`);
  }

  return lines.join('');
}

/**
 * Shorten model name for display
 * Examples:
 * - 'claude-3-5-sonnet-20241022' → 'sonnet-3.5'
 * - 'claude-3-5-haiku-20241022' → 'haiku-3.5'
 * - 'gpt-4o-mini' → 'gpt-4o-mini'
 */
function shortenModelName(model: string): string {
  // Claude models
  if (model.includes('claude')) {
    if (model.includes('opus')) {
      return model.includes('3-5') ? 'opus-3.5' : model.includes('4') ? 'opus-4' : 'opus';
    }
    if (model.includes('sonnet')) {
      return model.includes('3-5') ? 'sonnet-3.5' : model.includes('4') ? 'sonnet-4' : 'sonnet';
    }
    if (model.includes('haiku')) {
      return model.includes('3-5') ? 'haiku-3.5' : 'haiku';
    }
  }
  // GPT models - keep short
  if (model.startsWith('gpt-')) {
    return model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  }
  // Other models - return as-is but truncate if too long
  return model.length > 20 ? `${model.slice(0, 17)}...` : model;
}

/**
 * Format minimal debug footer when full routing flow is unavailable
 *
 * Shows basic info like duration, model, and trace ID.
 * Used as fallback when routingFlow is empty but metadata exists.
 *
 * @example Output:
 * ```
 * 🔍 ⏱️ 2.34s | 📊 sonnet-3.5 | 🆔 abc12345
 * ```
 */
function formatMinimalDebugFooter(debugContext: DebugContext): string | null {
  const parts: string[] = [];

  // Duration
  if (debugContext.totalDurationMs) {
    parts.push(`⏱️ ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`);
  }

  // Model from metadata
  if (debugContext.metadata?.model) {
    const shortModel = shortenModelName(debugContext.metadata.model);
    parts.push(`📊 ${shortModel}`);
  }

  // Trace ID from metadata
  if (debugContext.metadata?.traceId) {
    parts.push(`🆔 ${debugContext.metadata.traceId.slice(0, 8)}`);
  }

  // Token usage from metadata
  if (debugContext.metadata?.tokenUsage) {
    const tokens = formatTokenUsage(debugContext.metadata.tokenUsage);
    if (tokens) {
      parts.push(tokens);
    }
  }

  // If no meaningful info, return null
  if (parts.length === 0) {
    return null;
  }

  // Build minimal footer
  let content = parts.join(' | ');

  // Add error if present
  if (debugContext.metadata?.lastToolError) {
    content += `\n⚠️ ${escapeHtml(debugContext.metadata.lastToolError)}`;
  }

  return `\n\n<blockquote expandable>🔍 ${content}</blockquote>`;
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
 *
 * @example Output (minimal fallback):
 * ```
 * 🔍 ⏱️ 2.34s | 📊 sonnet-3.5 | 🆔 abc12345
 * ```
 */
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext) {
    return null;
  }

  // If no routing flow, try minimal fallback
  if (!debugContext.routingFlow?.length) {
    return formatMinimalDebugFooter(debugContext);
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
 * Format minimal debug footer for MarkdownV2 when routing flow is unavailable
 */
function formatMinimalDebugFooterMarkdownV2(debugContext: DebugContext): string | null {
  const parts: string[] = [];

  // Duration
  if (debugContext.totalDurationMs) {
    parts.push(`⏱️ ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`);
  }

  // Model from metadata
  if (debugContext.metadata?.model) {
    const shortModel = shortenModelName(debugContext.metadata.model);
    parts.push(`📊 ${shortModel}`);
  }

  // Trace ID from metadata
  if (debugContext.metadata?.traceId) {
    parts.push(`🆔 ${debugContext.metadata.traceId.slice(0, 8)}`);
  }

  // Token usage from metadata
  if (debugContext.metadata?.tokenUsage) {
    const tokens = formatTokenUsage(debugContext.metadata.tokenUsage);
    if (tokens) {
      parts.push(tokens);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  // Build minimal footer with escaping
  let content = escapeMarkdownV2(parts.join(' | '));

  if (debugContext.metadata?.lastToolError) {
    content += `\n⚠️ ${escapeMarkdownV2(debugContext.metadata.lastToolError)}`;
  }

  return `\n\n**>🔍 ${content}||`;
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
  if (!debugContext) {
    return null;
  }

  // If no routing flow, try minimal fallback
  if (!debugContext.routingFlow?.length) {
    return formatMinimalDebugFooterMarkdownV2(debugContext);
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
/**
 * Format minimal debug footer for GitHub Markdown when routing flow is unavailable
 */
function formatMinimalDebugFooterMarkdown(debugContext: DebugContext): string | null {
  const parts: string[] = [];

  if (debugContext.totalDurationMs) {
    parts.push(`⏱️ ${(debugContext.totalDurationMs / 1000).toFixed(2)}s`);
  }

  if (debugContext.metadata?.model) {
    const shortModel = shortenModelName(debugContext.metadata.model);
    parts.push(`📊 ${shortModel}`);
  }

  if (debugContext.metadata?.traceId) {
    parts.push(`🆔 ${debugContext.metadata.traceId.slice(0, 8)}`);
  }

  if (debugContext.metadata?.tokenUsage) {
    const tokens = formatTokenUsage(debugContext.metadata.tokenUsage);
    if (tokens) {
      parts.push(tokens);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  let content = parts.join(' | ');
  if (debugContext.metadata?.lastToolError) {
    content += `\n⚠️ ${debugContext.metadata.lastToolError}`;
  }

  return `

<details>
<summary>🔍 Debug Info</summary>

\`\`\`
${content}
\`\`\`

</details>`;
}

export function formatDebugFooterMarkdown(debugContext?: DebugContext): string | null {
  if (!debugContext) {
    return null;
  }

  // If no routing flow, try minimal fallback
  if (!debugContext.routingFlow?.length) {
    return formatMinimalDebugFooterMarkdown(debugContext);
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
