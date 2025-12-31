/**
 * Progress formatting utilities for tool execution updates
 */

import type { LLMMessage, Message } from './types.js';

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

// =============================================================================
// Thinking Messages - Re-exported from @duyetbot/progress
// =============================================================================

import {
  createRotator,
  EXTENDED_MESSAGES,
  getRandomMessage,
  THINKING_MESSAGES,
  type ThinkingRotator,
  type ThinkingRotatorConfig,
} from '@duyetbot/progress';

// Re-export types and functions for backward compatibility
export { EXTENDED_MESSAGES, THINKING_MESSAGES };
export type { ThinkingRotator, ThinkingRotatorConfig };

/**
 * Get a random thinking message
 * @param extended - Use extended messages for longer waits
 * @deprecated Use getRandomMessage from @duyetbot/progress instead
 */
export function getRandomThinkingMessage(extended = false): string {
  return getRandomMessage(extended);
}

/**
 * Create a thinking message rotator
 * @deprecated Use createRotator from @duyetbot/progress instead
 */
export function createThinkingRotator(config: ThinkingRotatorConfig = {}): ThinkingRotator {
  return createRotator(config);
}

/**
 * Get default thinking messages array
 * @deprecated Use THINKING_MESSAGES from @duyetbot/progress instead
 */
export function getDefaultThinkingMessages(): string[] {
  return [...THINKING_MESSAGES];
}

/**
 * Get extended thinking messages array
 * @deprecated Use EXTENDED_MESSAGES from @duyetbot/progress instead
 */
export function getExtendedThinkingMessages(): string[] {
  return [...EXTENDED_MESSAGES];
}

/** @deprecated Use THINKING_MESSAGES from @duyetbot/progress instead */
export const THINKING_ROTATOR_MESSAGES = THINKING_MESSAGES;

// =============================================================================
// Format Utilities
// =============================================================================

/**
 * Format initial thinking message
 * @param format - Output format
 * @param extended - Use extended messages for longer waits
 */
export function formatThinkingMessage(
  format: 'markdown' | 'plain' = 'markdown',
  extended = false
): string {
  const message = getRandomMessage(extended);
  if (format === 'markdown') {
    return `🔄 *${message}*`;
  }
  return `🔄 ${message}`;
}

/**
 * Format Claude Code thinking message
 * Used for workflow progress display
 * @param tokenCount - Optional token usage to display
 */
export function formatClaudeCodeThinking(tokenCount?: number): string {
  const message = getRandomMessage();
  const tokenInfo = tokenCount ? ` (↓ ${tokenCount} tokens)` : '';
  return `* ${message}${tokenInfo}`;
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

/**
 * Format conversation history as XML for embedding in user message
 *
 * Instead of passing history in the messages[] array, this embeds it
 * directly in the user message using XML tags for AI Gateway compatibility.
 *
 * @param history - Array of messages to format
 * @returns XML-formatted string of conversation history
 *
 * @example
 * ```typescript
 * const history = [
 *   { role: 'user', content: 'Hello' },
 *   { role: 'assistant', content: 'Hi there!' }
 * ];
 * formatHistoryAsXML(history);
 * // Returns:
 * // <conversation_history>
 * // <message role="user">Hello</message>
 * // <message role="assistant">Hi there!</message>
 * // </conversation_history>
 * ```
 */
export function formatHistoryAsXML(history: Message[]): string {
  if (history.length === 0) {
    return '';
  }

  const messages = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `<message role="${m.role}">${escapeXML(m.content)}</message>`)
    .join('\n');

  return `<conversation_history>\n${messages}\n</conversation_history>`;
}

/**
 * Escape XML special characters
 */
function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Quoted message context for prompt injection
 */
export interface QuotedContext {
  /** Text content of the quoted message */
  text: string;
  /** Username of the quoted message sender */
  username?: string;
}

/**
 * Format messages for LLM with history embedded in user message
 *
 * This transforms the standard messages array format into a single user message
 * with conversation history embedded as XML. This is useful for AI Gateways
 * that benefit from having context in a single message.
 *
 * @param messages - Current conversation messages
 * @param systemPrompt - System prompt for the agent
 * @param userMessage - Current user message
 * @param quotedContext - Optional quoted message context (when user replied to a message)
 * @returns LLM messages with history embedded in user message
 *
 * @example
 * ```typescript
 * const llmMessages = formatWithEmbeddedHistory(
 *   previousMessages,
 *   'You are a helpful assistant',
 *   'What is the weather?'
 * );
 * // Returns:
 * // [
 * //   { role: 'system', content: 'You are a helpful assistant' },
 * //   { role: 'user', content: '<conversation_history>...</conversation_history>\n\nWhat is the weather?' }
 * // ]
 *
 * // With quoted context:
 * const llmMessagesWithQuote = formatWithEmbeddedHistory(
 *   previousMessages,
 *   'You are a helpful assistant',
 *   'How about this one?',
 *   { text: 'Original message text', username: 'john' }
 * );
 * // Returns message with <quoted_message> tag before current_message
 * ```
 */
export function formatWithEmbeddedHistory(
  messages: Message[],
  systemPrompt: string,
  userMessage: string,
  quotedContext?: QuotedContext
): LLMMessage[] {
  const historyXML = formatHistoryAsXML(messages);

  // Build quoted context XML if present
  let quotedXML = '';
  if (quotedContext?.text) {
    const from = quotedContext.username || 'a previous message';
    quotedXML = `<quoted_message from="${escapeXML(from)}">${escapeXML(quotedContext.text)}</quoted_message>\n\n`;
  }

  // Build user message with embedded history and quoted context
  const userContent = historyXML
    ? `${historyXML}\n\n${quotedXML}<current_message>\n${userMessage}\n</current_message>`
    : `${quotedXML}${userMessage}`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];
}
