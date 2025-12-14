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
export class MemoryMessagePersistence implements IMessagePersistence {
  private messagesBySession: Map<string, Message[]> = new Map();

  /**
   * Persist messages in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param _eventId - Optional event ID (ignored)
   */
  persistMessages(sessionId: SessionId, messages: Message[], _eventId?: string): void {
    const sessionIdStr = this.buildSessionId(sessionId);
    this.messagesBySession.set(sessionIdStr, [...messages]);
  }

  /**
   * Persist command and response in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param _eventId - Optional event ID (ignored)
   */
  persistCommand(sessionId: SessionId, command: string, response: string, _eventId?: string): void {
    const sessionIdStr = this.buildSessionId(sessionId);
    const existing = this.messagesBySession.get(sessionIdStr) ?? [];

    const messages: Message[] = [
      ...existing,
      { role: 'user' as const, content: command },
      { role: 'assistant' as const, content: response },
    ];

    this.messagesBySession.set(sessionIdStr, messages);
  }

  /**
   * Load messages from memory
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages
   */
  async loadMessages(sessionId: SessionId, maxHistory: number): Promise<Message[]> {
    const sessionIdStr = this.buildSessionId(sessionId);
    const messages = this.messagesBySession.get(sessionIdStr) ?? [];

    // Return the most recent messages up to maxHistory
    if (messages.length <= maxHistory) {
      return messages;
    }

    return messages.slice(-maxHistory);
  }

  /**
   * Clear all stored messages (useful for testing)
   */
  clear(): void {
    this.messagesBySession.clear();
  }

  /**
   * Get message count for a session (useful for testing)
   *
   * @param sessionId - Session identifier
   * @returns Number of messages stored
   */
  getMessageCount(sessionId: SessionId): number {
    const sessionIdStr = this.buildSessionId(sessionId);
    return this.messagesBySession.get(sessionIdStr)?.length ?? 0;
  }

  /**
   * Clear all messages for a session
   *
   * @param sessionId - Session identifier
   * @returns Number of messages deleted
   */
  async clearMessages(sessionId: SessionId): Promise<number> {
    const sessionIdStr = this.buildSessionId(sessionId);
    const count = this.messagesBySession.get(sessionIdStr)?.length ?? 0;
    this.messagesBySession.delete(sessionIdStr);
    return count;
  }

  /**
   * Build session ID string from components
   *
   * @param sessionId - Session identifier components
   * @returns Session ID string (format: "platform:userId:chatId")
   */
  private buildSessionId(sessionId: SessionId): string {
    return `${sessionId.platform}:${sessionId.userId}:${sessionId.chatId}`;
  }
}
