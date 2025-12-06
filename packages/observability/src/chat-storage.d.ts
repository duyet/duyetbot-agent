import type { ChatMessage, ChatMessageRole, ChatSessionStats } from './types.js';
/**
 * D1 database interface (subset of Cloudflare D1Database).
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
}
/**
 * ChatMessageStorage handles D1 operations for chat message history.
 *
 * Provides methods to:
 * - Save messages (append or replace)
 * - Retrieve conversation history
 * - Query session statistics
 * - Clean up old messages
 */
export declare class ChatMessageStorage {
  private db;
  constructor(db: D1Database);
  /**
   * Append new messages to a session.
   * Automatically assigns sequence numbers based on existing messages.
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to append (without sequence numbers)
   * @param eventId - Optional event ID for correlation
   * @returns Number of messages inserted
   */
  appendMessages(
    sessionId: string,
    messages: Array<{
      role: ChatMessageRole;
      content: string;
      inputTokens?: number;
      outputTokens?: number;
      timestamp?: number;
    }>,
    eventId?: string
  ): Promise<number>;
  /**
   * Replace all messages in a session.
   * Useful for session reset or sync from DO state.
   *
   * @param sessionId - Session identifier
   * @param messages - Complete message list
   * @param eventId - Optional event ID for correlation
   * @returns Number of messages inserted
   */
  replaceMessages(
    sessionId: string,
    messages: Array<{
      role: ChatMessageRole;
      content: string;
      inputTokens?: number;
      outputTokens?: number;
      timestamp?: number;
    }>,
    eventId?: string
  ): Promise<number>;
  /**
   * Get all messages for a session, ordered by sequence.
   *
   * @param sessionId - Session identifier
   * @param options - Pagination options
   * @returns Array of messages
   */
  getMessages(
    sessionId: string,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<ChatMessage[]>;
  /**
   * Get recent messages for a session (last N messages).
   *
   * @param sessionId - Session identifier
   * @param limit - Maximum number of messages to return
   * @returns Array of recent messages (oldest first)
   */
  getRecentMessages(sessionId: string, limit: number): Promise<ChatMessage[]>;
  /**
   * Get message count for a session.
   */
  getMessageCount(sessionId: string): Promise<number>;
  /**
   * Delete all messages for a session.
   */
  deleteSession(sessionId: string): Promise<number>;
  /**
   * Get session statistics.
   */
  getSessionStats(sessionId: string): Promise<ChatSessionStats | null>;
  /**
   * Get all active sessions (with messages in last N days).
   */
  getActiveSessions(days?: number, limit?: number): Promise<ChatSessionStats[]>;
  /**
   * Delete old messages (older than N days).
   * Useful for cleanup and storage management.
   */
  deleteOldMessages(days: number): Promise<number>;
  /**
   * Convert database row to ChatMessage.
   */
  private rowToMessage;
}
//# sourceMappingURL=chat-storage.d.ts.map
