import { formatClaudeCodeThinking, formatThinkingMessage } from '../agentic-loop/progress.js';
import type { WorkflowProgressEntry } from './types.js';

/**
 * Format workflow progress in Claude Code style
 *
 * Shows accumulated thinking/tool chain during execution:
 * ```
 * * Germinating… (↓ 500 tokens)
 *
 * ⏺ I'll search for information about...
 *
 * ⏺ research(query: "OpenAI skills")
 *   ⎿ Running…
 * ```
 *
 * Then when tool completes:
 * ```
 * ⏺ I'll search for information about...
 *
 * ⏺ research(query: "OpenAI skills")
 *   ⎿ Found 5 results...
 *
 * * Synthesizing…
 * ```
 */
export function formatWorkflowProgress(
  history: WorkflowProgressEntry[],
  tokenCount?: number
): string {
  if (history.length === 0) {
    return formatClaudeCodeThinking(tokenCount);
  }

  const lines: string[] = [];

  // Track parallel tools for group display
  let parallelToolsGroup: string | null = null;

  // Process history sequentially
  for (const entry of history) {
    if (entry.type === 'thinking') {
      parallelToolsGroup = null; // Reset parallel group
      // Extract thinking message without emoji prefix
      let thinkingText = entry.message.replace(/^🤔\s*/, '').trim();

      // Remove step suffix like "(step 3/100)"
      thinkingText = thinkingText.replace(/\s*\(step\s+\d+\/\d+\)\s*$/i, '').trim();

      // Use centralized formatThinkingMessage for consistent formatting:
      // - Empty or generic messages get random rotator (Pondering..., Ruminating..., etc.)
      // - Actual LLM content is displayed with cleanup (e.g., "Let me search...")
      if (/^(thinking|processing|pondering)\.{0,3}$/i.test(thinkingText) || !thinkingText) {
        lines.push(formatThinkingMessage());
      } else {
        lines.push(formatThinkingMessage(thinkingText));
      }
    } else if (entry.type === 'parallel_tools_start' && entry.parallelTools) {
      parallelToolsGroup = formatParallelTools(entry.parallelTools);
      lines.push(parallelToolsGroup);
    } else if (entry.type === 'parallel_tool_complete' && entry.parallelTools) {
      // Update the parallel tools group display
      parallelToolsGroup = formatParallelTools(entry.parallelTools);
      // Find the last parallel tools display and replace it
      const parallelIdx = findLastIndex(
        lines,
        (l: string) => l.includes('Running') && l.includes('tools in parallel')
      );
      if (parallelIdx >= 0) {
        // Replace from this line onwards
        lines.splice(parallelIdx);
        lines.push(parallelToolsGroup);
      } else {
        lines.push(parallelToolsGroup);
      }
    } else if (entry.type === 'tool_start' && entry.toolName) {
      parallelToolsGroup = null; // Reset parallel group
      // Tool starting - show tool name with truncated arguments
      const argStr = formatToolArgs(entry.toolArgs);
      lines.push(`⏺ ${entry.toolName}(${argStr})`);
      lines.push('  ⎿ Running…');
    } else if (entry.type === 'tool_complete' && entry.toolName) {
      parallelToolsGroup = null; // Reset parallel group
      // Tool completed - find and update the "Running…" line
      const runningIdx = findLastIndex(lines, (l: string) => l.includes('⎿ Running'));
      const durationStr = formatDuration(entry.durationMs ?? 0);

      if (runningIdx >= 0) {
        // Replace "Running..." with completion + result preview
        if (entry.toolResult) {
          const resultPreview = formatToolResponse(entry.toolResult, 1);
          lines[runningIdx] = `  ⎿ 🔍 ${resultPreview}`;
        } else {
          lines[runningIdx] = `  ⎿ ✅ (${durationStr})`;
        }
      } else {
        // Fallback: add completion line
        const argStr = formatToolArgs(entry.toolArgs);
        lines.push(`⏺ ${entry.toolName}(${argStr})`);
        if (entry.toolResult) {
          const resultPreview = formatToolResponse(entry.toolResult, 1);
          lines.push(`  ⎿ 🔍 ${resultPreview}`);
        } else {
          lines.push(`  ⎿ ✅ (${durationStr})`);
        }
      }
    } else if (entry.type === 'tool_error' && entry.toolName) {
      parallelToolsGroup = null; // Reset parallel group
      // Tool failed - find and update the "Running…" line
      const runningIdx = findLastIndex(lines, (l: string) => l.includes('⎿ Running'));
      const durationStr = entry.durationMs ? ` (${formatDuration(entry.durationMs)})` : '';
      const errorText = entry.toolResult ? entry.toolResult.slice(0, 60) : 'Error';

      if (runningIdx >= 0) {
        lines[runningIdx] = `  ⎿ ❌ ${errorText}${durationStr}`;
      } else {
        const argStr = formatToolArgs(entry.toolArgs);
        lines.push(`⏺ ${entry.toolName}(${argStr})`);
        lines.push(`  ⎿ ❌ ${errorText}${durationStr}`);
      }
    } else if (entry.type === 'responding') {
      parallelToolsGroup = null; // Reset parallel group
      lines.push('⏺ Generating response...');
    }
  }

  // Keep last 12 lines to show more context
  const maxLines = 12;
  if (lines.length > maxLines) {
    const truncated = lines.slice(-maxLines);
    return `...\n${truncated.join('\n')}`;
  }

  return lines.join('\n');
}

