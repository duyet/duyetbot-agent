/**
 * Memory-backed Message Persistence Adapter
 *
 * Stores messages in memory only (no persistent storage).
 * Useful for testing and environments without D1 database.
 * Messages are discarded when the process terminates.
 */
import type { Message } from '../../types.js';
import type { IMessagePersistence, SessionId } from './types.js';
/**
 * Memory message persistence adapter implementation
 */
export declare class MemoryMessagePersistence implements IMessagePersistence {
  private messagesBySession;
  /**
   * Persist messages in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param _eventId - Optional event ID (ignored)
   */
  persistMessages(sessionId: SessionId, messages: Message[], _eventId?: string): void;
  /**
   * Persist command and response in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param _eventId - Optional event ID (ignored)
   */
  persistCommand(sessionId: SessionId, command: string, response: string, _eventId?: string): void;
  /**
   * Load messages from memory
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages
   */
  loadMessages(sessionId: SessionId, maxHistory: number): Promise<Message[]>;
  /**
   * Clear all stored messages (useful for testing)
   */
  clear(): void;
  /**
   * Get message count for a session (useful for testing)
   *
   * @param sessionId - Session identifier
   * @returns Number of messages stored
   */
  getMessageCount(sessionId: SessionId): number;
  /**
   * Build session ID string from components
   *
   * @param sessionId - Session identifier components
   * @returns Session ID string (format: "platform:userId:chatId")
   */
  private buildSessionId;
}
//# sourceMappingURL=memory-persistence.d.ts.map
