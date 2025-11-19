/**
 * Message Types and Interfaces
 *
 * Extended message types for agent communication
 */

import type { LLMMessage } from './provider.js';

/**
 * Message source
 */
export type MessageSource = 'user' | 'agent' | 'tool' | 'system';

/**
 * Message priority
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Extended message with additional metadata
 */
export interface ExtendedMessage extends LLMMessage {
  /**
   * Unique message ID
   */
  id: string;

  /**
   * Message source
   */
  source: MessageSource;

  /**
   * Message priority
   */
  priority?: MessagePriority;

  /**
   * Parent message ID (for threading)
   */
  parentId?: string;

  /**
   * Timestamp
   */
  timestamp: number;

  /**
   * Token count (if available)
   */
  tokens?: number;

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Message with tool call information
 */
export interface ToolCallMessage extends ExtendedMessage {
  role: 'assistant';
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

/**
 * Message with tool result
 */
export interface ToolResultMessage extends ExtendedMessage {
  role: 'user';
  toolCallId: string;
  toolName: string;
  result: unknown;
  error?: string;
}

/**
 * Message filter options
 */
export interface MessageFilter {
  role?: LLMMessage['role'];
  source?: MessageSource;
  priority?: MessagePriority;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

/**
 * Message history
 */
export interface MessageHistory {
  messages: ExtendedMessage[];
  totalCount: number;
  hasMore: boolean;
}
