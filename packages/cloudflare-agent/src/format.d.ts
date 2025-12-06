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
/**
 * Clean tool name by removing server prefix
 * e.g., "memory__save_memory" → "save_memory"
 */
export declare function cleanToolName(name: string): string;
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
export declare function formatToolProgress(
  executions: ToolExecution[],
  config?: ProgressConfig
): string;
/**
 * Format complete response with tool execution history
 *
 * @param executions - Array of completed tool executions
 * @param finalContent - Final response content
 * @param config - Formatting configuration
 * @returns Formatted message with progress and final response
 */
export declare function formatCompleteResponse(
  executions: ToolExecution[],
  finalContent: string,
  config?: ProgressConfig
): string;
/**
 * Get a random thinking message
 * @param extended - Use extended messages for longer waits
 */
export declare function getRandomThinkingMessage(extended?: boolean): string;
/**
 * Format initial thinking message
 * @param format - Output format
 * @param extended - Use extended messages for longer waits
 */
export declare function formatThinkingMessage(
  format?: 'markdown' | 'plain',
  extended?: boolean
): string;
/**
 * Format error message
 */
export declare function formatErrorMessage(error: string, format?: 'markdown' | 'plain'): string;
/**
 * Configuration for thinking message rotator
 */
export interface ThinkingRotatorConfig {
  /** Custom messages to rotate through */
  messages?: string[];
  /** Rotation interval in milliseconds (default: 5000) */
  interval?: number;
  /** Start from a random message instead of the first (default: true) */
  random?: boolean;
}
/**
 * Thinking message rotator interface
 */
export interface ThinkingRotator {
  /** Get current message without advancing */
  getCurrentMessage(): string;
  /** Start rotation, calling onMessage for each new message. Supports async callbacks. */
  start(onMessage: (message: string) => void | Promise<void>): void;
  /** Stop rotation */
  stop(): void;
  /**
   * Wait for any in-flight callback to complete.
   * Call this after stop() before sending final response to avoid race conditions.
   */
  waitForPending(): Promise<void>;
}
/**
 * Create a thinking message rotator for showing progress during long operations
 *
 * @param config - Rotator configuration
 * @returns ThinkingRotator instance
 *
 * @example
 * ```typescript
 * const rotator = createThinkingRotator({
 *   messages: ['Thinking...', 'Processing...', 'Almost done...'],
 *   interval: 3000
 * });
 *
 * const initial = rotator.getCurrentMessage();
 * rotator.start((msg) => updateUI(msg));
 * // ... do work ...
 * rotator.stop();
 * ```
 */
export declare function createThinkingRotator(config?: ThinkingRotatorConfig): ThinkingRotator;
/**
 * Get a copy of the default thinking messages array
 * Useful for extending or customizing the default set
 */
export declare function getDefaultThinkingMessages(): string[];
/**
 * Get a copy of the extended thinking messages array
 * For longer operations that need more variety
 */
export declare function getExtendedThinkingMessages(): string[];
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
export declare function formatHistoryAsXML(history: Message[]): string;
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
export declare function formatWithEmbeddedHistory(
  messages: Message[],
  systemPrompt: string,
  userMessage: string,
  quotedContext?: QuotedContext
): LLMMessage[];
//# sourceMappingURL=format.d.ts.map
