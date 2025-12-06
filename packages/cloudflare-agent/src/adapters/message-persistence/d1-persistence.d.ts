/**
 * D1-backed Message Persistence Adapter
 *
 * Persists messages to Cloudflare D1 database for cross-session history.
 * Uses fire-and-forget pattern for writes, with error logging only.
 */
import { type D1Database } from '@duyetbot/observability';
import type { Message } from '../../types.js';
import type { IMessagePersistence, SessionId } from './types.js';
/**
 * D1 message persistence adapter implementation
 */
export declare class D1MessagePersistence implements IMessagePersistence {
  private storage;
  constructor(db: D1Database);
  /**
   * Persist messages to D1 (fire-and-forget)
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param eventId - Optional event ID for correlation
   */
  persistMessages(sessionId: SessionId, messages: Message[], eventId?: string): void;
  /**
   * Persist command and response to D1 (fire-and-forget)
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param eventId - Optional event ID for correlation
   */
  persistCommand(sessionId: SessionId, command: string, response: string, eventId?: string): void;
  /**
   * Load messages from D1
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages
   */
  loadMessages(sessionId: SessionId, maxHistory: number): Promise<Message[]>;
  /**
   * Build session ID string from components
   *
   * @param sessionId - Session identifier components
   * @returns Session ID string (format: "platform:userId:chatId")
   */
  private buildSessionId;
}
//# sourceMappingURL=d1-persistence.d.ts.map
