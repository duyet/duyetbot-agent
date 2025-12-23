/**
 * Web Transport Layer
 *
 * Implements the Transport interface for web-based chat.
 * Uses D1 database for message persistence and SSE for real-time updates.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Transport } from '@duyetbot/cloudflare-agent';
import { logger } from '@duyetbot/hono-middleware';

/**
 * Web-specific context for transport operations
 */
export interface WebContext {
  /** Database for message persistence */
  db: D1Database;
  /** Session identifier */
  sessionId: string;
  /** User identifier */
  userId: string;
  /** Message text */
  text: string;
  /** Start time for duration tracking */
  startTime: number;
  /** Request ID for trace correlation */
  requestId?: string;
  /** SSE connection for real-time updates (optional) */
  sseConnection?: WritableStreamDefaultWriter<Uint8Array>;
}

/**
 * Message record stored in D1
 */
interface MessageRecord {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
  updated_at: number;
}

/**
 * Store a message in D1
 */
async function storeMessage(
  db: D1Database,
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<string> {
  const messageId = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO messages (id, session_id, user_id, role, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(messageId, sessionId, userId, role, content, now, now)
    .run();

  logger.debug('[TRANSPORT] Message stored', { messageId, sessionId, userId, role });
  return messageId;
}

/**
 * Update a message in D1
 */
async function updateMessage(db: D1Database, messageId: string, content: string): Promise<void> {
  const now = Date.now();

  await db
    .prepare(`UPDATE messages SET content = ?, updated_at = ? WHERE id = ?`)
    .bind(content, now, messageId)
    .run();

  logger.debug('[TRANSPORT] Message updated', { messageId });
}

/**
 * Send SSE event to connected client
 */
async function sendSSEEvent(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  event: string,
  data: unknown
): Promise<void> {
  const encoder = new TextEncoder();
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  await writer.write(encoder.encode(message));
}

/**
 * Web transport implementation
 *
 * Uses D1 for persistence and SSE for real-time updates.
 *
 * @example
 * ```typescript
 * const ChatAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createProvider(env),
 *   systemPrompt: 'You are a helpful assistant.',
 *   transport: webTransport,
 * });
 * ```
 */
export const webTransport: Transport<WebContext> = {
  send: async (ctx, text) => {
    // Store message in D1
    const messageId = await storeMessage(ctx.db, ctx.sessionId, ctx.userId, 'assistant', text);

    // Send SSE event if connection exists
    if (ctx.sseConnection) {
      try {
        await sendSSEEvent(ctx.sseConnection, 'message', {
          messageId,
          sessionId: ctx.sessionId,
          role: 'assistant',
          content: text,
        });
      } catch (error) {
        logger.warn('[TRANSPORT] Failed to send SSE event', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return messageId;
  },

  edit: async (ctx, ref, text) => {
    const messageId = ref as string;

    // Update message in D1
    await updateMessage(ctx.db, messageId, text);

    // Send SSE event if connection exists
    if (ctx.sseConnection) {
      try {
        await sendSSEEvent(ctx.sseConnection, 'message_edit', {
          messageId,
          sessionId: ctx.sessionId,
          role: 'assistant',
          content: text,
        });
      } catch (error) {
        logger.warn('[TRANSPORT] Failed to send SSE edit event', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  },

  parseContext: (ctx) => ({
    text: ctx.text,
    userId: ctx.userId,
    chatId: ctx.sessionId,
    messageRef: ctx.requestId,
    metadata: {
      startTime: ctx.startTime,
      requestId: ctx.requestId,
    },
  }),
};

/**
 * Create WebContext from request context
 *
 * @param db - D1 database binding
 * @param requestCtx - Request context
 * @param sseConnection - Optional SSE connection for real-time updates
 */
export function createWebContext(
  db: D1Database,
  requestCtx: {
    sessionId: string;
    userId: string;
    text: string;
    startTime: number;
    requestId?: string;
  },
  sseConnection?: WritableStreamDefaultWriter<Uint8Array>
): WebContext {
  return {
    db,
    sessionId: requestCtx.sessionId,
    userId: requestCtx.userId,
    text: requestCtx.text,
    startTime: requestCtx.startTime,
    requestId: requestCtx.requestId,
    sseConnection,
  };
}

/**
 * Initialize D1 database schema for messages table
 *
 * @param db - D1 database binding
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    )
    .run();

  await db
    .prepare(`CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`)
    .run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id)`).run();

  logger.info('[TRANSPORT] Database initialized');
}

/**
 * Get message history for a session
 *
 * @param db - D1 database binding
 * @param sessionId - Session identifier
 * @param limit - Maximum number of messages to retrieve
 * @returns Array of message records
 */
export async function getMessageHistory(
  db: D1Database,
  sessionId: string,
  limit = 50
): Promise<MessageRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, session_id, user_id, role, content, created_at, updated_at
       FROM messages
       WHERE session_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(sessionId, limit)
    .all<MessageRecord>();

  return result.results.reverse();
}

/**
 * Clear message history for a session
 *
 * @param db - D1 database binding
 * @param sessionId - Session identifier
 */
export async function clearMessageHistory(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare(`DELETE FROM messages WHERE session_id = ?`).bind(sessionId).run();

  logger.info('[TRANSPORT] Message history cleared', { sessionId });
}