/**
 * Format parallel tools display with tree structure
 * Shows tool names with arguments and results
 */
export function formatParallelTools(
  tools: Array<{
    id: string;
    name: string;
    argsStr: string;
    result?: { status: string; summary: string; durationMs?: number };
  }>
): string {
  if (tools.length === 0) {
    return '';
  }

  const lines: string[] = [`⏺ Running ${tools.length} tools in parallel...`];

  // Enumerate tools with proper type safety
  tools.forEach((tool, i) => {
    if (!tool) return;

    const isLast = i === tools.length - 1;
    const prefix = isLast ? '└─' : '├─';
    const connector = isLast ? '   ' : '│  ';

    // Tool name and args
    const toolLine = `   ${prefix} ${tool.name}(${tool.argsStr})`;
    lines.push(toolLine);

    // Tool result or running state
    if (tool.result) {
      const statusIcon = tool.result.status === 'completed' ? '✅' : '❌';
      const durationStr = tool.result.durationMs
        ? ` (${formatDuration(tool.result.durationMs)})`
        : '';
      const resultLine = `   ${connector}⎿ ${statusIcon} ${tool.result.summary}${durationStr}`;
      lines.push(resultLine);
    } else {
      const resultLine = `   ${connector}⎿ Running…`;
      lines.push(resultLine);
    }
  });

  return lines.join('\n');
}

/**
 * Find the last index in array matching predicate (ES2023 polyfill)
 */
export function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const item = arr[i];
    if (item !== undefined && predicate(item)) {
      return i;
    }
  }
  return -1;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const mins = Math.floor(ms / 60000);
    const secs = Math.round((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
  }
}

/**
 * Format number in compact notation with k suffix
 * Examples: 500 → "500", 1200 → "1.2k", 15000 → "15k"
 */
export function formatCompactNumber(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    // Use 1 decimal for values < 10k, no decimal for larger
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(n);
}

/**
 * Format cost in USD for display
 * Examples: 0.00048 → "$0.0005", 0.0123 → "$0.012"
 */
export function formatCostUsd(cost: number): string {
  if (cost === 0) {
    return '$0';
  }
  if (cost < 0.0001) {
    return '<$0.0001';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(3)}`;
}

/**
 * Shorten model name for display
 * Examples:
 * - 'x-ai/grok-4.1-fast' → 'grok-4.1'
 * - 'anthropic/claude-3-5-sonnet-20241022' → 'sonnet-3.5'
 * - '@preset/duyetbot' → 'duyetbot'
 */
export function shortenModelName(model: string): string {
  // Remove @preset/ prefix
  if (model.startsWith('@preset/')) {
    return model.replace('@preset/', '');
  }

  // Remove provider prefix (x-ai/, anthropic/, openai/, etc.)
  const parts = model.split('/');
  const name = parts[parts.length - 1] || model;

  // Claude models: extract variant name
  if (name.includes('claude')) {
    const withoutDate = name.replace(/-\d{8}$/, '');
    if (withoutDate.includes('opus')) {
      return withoutDate.includes('3-5')
        ? 'opus-3.5'
        : withoutDate.includes('3.5')
          ? 'opus-3.5'
          : 'opus';
    }
    if (withoutDate.includes('sonnet')) {
      return withoutDate.includes('3-5')
        ? 'sonnet-3.5'
        : withoutDate.includes('3.5')
          ? 'sonnet-3.5'
          : 'sonnet';
    }
    if (withoutDate.includes('haiku')) {
      return withoutDate.includes('3-5')
        ? 'haiku-3.5'
        : withoutDate.includes('3.5')
          ? 'haiku-3.5'
          : 'haiku';
    }
  }

  // GPT models: remove date suffix
  if (name.startsWith('gpt-')) {
    return name.replace(/-\d{4}-\d{2}-\d{2}$/, '');
  }

  // Grok models: remove -fast suffix, keep version
  if (name.startsWith('grok-')) {
    return name.replace(/-fast$/, '');
  }

  // Default: remove date suffix and truncate if too long
  const cleaned = name.replace(/-\d{8}$/, '');
  return cleaned.length > 15 ? `${cleaned.slice(0, 12)}...` : cleaned;
}

/**
 * Format tool arguments for display
 * Shows the most relevant argument (query, url, prompt, etc.)
 */
export function formatToolArgs(args?: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) return '';

  // Priority order for displaying args
  const priorityKeys = ['query', 'url', 'prompt', 'search', 'question', 'input', 'text', 'key'];
  for (const key of priorityKeys) {
    if (args[key] !== undefined) {
      const value = String(args[key]).slice(0, 40);
      const ellipsis = String(args[key]).length > 40 ? '...' : '';
      return `${key}: "${value}${ellipsis}"`;
    }
  }

  // Fallback: show first arg
  const firstKey = Object.keys(args)[0];
  if (firstKey) {
    const value = String(args[firstKey]).slice(0, 40);
    const ellipsis = String(args[firstKey]).length > 40 ? '...' : '';
    return `${firstKey}: "${value}${ellipsis}"`;
  }

  return '';
}

/**
 * Format tool response for display, truncated to max lines
 */
export function formatToolResponse(output: string, maxLines: number): string {
  // Remove excessive whitespace and split into lines
  const lines = output
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .split('\n')
    .slice(0, maxLines);

  // Join and truncate total length
  const joined = lines.join(' | ').slice(0, 150);
  const ellipsis = output.length > 150 || output.split('\n').length > maxLines ? '...' : '';
  return `${joined}${ellipsis}`;
}
