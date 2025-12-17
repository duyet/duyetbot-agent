/**
 * Debug Footer Formatter
 *
 * Shared implementation for formatting debug context as a collapsible footer
 * for admin users. Used by both direct responses and fire-and-forget paths.
 *
 * Format:
 * - Simple: [debug] router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * - Orchestrator:
 *   [debug] router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *      ├─ research-worker (2.5s)
 *      └─ code-worker (1.2s)
 * - Progressive: Shows (running) for active agents/workers
 *
 * Note: Uses text-based labels instead of emojis for Telegram compatibility.
 */

import { formatToolArgs, formatToolResult, shortenModelName } from '@duyetbot/progress';

import type {
  Citation,
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
 * Format token usage as compact string with icons
 * Examples: "↓5k ↑400", "↓5k ↑400 ⚡2k 🧠1k"
 *
 * Icons for visual scanning:
 * - ↓ = input tokens (prompt)
 * - ↑ = output tokens (completion)
 * - ⚡ = cached tokens (prompt cache hits)
 * - 🧠 = reasoning tokens (o1/o3 internal reasoning)
 */
function formatTokenUsage(usage?: TokenUsage): string {
  if (!usage || usage.totalTokens === 0) {
    return '';
  }

  const parts: string[] = [];

  // Input/output tokens
  parts.push(`↓${formatNumber(usage.inputTokens)}`);
  parts.push(`↑${formatNumber(usage.outputTokens)}`);

  // Cache hits
  if (usage.cachedTokens && usage.cachedTokens > 0) {
    parts.push(`⚡${formatNumber(usage.cachedTokens)}`);
  }

  // Reasoning tokens (for o1/o3 models)
  if (usage.reasoningTokens && usage.reasoningTokens > 0) {
    parts.push(`🧠${formatNumber(usage.reasoningTokens)}`);
  }

  return parts.join(' ');
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
  return `[tools: ${toolChain.join(', ')}]`;
}

/**
 * Truncate URL to domain + short path for compact display
 * Example: "https://www.example.com/very/long/path" -> "example.com/..."
 */
function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove www. prefix and get domain
    const domain = parsed.hostname.replace(/^www\./, '');
    // If path is longer than just /, show truncated indicator
    if (parsed.pathname && parsed.pathname !== '/') {
      return `${domain}/...`;
    }
    return domain;
  } catch {
    // Fallback for malformed URLs
    return url.length > 20 ? `${url.slice(0, 17)}...` : url;
  }
}

/**
 * Truncate title for compact display
 */
function truncateTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength - 3)}...`;
}

/**
 * Format web search citations for display
 * Shows up to 3 URLs with truncated titles, with "+N more" indicator
 *
 * Example output:
 * - [web: Breaking News... (bbc.com), Latest Update... (cnn.com) +2]
 * - [web: enabled, no results]
 */
function formatWebSearch(
  metadata?: DebugMetadata,
  escapeFn: (text: string) => string = escapeHtml
): string {
  if (!metadata?.webSearchEnabled) {
    return '';
  }

  const citations: Citation[] = (metadata.citations as Citation[]) || [];
  if (citations.length === 0) {
    return '\n   [web: enabled, no results]';
  }

  // Show up to 3 URLs with truncated titles
  const maxDisplay = 3;
  const urlList = citations
    .slice(0, maxDisplay)
    .map((c) => `${escapeFn(truncateTitle(c.title, 20))} (${escapeFn(truncateUrl(c.url))})`)
    .join(', ');

  const moreCount = citations.length > maxDisplay ? ` +${citations.length - maxDisplay}` : '';
  return `\n   [web: ${urlList}${moreCount}]`;
}

/**
 * Format routing flow in new format:
 * router-agent (0.4s, 500↓/100↑) → [classification] → target-agent (3.77s, 1.2k↓/0.5k↑)
 *   [tools: search, calculator]
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
 * Format execution steps as a simple mobile-friendly list
 * Shows thinking text, tool calls, and results with emoji indicators
 *
 * Design: Compact format without box-drawing chars (breaks on mobile Telegram)
 *
 * @example Output:
 * ```
 * 💭 Let me search for information...
 * 🔧 web_search(query: "OpenAI skills")
 *  ↳ ✓ Found 5 results: OpenAI announces new...
 * 💭 Based on my research...
 * ```
 */
function formatExecutionChain(steps: DebugContext['steps']): string {
  if (!steps?.length) {
    return '';
  }

  const lines: string[] = [];

  for (const step of steps) {
    if (step.type === 'thinking' && step.thinking) {
      // Show thinking text with ⏺ prefix (matches progress display)
      const text = step.thinking.replace(/\n/g, ' ').trim();
      const truncated = text.slice(0, 80).trimEnd();
      const ellipsis = text.length > 80 ? '...' : '';
      lines.push(`⏺ ${truncated}${ellipsis}`);
    } else if (step.type === 'tool_start') {
      // Tool starting - show name and args with ⏺ prefix
      const argStr = formatToolArgs(step.args);
      lines.push(`⏺ ${step.toolName}(${argStr})`);
      lines.push(`  ⎿ Running…`);
    } else if (step.type === 'tool_complete' || step.type === 'tool_execution') {
      // Tool completed - show name, args, and result
      const argStr = formatToolArgs(step.args);
      lines.push(`⏺ ${step.toolName}(${argStr})`);

      // Show tool response if available with ⎿ indicator
      const result = step.result;
      if (result) {
        if (typeof result === 'object' && result !== null) {
          if (result.output) {
            const responseLines = formatToolResult(result.output, 3);
            lines.push(`  ⎿ ${responseLines}`);
          } else if (result.error) {
            const errorText = result.error;
            const truncated = errorText.length > 50 ? `${errorText.slice(0, 50)}...` : errorText;
            lines.push(`  ⎿ ❌ ${truncated}`);
          }
        } else if (typeof result === 'string') {
          const responseLines = formatToolResult(result, 3);
          lines.push(`  ⎿ ${responseLines}`);
        }
      }
    } else if (step.type === 'tool_error') {
      // Tool error - show name, args, and error
      const argStr = formatToolArgs(step.args);
      lines.push(`⏺ ${step.toolName}(${argStr})`);
      const errorText = step.error;
      const truncated = errorText.length > 50 ? `${errorText.slice(0, 50)}...` : errorText;
      lines.push(`  ⎿ ❌ ${truncated}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format minimal debug footer when full routing flow is unavailable
 *
 * Shows basic info using the stats card format.
 * Used as fallback when routingFlow is empty but metadata exists.
 *
 * @example Output:
 * ```
 * [debug] ⚡ 2.34s • 📊 ↓5k ↑400 • 🤖 sonnet-3.5 • 🔗 abc12345
 * ```
 */
function formatMinimalDebugFooter(debugContext: DebugContext): string | null {
  const statsCard = formatStatsCard(debugContext);

  // If no meaningful info, return null
  if (!statsCard) {
    return null;
  }

  // Add error if present
  let content = statsCard;
  if (debugContext.metadata?.lastToolError) {
    content += `\n[!] ${escapeHtml(debugContext.metadata.lastToolError)}`;
  }

  return `\n\n<blockquote expandable>[debug] ${content}</blockquote>`;
}

/**
 * Format cost as compact string
 * Examples: "$0.001", "$0.05", "<$0.0001"
 */
function formatCost(costUsd?: number): string {
  if (!costUsd || costUsd === 0) {
    return '';
  }
  if (costUsd < 0.0001) {
    return '<$0.0001';
  }
  if (costUsd < 0.01) {
    return `$${costUsd.toFixed(4)}`;
  }
  if (costUsd < 1) {
    return `$${costUsd.toFixed(3)}`;
  }
  return `$${costUsd.toFixed(2)}`;
}

/**
 * Format stats card as a compact visual summary line
 *
 * @example Output:
 * ```
 * ⚡ 2.34s • 📊 ↓5k ↑400 ⚡2k • 💰 $0.003 • 🤖 sonnet-3.5
 * ```
 */
