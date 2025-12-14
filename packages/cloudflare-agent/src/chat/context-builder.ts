/**
 * Context Builder - Build LLM messages with history
 *
 * Handles:
 * - Embedding conversation history as XML in user message
 * - Including quoted context (when user replies to a message)
 * - Building messages array for LLM API
 */

import { formatWithEmbeddedHistory } from '../format.js';
import type { LLMMessage, Message } from '../types.js';
import type { QuotedContext } from '../workflow/types.js';

/**
 * Configuration for building context
 */
export interface ContextBuilderConfig {
  /** System prompt */
  systemPrompt: string;
  /** Conversation history */
  messages: Message[];
}

/**
 * Build LLM messages for initial request
 * @param config - Context configuration
 * @param userMessage - Current user message
 * @param quotedContext - Optional quoted message context
 * @returns LLM messages with embedded history
 */
export function buildInitialMessages(
  config: ContextBuilderConfig,
  userMessage: string,
  quotedContext?: QuotedContext
): LLMMessage[] {
  return formatWithEmbeddedHistory(
    config.messages,
    config.systemPrompt,
    userMessage,
    quotedContext
  );
}

/**
 * Build LLM messages for tool iteration
 * @param initialMessages - Initial messages from buildInitialMessages
 * @param toolConversation - Tool conversation turns (assistant + tool results)
 * @returns Combined messages for LLM
 */
export function buildToolIterationMessages(
  initialMessages: LLMMessage[],
  toolConversation: Array<{ role: 'user' | 'assistant'; content: string }>
): LLMMessage[] {
  // Combine: system prompt + embedded history with user message + tool turns
  return [...initialMessages, ...toolConversation];
}
