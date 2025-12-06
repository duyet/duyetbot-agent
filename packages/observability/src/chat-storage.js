/**
 * ChatMessageStorage handles D1 operations for chat message history.
 *
 * Provides methods to:
 * - Save messages (append or replace)
 * - Retrieve conversation history
 * - Query session statistics
 * - Clean up old messages
 */
export class ChatMessageStorage {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Append new messages to a session.
   * Automatically assigns sequence numbers based on existing messages.
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to append (without sequence numbers)
   * @param eventId - Optional event ID for correlation
   * @returns Number of messages inserted
   */
  async appendMessages(sessionId, messages, eventId) {
    if (messages.length === 0) {
      return 0;
    }
    // Get current max sequence for this session
    const maxSeq = await this.db
      .prepare('SELECT MAX(sequence) as max_seq FROM chat_messages WHERE session_id = ?')
      .bind(sessionId)
      .first();
    const startSequence = (maxSeq?.max_seq ?? -1) + 1;
    const now = Date.now();
    const statements = messages.map((msg, index) =>
      this.db
        .prepare(`INSERT INTO chat_messages
           (event_id, session_id, sequence, role, content, input_tokens, output_tokens, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          eventId ?? null,
          sessionId,
          startSequence + index,
          msg.role,
          msg.content,
          msg.inputTokens ?? 0,
          msg.outputTokens ?? 0,
          msg.timestamp ?? now
        )
    );
    await this.db.batch(statements);
    return messages.length;
  }
  /**
   * Replace all messages in a session.
   * Useful for session reset or sync from DO state.
   *
   * @param sessionId - Session identifier
   * @param messages - Complete message list
   * @param eventId - Optional event ID for correlation
   * @returns Number of messages inserted
   */
  async replaceMessages(sessionId, messages, eventId) {
    const now = Date.now();
    const statements = [
      // Delete existing messages
      this.db
        .prepare('DELETE FROM chat_messages WHERE session_id = ?')
        .bind(sessionId),
      // Insert new messages
      ...messages.map((msg, index) =>
        this.db
          .prepare(`INSERT INTO chat_messages
             (event_id, session_id, sequence, role, content, input_tokens, output_tokens, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(
            eventId ?? null,
            sessionId,
            index,
            msg.role,
            msg.content,
            msg.inputTokens ?? 0,
            msg.outputTokens ?? 0,
            msg.timestamp ?? now
          )
      ),
    ];
    await this.db.batch(statements);
    return messages.length;
  }
  /**
   * Get all messages for a session, ordered by sequence.
   *
   * @param sessionId - Session identifier
   * @param options - Pagination options
   * @returns Array of messages
   */
  async getMessages(sessionId, options) {
    let query = `
      SELECT * FROM chat_messages
      WHERE session_id = ?
      ORDER BY sequence ASC
    `;
    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }
    if (options?.offset) {
      query += ` OFFSET ${options.offset}`;
    }
    const result = await this.db.prepare(query).bind(sessionId).all();
    return (result.results ?? []).map(this.rowToMessage);
  }
  /**
   * Get recent messages for a session (last N messages).
   *
   * @param sessionId - Session identifier
   * @param limit - Maximum number of messages to return
   * @returns Array of recent messages (oldest first)
   */
  async getRecentMessages(sessionId, limit) {
    // Subquery to get recent messages, then order correctly
    const result = await this.db
      .prepare(`SELECT * FROM (
           SELECT * FROM chat_messages
           WHERE session_id = ?
           ORDER BY sequence DESC
           LIMIT ?
         ) ORDER BY sequence ASC`)
      .bind(sessionId, limit)
      .all();
    return (result.results ?? []).map(this.rowToMessage);
  }
  /**
   * Get message count for a session.
   */
  async getMessageCount(sessionId) {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?')
      .bind(sessionId)
      .first();
    return result?.count ?? 0;
  }
  /**
   * Delete all messages for a session.
   */
  async deleteSession(sessionId) {
    const result = await this.db
      .prepare('DELETE FROM chat_messages WHERE session_id = ?')
      .bind(sessionId)
      .run();
    return result.meta?.changes ?? 0;
  }
  /**
   * Get session statistics.
   */
  async getSessionStats(sessionId) {
    const result = await this.db
      .prepare('SELECT * FROM chat_session_stats WHERE session_id = ?')
      .bind(sessionId)
      .first();
    if (!result) {
      return null;
    }
    return {
      sessionId: result.session_id,
      messageCount: result.message_count,
      userMessages: result.user_messages,
      assistantMessages: result.assistant_messages,
      totalInputTokens: result.total_input_tokens,
      totalOutputTokens: result.total_output_tokens,
      firstMessageAt: result.first_message_at,
      lastMessageAt: result.last_message_at,
    };
  }
  /**
   * Get all active sessions (with messages in last N days).
   */
  async getActiveSessions(days = 7, limit = 100) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const result = await this.db
      .prepare(`SELECT * FROM chat_session_stats
         WHERE last_message_at > ?
         ORDER BY last_message_at DESC
         LIMIT ?`)
      .bind(cutoff, limit)
      .all();
    return (result.results ?? []).map((row) => ({
      sessionId: row.session_id,
      messageCount: row.message_count,
      userMessages: row.user_messages,
      assistantMessages: row.assistant_messages,
      totalInputTokens: row.total_input_tokens,
      totalOutputTokens: row.total_output_tokens,
      firstMessageAt: row.first_message_at,
      lastMessageAt: row.last_message_at,
    }));
  }
  /**
   * Delete old messages (older than N days).
   * Useful for cleanup and storage management.
   */
  async deleteOldMessages(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const result = await this.db
      .prepare('DELETE FROM chat_messages WHERE timestamp < ?')
      .bind(cutoff)
      .run();
    return result.meta?.changes ?? 0;
  }
  /**
   * Convert database row to ChatMessage.
   */
  rowToMessage = (row) => {
    const message = {
      id: row.id,
      sessionId: row.session_id,
      sequence: row.sequence,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
    };
    if (row.event_id !== null) {
      message.eventId = row.event_id;
    }
    if (row.input_tokens > 0) {
      message.inputTokens = row.input_tokens;
    }
    if (row.output_tokens > 0) {
      message.outputTokens = row.output_tokens;
    }
    return message;
  };
}
