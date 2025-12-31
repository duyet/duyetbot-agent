/**
 * Message Store
 *
 * Provides a unified facade over IMessagePersistence adapters.
 * Implements fire-and-forget pattern for write operations and
 * provides clean API for message history management.
 */

import type { IMessagePersistence, SessionId } from '../adapters/message-persistence/types.js';
import type { Message } from '../types.js';

/**
 * Facade over message persistence adapters
 *
 * Provides unified API for message operations with consistent behavior
 * regardless of underlying storage implementation.
 */
export class MessageStore {
  private adapter: IMessagePersistence | null;

  /**
   * Create a message store
   *
   * @param adapter - Message persistence adapter (null for no-op mode)
   *
   * @example
   * ```typescript
   * // With D1 persistence
   * const store = new MessageStore(new D1MessagePersistence(env.DB));
   *
   * // Without persistence (no-op)
   * const store = new MessageStore(null);
   * ```
   */
  constructor(adapter: IMessagePersistence | null) {
    this.adapter = adapter;
  }

  /**
   * Load message history for a session
   *
   * Retrieves recent messages from storage, up to maxHistory limit.
   * Returns empty array if no messages found or persistence disabled.
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages (empty if none found)
   *
   * @example
   * ```typescript
   * const messages = await store.load(sessionId, 10);
   * // Returns up to 10 most recent messages
   * ```
   */
  async load(sessionId: SessionId, maxHistory: number): Promise<Message[]> {
    if (!this.adapter) {
      return [];
    }

    try {
      return await this.adapter.loadMessages(sessionId, maxHistory);
    } catch (err) {
      // Adapters should handle errors internally, but catch any that escape
      console.warn('[MessageStore] Failed to load messages', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  /**
   * Persist messages to storage (fire-and-forget)
   *
   * Replaces all existing messages for the session with provided messages.
   * Non-blocking operation - errors are logged but not thrown.
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param eventId - Optional event ID for correlation
   *
   * @example
   * ```typescript
   * store.persist(sessionId, [
   *   { role: 'user', content: 'Hello' },
   *   { role: 'assistant', content: 'Hi there!' }
   * ], 'evt_123');
   * ```
   */
  persist(sessionId: SessionId, messages: Message[], eventId?: string): void {
    if (!this.adapter) {
      return;
    }

    // Fire-and-forget: delegate to adapter
    this.adapter.persistMessages(sessionId, messages, eventId);
  }

  /**
   * Persist slash command and response (fire-and-forget)
   *
   * Appends command and response as separate messages to session history.
   * Non-blocking operation - errors are logged but not thrown.
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param eventId - Optional event ID for correlation
   *
   * @example
   * ```typescript
   * store.persistCommand(sessionId, '/help', 'Available commands: ...', 'evt_123');
   * ```
   */
  persistCommand(sessionId: SessionId, command: string, response: string, eventId?: string): void {
    if (!this.adapter) {
      return;
    }

    // Fire-and-forget: delegate to adapter
    this.adapter.persistCommand(sessionId, command, response, eventId);
  }

  // Note: clearMessages method intentionally omitted
  // The clearHistory() method in CloudflareAgent only clears DO state,
  // not D1 messages (which are kept as archive). If needed in the future,
  // add clearMessages() to IMessagePersistence interface first.

  /**
   * Check if persistence is enabled
   *
   * @returns true if adapter is available, false otherwise
   */
  isEnabled(): boolean {
    return this.adapter !== null;
  }
}
