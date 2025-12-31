/**
 * Workflow Progress Formatting
 *
 * Renders live progress display for tool executions in Claude Code style.
 * Uses shared utilities from @duyetbot/progress.
 */

import {
  formatDuration,
  formatToolArgs,
  formatToolResult,
  getRandomMessage as getRandomThinkingMessage,
} from '@duyetbot/progress';

import { formatClaudeCodeThinking } from '../format.js';
import type { WorkflowProgressEntry } from './types.js';

// Re-export from @duyetbot/progress for backward compatibility
// Legacy alias for backward compatibility
export {
  formatCompactNumber,
  formatCost,
  formatCost as formatCostUsd,
  formatDuration,
  formatToolArgs,
  formatToolResult,
  formatToolResult as formatToolResponse,
  shortenModelName,
} from '@duyetbot/progress';

/**
 * Format thinking message for workflow progress
 * Supports both no arguments and single string argument
 */
function formatThinkingMessage(text?: string): string {
  if (text) {
    return `* 🤔 ${text}`;
  }
  return `* ${getRandomThinkingMessage()}`;
}

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
          const resultPreview = formatToolResult(entry.toolResult, 1);
          lines[runningIdx] = `  ⎿ 🔍 ${resultPreview}`;
        } else {
          lines[runningIdx] = `  ⎿ ✅ (${durationStr})`;
        }
      } else {
        // Fallback: add completion line
        const argStr = formatToolArgs(entry.toolArgs);
        lines.push(`⏺ ${entry.toolName}(${argStr})`);
        if (entry.toolResult) {
          const resultPreview = formatToolResult(entry.toolResult, 1);
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
    if (!tool) {
      return;
    }

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
