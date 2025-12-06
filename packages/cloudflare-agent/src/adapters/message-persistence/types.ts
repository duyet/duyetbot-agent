/**
 * Message Persistence Adapter Types
 *
 * Provides interface definitions for message persistence using Dependency Injection.
 */

import type { Message } from '../../types.js';

/**
 * Session identifier components
 */
export interface SessionId {
  /** Platform identifier (telegram, github, api, etc.) */
  platform: string;

  /** User ID on platform */
  userId: string;

  /** Chat/conversation ID on platform */
  chatId: string;
}

/**
 * Interface for message persistence
 *
 * Implementations should use fire-and-forget pattern for write operations
 * (async operations that don't block main flow).
 * Errors should be logged but not thrown.
 */
export interface IMessagePersistence {
  /**
   * Persist messages to storage
   *
   * Replaces all existing messages for the session with the provided messages.
   * This is a fire-and-forget operation.
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param eventId - Optional event ID for correlation
   */
  persistMessages(sessionId: SessionId, messages: Message[], eventId?: string): void;

  /**
   * Persist a slash command and response
   *
   * Appends command and response as separate messages to session history.
   * This is a fire-and-forget operation.
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param eventId - Optional event ID for correlation
   */
  persistCommand(sessionId: SessionId, command: string, response: string, eventId?: string): void;

  /**
   * Load messages from storage
   *
   * Retrieves recent messages from session history. This is an async operation
   * that should be awaited for proper error handling.
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages, empty if none found
   */
  loadMessages(sessionId: SessionId, maxHistory: number): Promise<Message[]>;
}
