import { logger } from '@duyetbot/hono-middleware';
import { type ChatMessageRole, ChatMessageStorage, type D1Database } from '@duyetbot/observability';

import type { Message } from '../types.js'; // Assuming types.ts is in parent dir relative to adapters

/**
 * Adapter for persisting messages to D1 database.
 * Handles saving messages and commands, as well as loading history.
 */
export class MessagePersistenceAdapter {
  constructor(
    private db: D1Database | undefined,
    private sessionIdBuilder: () => string
  ) {}

  /**
   * Persist current messages to D1 for cross-session history.
   * Uses fire-and-forget pattern to avoid blocking main flow.
   */
  persistMessages(messages: Message[], eventId?: string): void {
    if (!this.db) {
      return;
    }

    const sessionId = this.sessionIdBuilder();
    if (messages.length === 0) {
      return;
    }

    // Fire-and-forget: persist messages to D1
    void (async () => {
      try {
        const storage = new ChatMessageStorage(this.db!);

        // Convert Message[] to ChatMessage format
        const chatMessages = messages.map((msg) => ({
          role: msg.role as ChatMessageRole,
          content: msg.content,
          timestamp: Date.now(),
        }));

        // Replace all messages (sync full state)
        await storage.replaceMessages(sessionId, chatMessages, eventId);

        logger.debug('[CloudflareAgent][PERSIST] Messages saved to D1', {
          sessionId,
          messageCount: messages.length,
          eventId,
        });
      } catch (err) {
        logger.warn('[CloudflareAgent][PERSIST] Failed to save messages', {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Persist a slash command and its response to D1.
   */
  persistCommand(command: string, response: string, eventId?: string): void {
    if (!this.db) {
      return;
    }

    const sessionId = this.sessionIdBuilder();
    const now = Date.now();

    // Fire-and-forget: persist command and response to D1
    void (async () => {
      try {
        const storage = new ChatMessageStorage(this.db!);

        // Append command and response as separate messages
        await storage.appendMessages(
          sessionId,
          [
            { role: 'user' as const, content: command, timestamp: now },
            { role: 'assistant' as const, content: response, timestamp: now },
          ],
          eventId
        );

        logger.debug('[CloudflareAgent][PERSIST] Command saved to D1', {
          sessionId,
          command,
          eventId,
        });
      } catch (err) {
        logger.warn('[CloudflareAgent][PERSIST] Failed to save command', {
          sessionId,
          command,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Load messages from D1 for session recovery.
   * Returns the loaded messages which should be merged into state.
   */
  async loadMessagesFromD1(maxHistory: number): Promise<Message[]> {
    if (!this.db) {
      return [];
    }

    const sessionId = this.sessionIdBuilder();

    try {
      const storage = new ChatMessageStorage(this.db);
      const messages = await storage.getRecentMessages(sessionId, maxHistory);

      if (messages.length === 0) {
        return [];
      }

      logger.info('[CloudflareAgent][LOAD] Restored messages from D1', {
        sessionId,
        messageCount: messages.length,
      });

      return messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
    } catch (err) {
      logger.warn('[CloudflareAgent][LOAD] Failed to load messages from D1', {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
