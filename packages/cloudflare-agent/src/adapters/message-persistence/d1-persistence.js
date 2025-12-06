/**
 * D1-backed Message Persistence Adapter
 *
 * Persists messages to Cloudflare D1 database for cross-session history.
 * Uses fire-and-forget pattern for writes, with error logging only.
 */
import { logger } from '@duyetbot/hono-middleware';
import { ChatMessageStorage } from '@duyetbot/observability';
/**
 * D1 message persistence adapter implementation
 */
export class D1MessagePersistence {
  storage;
  constructor(db) {
    this.storage = new ChatMessageStorage(db);
  }
  /**
   * Persist messages to D1 (fire-and-forget)
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param eventId - Optional event ID for correlation
   */
  persistMessages(sessionId, messages, eventId) {
    const sessionIdStr = this.buildSessionId(sessionId);
    if (messages.length === 0) {
      return;
    }
    void (async () => {
      try {
        // Convert Message[] to ChatMessage format
        const chatMessages = messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: Date.now(),
        }));
        // Replace all messages (sync full state)
        await this.storage.replaceMessages(sessionIdStr, chatMessages, eventId);
        logger.debug('[D1MessagePersistence] Messages persisted', {
          sessionId: sessionIdStr,
          messageCount: messages.length,
          eventId,
        });
      } catch (err) {
        logger.warn('[D1MessagePersistence] Failed to persist messages', {
          sessionId: sessionIdStr,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }
  /**
   * Persist command and response to D1 (fire-and-forget)
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param eventId - Optional event ID for correlation
   */
  persistCommand(sessionId, command, response, eventId) {
    const sessionIdStr = this.buildSessionId(sessionId);
    const now = Date.now();
    void (async () => {
      try {
        // Append command and response as separate messages
        await this.storage.appendMessages(
          sessionIdStr,
          [
            { role: 'user', content: command, timestamp: now },
            { role: 'assistant', content: response, timestamp: now },
          ],
          eventId
        );
        logger.debug('[D1MessagePersistence] Command persisted', {
          sessionId: sessionIdStr,
          command,
          eventId,
        });
      } catch (err) {
        logger.warn('[D1MessagePersistence] Failed to persist command', {
          sessionId: sessionIdStr,
          command,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }
  /**
   * Load messages from D1
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages
   */
  async loadMessages(sessionId, maxHistory) {
    const sessionIdStr = this.buildSessionId(sessionId);
    try {
      // Get recent messages (limited to maxHistory)
      const messages = await this.storage.getRecentMessages(sessionIdStr, maxHistory);
      if (messages.length === 0) {
        return [];
      }
      logger.debug('[D1MessagePersistence] Messages loaded', {
        sessionId: sessionIdStr,
        messageCount: messages.length,
      });
      // Convert ChatMessage[] to Message format
      return messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    } catch (err) {
      logger.warn('[D1MessagePersistence] Failed to load messages', {
        sessionId: sessionIdStr,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
  /**
   * Build session ID string from components
   *
   * @param sessionId - Session identifier components
   * @returns Session ID string (format: "platform:userId:chatId")
   */
  buildSessionId(sessionId) {
    return `${sessionId.platform}:${sessionId.userId}:${sessionId.chatId}`;
  }
}
