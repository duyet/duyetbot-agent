/**
 * Progress formatting utilities for tool execution updates
 */

/**
 * Tool execution status
 */
export type ToolStatus = 'pending' | 'running' | 'complete' | 'error';

/**
 * Tool execution state for progress tracking
 */
export interface ToolExecution {
  /** Tool name (without server prefix) */
  name: string;
  /** Current status */
  status: ToolStatus;
  /** Result or error message */
  result?: string;
  /** Timestamp when started */
  startedAt?: number;
  /** Timestamp when completed */
  completedAt?: number;
}

/**
 * Progress formatting configuration
 */
export interface ProgressConfig {
  /** Maximum characters for result preview */
  maxResultPreview?: number;
  /** Show timestamps */
  showTimestamps?: boolean;
  /** Show result previews */
  showResults?: boolean;
  /** Format style: 'markdown' | 'plain' */
  format?: 'markdown' | 'plain';
}

const DEFAULT_CONFIG: Required<ProgressConfig> = {
  maxResultPreview: 300,
  showTimestamps: false,
  showResults: true,
  format: 'markdown',
};

/**
 * Get status icon for tool execution
 */
function getStatusIcon(status: ToolStatus): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'running':
      return '🔄';
    case 'complete':
      return '✅';
    case 'error':
      return '❌';
  }
}

/**
 * Clean tool name by removing server prefix
 * e.g., "memory__save_memory" → "save_memory"
 */
export function cleanToolName(name: string): string {
  const parts = name.split('__');
  return parts.length > 1 ? parts.slice(1).join('__') : name;
}

/**
 * Truncate text to max length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Format tool executions as progress message
 *
 * @param executions - Array of tool executions to display
 * @param config - Formatting configuration
 * @returns Formatted progress message
 *
 * @example
 * ```typescript
 * const progress = formatToolProgress([
 *   { name: 'bash', status: 'complete', result: 'npm test output...' },
 *   { name: 'read', status: 'running' },
 * ]);
 * // Returns:
 * // ✅ **bash**
 * // ```
 * // npm test output...
 * // ```
 * // 🔄 **read**
 * ```
 */
export function formatToolProgress(
  executions: ToolExecution[],
  config: ProgressConfig = {}
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const lines: string[] = [];

  for (const exec of executions) {
    const icon = getStatusIcon(exec.status);
    const name = cleanToolName(exec.name);

    if (cfg.format === 'markdown') {
      lines.push(`${icon} **${name}**`);
    } else {
      lines.push(`${icon} ${name}`);
    }

    // Show result preview for completed tools
    if (cfg.showResults && exec.result && (exec.status === 'complete' || exec.status === 'error')) {
      const preview = truncate(exec.result.trim(), cfg.maxResultPreview);
      if (preview) {
        if (cfg.format === 'markdown') {
          lines.push(`\`\`\`\n${preview}\n\`\`\``);
        } else {
          lines.push(preview);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format complete response with tool execution history
 *
 * @param executions - Array of completed tool executions
 * @param finalContent - Final response content
 * @param config - Formatting configuration
 * @returns Formatted message with progress and final response
 */
export function formatCompleteResponse(
  executions: ToolExecution[],
  finalContent: string,
  config: ProgressConfig = {}
): string {
  if (executions.length === 0) {
    return finalContent;
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };
  const progressSection = formatToolProgress(executions, {
    ...cfg,
    showResults: false, // Don't show results in final, just status
  });

  if (cfg.format === 'markdown') {
    return `${progressSection}\n\n---\n\n${finalContent}`;
  }

  return `${progressSection}\n\n${finalContent}`;
}

/**
 * Fun thinking messages inspired by Claude Code
 * These rotate to show the bot is still working
 */
const THINKING_MESSAGES = [
  'Thinking...',
  'Pondering...',
  'Cogitating...',
  'Ruminating...',
  'Contemplating...',
  'Processing...',
  'Analyzing...',
  'Computing...',
  'Deliberating...',
  'Musing...',
  'Brainstorming...',
  'Synthesizing...',
  'Evaluating...',
  'Reasoning...',
  'Deducing...',
  'Flambéing...',
  'Marinating...',
  'Percolating...',
  'Simmering...',
  'Brewing...',
];

/**
 * Extended thinking messages for longer operations
 */
const EXTENDED_THINKING_MESSAGES = [
  'Still thinking...',
  'Deep in thought...',
  'Almost there...',
  'Working on it...',
  'Bear with me...',
  'Complex task...',
  'Crunching numbers...',
  'Consulting the oracle...',
  'Channeling wisdom...',
  'Brewing ideas...',
  'Summoning insights...',
  'Weaving thoughts...',
  'Distilling knowledge...',
  'Forging connections...',
  'Unraveling mysteries...',
];

/**
 * Get a random thinking message
 * @param extended - Use extended messages for longer waits
 */
export function getRandomThinkingMessage(extended = false): string {
  const messages = extended ? EXTENDED_THINKING_MESSAGES : THINKING_MESSAGES;
  const index = Math.floor(Math.random() * messages.length);
  return messages[index] ?? 'Thinking...';
}

/**
 * Format initial thinking message
 * @param format - Output format
 * @param extended - Use extended messages for longer waits
 */
export function formatThinkingMessage(
  format: 'markdown' | 'plain' = 'markdown',
  extended = false
): string {
  const message = getRandomThinkingMessage(extended);
  if (format === 'markdown') {
    return `🔄 *${message}*`;
  }
  return `🔄 ${message}`;
}

/**
 * Format error message
 */
export function formatErrorMessage(
  error: string,
  format: 'markdown' | 'plain' = 'markdown'
): string {
  if (format === 'markdown') {
    return `❌ **Error**: ${error}`;
  }
  return `❌ Error: ${error}`;
}