function formatStatsCard(debugContext: DebugContext): string {
  const parts: string[] = [];

  // Duration with lightning bolt
  if (debugContext.totalDurationMs) {
    parts.push(`⚡ ${formatDuration(debugContext.totalDurationMs)}`);
  }

  // Token usage with chart icon
  if (debugContext.metadata?.tokenUsage) {
    const tokens = formatTokenUsage(debugContext.metadata.tokenUsage);
    if (tokens) {
      parts.push(`📊 ${tokens}`);
    }

    // Cost with money bag icon - prefer actual cost from API, fall back to estimated
    const cost = formatCost(
      debugContext.metadata.tokenUsage.actualCostUsd ??
        debugContext.metadata.tokenUsage.estimatedCostUsd
    );
    if (cost) {
      parts.push(`💰 ${cost}`);
    }
  }

  // Model with robot icon
  if (debugContext.metadata?.model) {
    const shortModel = shortenModelName(debugContext.metadata.model);
    parts.push(`🤖 ${shortModel}`);
  }

  // Trace ID (compact)
  if (debugContext.metadata?.traceId) {
    parts.push(`🔗 ${debugContext.metadata.traceId.slice(0, 8)}`);
  }

  return parts.join(' • ');
}

/**
 * Format debug context as expandable blockquote footer
 *
 * Two-part design:
 * 1. Raw tool chain trace (detailed tree structure for debugging)
 * 2. Stats card (compact visual summary for quick glance)
 *
 * @example Output (simple agent without tools):
 * ```
 * [debug] router-agent (0.4s) → [simple/general/low] → simple-agent (3.77s)
 * ⚡ 0.45s • 📊 ↓5k ↑400 • 🤖 sonnet-3.5
 * ```
 *
 * @example Output (orchestrator with workers):
 * ```
 * [debug] router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * ⚡ 5.20s • 📊 ↓10k ↑1.5k ⚡3k • 🤖 sonnet-3.5
 * ```
 *
 * @example Output (with execution steps - two-part footer):
 * ```
 * [debug]
 * ┌─ Tool Chain ──────────────────────
 * │ 💭 Let me search for information...
 * │ 🔧 web_search(query: "OpenAI skills")
 * │   └─ ✓ Found 5 results: OpenAI announces new...
 * │ 💭 Based on my research...
 * └───────────────────────────────────
 * ⚡ 7.60s • 📊 ↓5k ↑400 • 🤖 sonnet-3.5
 * ```
 *
 * @example Output (minimal fallback):
 * ```
 * [debug] ⚡ 2.34s • 📊 ↓5k ↑400 • 🤖 sonnet-3.5 • 🔗 abc12345
 * ```
 */
export function formatDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext) {
    return null;
  }

  // If execution steps are available, use two-part format: tool chain + stats card
  if (debugContext.steps && debugContext.steps.length > 0) {
    const chain = formatExecutionChain(debugContext.steps);
    const statsCard = formatStatsCard(debugContext);

    // Two-part layout: tool chain trace on top, stats card below
    const content = chain + (statsCard ? `\n${statsCard}` : '');

    return `\n\n<blockquote expandable>[debug]\n${content}</blockquote>`;
  }

  // If no routing flow, try minimal fallback (just stats card)
  if (!debugContext.routingFlow?.length) {
    return formatMinimalDebugFooter(debugContext);
  }

  // Routing flow format with stats card
  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkers(debugContext.workers);
  const webSearch = formatWebSearch(debugContext.metadata);
  const statsCard = formatStatsCard(debugContext);

  // Add stats card after routing flow if we have any stats
  const statsLine = statsCard ? `\n${statsCard}` : '';

  // Include error if present (using old metadata format for backwards compatibility)
  const errorLine = debugContext.metadata?.lastToolError
    ? `\n[!] ${escapeHtml(debugContext.metadata.lastToolError)}`
    : '';

  return `\n\n<blockquote expandable>[debug] ${flow}${workers}${webSearch}${statsLine}${errorLine}</blockquote>`;
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
 * Format stats card for MarkdownV2 with proper escaping
 */
function formatStatsCardMarkdownV2(debugContext: DebugContext): string {
  const statsCard = formatStatsCard(debugContext);
  // Escape the stats card for MarkdownV2 (dots, dashes need escaping)
  return escapeMarkdownV2(statsCard);
}

/**
 * Format minimal debug footer for MarkdownV2 when routing flow is unavailable
 */
function formatMinimalDebugFooterMarkdownV2(debugContext: DebugContext): string | null {
  const statsCard = formatStatsCardMarkdownV2(debugContext);

  if (!statsCard) {
    return null;
  }

  let content = statsCard;
  if (debugContext.metadata?.lastToolError) {
    content += `\n[!] ${escapeMarkdownV2(debugContext.metadata.lastToolError)}`;
  }

  return `\n\n**>[debug] ${content}||`;
}

/**
 * Format debug context as expandable quote for MarkdownV2
 *
 * Uses MarkdownV2 expandable blockquote syntax: **>content||
 * Two-part design: routing flow + stats card
 *
 * @example Output (simple agent):
 * ```
 * **>[debug] router\-agent \(0\.4s\) \-> \[simple/general/low\] \-> simple\-agent \(3\.77s\)
 * ⚡ 0\.45s • 📊 ↓5k ↑400 • 🤖 sonnet\-3\.5||
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
  const webSearch = formatWebSearch(debugContext.metadata, escapeMarkdownV2);
  const statsCard = formatStatsCardMarkdownV2(debugContext);

  // Escape the flow for MarkdownV2
  const escapedFlow = escapeMarkdownV2(flow);

  // Add stats card after routing flow if we have any stats
  const statsLine = statsCard ? `\n${statsCard}` : '';

  // Include error if present
  const errorLine = debugContext.metadata?.lastToolError
    ? `\n[!] ${escapeMarkdownV2(debugContext.metadata.lastToolError)}`
    : '';

  // MarkdownV2 expandable blockquote: **>content||
  return `\n\n**>[debug] ${escapedFlow}${workers}${webSearch}${statsLine}${errorLine}||`;
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
 * [debug] router-agent (0.4s) → [complex/research/low] → orchestrator-agent (running)
 *    ├─ research-worker (running)
 * ```
 */
export function formatProgressiveDebugFooter(debugContext?: DebugContext): string | null {
  if (!debugContext?.routingFlow?.length) {
    return null;
  }

  const flow = formatRoutingFlow(debugContext);
  const workers = formatWorkers(debugContext.workers);

  return `[debug] ${flow}${workers}`;
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
 * <summary>[debug] Info</summary>
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
 * <summary>[debug] Info</summary>
 *
 * ```
 * router-agent (0.4s) → [complex/research/low] → orchestrator-agent (5.2s)
 *    ├─ research-worker (2.5s)
 *    └─ code-worker (1.2s)
 * [!] Tool timeout: external_api
 * ```
 *
 * </details>
 * ```
 */
/**
 * Format minimal debug footer for GitHub Markdown when routing flow is unavailable
 */
function formatMinimalDebugFooterMarkdown(debugContext: DebugContext): string | null {
  const statsCard = formatStatsCard(debugContext);

  if (!statsCard) {
    return null;
  }

  let content = statsCard;
  if (debugContext.metadata?.lastToolError) {
    content += `\n[!] ${debugContext.metadata.lastToolError}`;
  }

  return `

<details>
<summary>[debug] Info</summary>

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
  const webSearch = formatWebSearch(debugContext.metadata, (s) => s);
  const statsCard = formatStatsCard(debugContext);

  // Build content lines: flow, workers, web search, then stats card
  let content = `[debug] ${flow}${workers}${webSearch}`;

  // Add stats card on a separate line
  if (statsCard) {
    content += `\n${statsCard}`;
  }

  // Add error if present
  if (debugContext.metadata?.lastToolError) {
    content += `\n[!] ${debugContext.metadata.lastToolError}`;
  }

  // GitHub-flavored Markdown with collapsible details and code block
  return `

<details>
<summary>[debug] Info</summary>

\`\`\`
${content}
\`\`\`

</details>`;
}
