/**
 * Analytics Message Storage
 *
 * This module provides TypeScript interface to the message analytics system.
 *
 * Architecture (Centralized Data Monitoring):
 * - WRITE operations go to `chat_messages` table (source of truth)
 * - READ operations use `analytics_messages` view (computed from chat_messages + observability_events)
 * - The view `analytics_messages` is an alias to `analytics_messages_view` (created in migration 0009)
 *
 * Design principle: Append-only semantics - messages are never deleted, only archived via soft-delete.
 */

import type {
  AnalyticsMessage,
  DateRange,
  MessageCreateInput,
  PaginatedResult,
  PaginationOptions,
  QueryOptions,
  SessionStats,
  UserStats,
} from '../types.js';
import { BaseStorage } from './base.js';

/**
 * AnalyticsMessageStorage handles D1 operations for analytics messages.
 * All operations are append-only - messages are archived via soft-delete, never hard-deleted.
 */
export class AnalyticsMessageStorage extends BaseStorage {
  /**
   * Create a single message in analytics storage
   * @param input Message creation input
   * @returns Created message with assigned ID
   */
  async createMessage(input: MessageCreateInput): Promise<AnalyticsMessage> {
    const messages = await this.createMessages([input]);
    if (!messages[0]) {
      throw new Error('Failed to create message');
    }
    return messages[0];
  }

  /**
   * Create multiple messages in batch (more efficient)
   *
   * ARCHITECTURE NOTE: Writes go to `chat_messages` (source of truth).
   * The `analytics_messages` view provides enriched read access.
   *
   * @param inputs Array of message creation inputs
   * @returns Array of created messages
   */
  async createMessages(inputs: MessageCreateInput[]): Promise<AnalyticsMessage[]> {
    if (inputs.length === 0) {
      return [];
    }

    const now = Date.now();

    // Get max sequence for each session first (from source table)
    const sessionSequences = new Map<string, number>();

    for (const input of inputs) {
      if (!sessionSequences.has(input.sessionId)) {
        const result = await this.first<{ max_seq: number | null }>(
          'SELECT MAX(sequence) as max_seq FROM chat_messages WHERE session_id = ?',
          [input.sessionId]
        );
        sessionSequences.set(input.sessionId, (result?.max_seq ?? -1) + 1);
      }
    }

    const messages: AnalyticsMessage[] = [];

    for (const input of inputs) {
      const sequence = sessionSequences.get(input.sessionId) || 0;
      sessionSequences.set(input.sessionId, sequence + 1);

      const messageId = crypto.randomUUID();
      // Note: totalTokens is computed on read via the view, not stored

      // Insert into chat_messages (source of truth)
      await this.run(
        `INSERT INTO chat_messages (
          message_id, session_id, event_id,
          sequence, role, content,
          platform, user_id, username, chat_id,
          visibility, is_archived, is_pinned,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          model, metadata,
          timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          messageId,
          input.sessionId,
          input.eventId ?? null,
          sequence,
          input.role,
          input.content,
          input.platform,
          input.userId,
          input.username ?? null,
          input.chatId ?? null,
          input.visibility ?? 'private',
          0, // is_archived
          0, // is_pinned
          input.inputTokens ?? 0,
          input.outputTokens ?? 0,
          input.cachedTokens ?? 0,
          input.reasoningTokens ?? 0,
          input.model ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          now, // timestamp
          now, // created_at
          now, // updated_at
        ]
      );

      // Read back from view to get enriched data (includes joined observability_events data)
      const message = await this.first<AnalyticsMessage>(
        'SELECT * FROM analytics_messages WHERE message_id = ?',
        [messageId]
      );

      if (message) {
        messages.push(message);
      }
    }

    return messages;
  }

  /**
   * Get a single message by ID
   * @param messageId The message ID
   * @returns Message if found, null otherwise
   */
  async getMessageById(messageId: string): Promise<AnalyticsMessage | null> {
    const message = await this.first<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE message_id = ? AND is_archived = 0',
      [messageId]
    );
    return message || null;
  }

  /**
   * Get all messages in a session, ordered by sequence
   * @param sessionId Session identifier
   * @param options Pagination options
   * @returns Array of messages
   */
  async getMessagesBySession(
    sessionId: string,
    options?: PaginationOptions
  ): Promise<AnalyticsMessage[]> {
    const params: unknown[] = [sessionId];
    let sql =
      'SELECT * FROM analytics_messages WHERE session_id = ? AND is_archived = 0 ORDER BY sequence ASC';

    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    return this.all<AnalyticsMessage>(sql, params);
  }

  /**
   * Get messages by user with pagination
   * @param userId User identifier
   * @param options Query options including pagination
   * @returns Paginated result with messages
   */
  async getMessagesByUser(
    userId: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<AnalyticsMessage>> {
    const pageSize = options?.limit ?? 50;
    const page = options?.offset ? Math.floor(options.offset / pageSize) + 1 : 1;
    const offset = (page - 1) * pageSize;

    // Get total count
    const countResult = await this.first<{ total: number }>(
      'SELECT COUNT(*) as total FROM analytics_messages WHERE user_id = ? AND is_archived = 0',
      [userId]
    );

    const total = countResult?.total ?? 0;

    // Get paginated results
    const data = await this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, pageSize, offset]
    );

    return { data, total, page, pageSize, hasMore: offset + data.length < total };
  }

  /**
   * Get all messages in a conversation
   * @param conversationId Conversation identifier
   * @returns Array of messages ordered by sequence
   */
  async getMessagesByConversation(conversationId: string): Promise<AnalyticsMessage[]> {
    return this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE conversation_id = ? AND is_archived = 0 ORDER BY sequence ASC',
      [conversationId]
    );
  }

  /**
   * Search messages by content
   * @param query Search query
   * @param options Query options
   * @returns Paginated search results
   */
  async searchMessages(
    query: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<AnalyticsMessage>> {
    const pageSize = options?.limit ?? 50;
    const page = options?.offset ? Math.floor(options.offset / pageSize) + 1 : 1;
    const offset = (page - 1) * pageSize;
    const searchTerm = `%${query}%`;

    // Count total matches
    const countResult = await this.first<{ total: number }>(
      'SELECT COUNT(*) as total FROM analytics_messages WHERE content LIKE ? AND is_archived = 0',
      [searchTerm]
    );

    const total = countResult?.total ?? 0;

    // Get paginated results
    const data = await this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE content LIKE ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [searchTerm, pageSize, offset]
    );

    return { data, total, page, pageSize, hasMore: offset + data.length < total };
  }

  /**
   * Get the most recent messages across all sessions
   * @param options Either a limit number or an options object with limit and since timestamp
   * @returns Array of recent messages
   */
  async getRecentMessages(
    options: number | { limit?: number; since?: number } = 50
  ): Promise<AnalyticsMessage[]> {
    const opts = typeof options === 'number' ? { limit: options } : options;
    const limit = opts.limit ?? 50;
    const since = opts.since;

    if (since) {
      // Return messages created after the given timestamp
      return this.all<AnalyticsMessage>(
        'SELECT * FROM analytics_messages WHERE is_archived = 0 AND created_at > ? ORDER BY created_at ASC LIMIT ?',
        [since, limit]
      );
    }

    return this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE is_archived = 0 ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Set visibility of a message
   * NOTE: Updates go to chat_messages (source table)
   * @param messageId Message identifier
   * @param visibility Visibility level
   */
  async setVisibility(
    messageId: string,
    visibility: 'private' | 'public' | 'unlisted'
  ): Promise<void> {
    await this.run('UPDATE chat_messages SET visibility = ?, updated_at = ? WHERE message_id = ?', [
      visibility,
      Date.now(),
      messageId,
    ]);
  }

  /**
   * Set visibility for all messages in a session
   * NOTE: Updates go to chat_messages (source table)
   * @param sessionId Session identifier (acts as conversation_id)
   * @param visibility Visibility level
   */
  async setConversationVisibility(sessionId: string, visibility: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET visibility = ?, updated_at = ? WHERE session_id = ? AND COALESCE(is_archived, 0) = 0',
      [visibility, Date.now(), sessionId]
    );
  }

  /**
   * Archive a message (soft-delete)
   * NOTE: Updates go to chat_messages (source table)
   * @param messageId Message identifier
   */
  async archiveMessage(messageId: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET is_archived = 1, updated_at = ? WHERE message_id = ?',
      [Date.now(), messageId]
    );
  }

  /**
   * Archive all messages in a session
   * NOTE: Updates go to chat_messages (source table)
   * @param sessionId Session identifier
   */
  async archiveSession(sessionId: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET is_archived = 1, updated_at = ? WHERE session_id = ? AND COALESCE(is_archived, 0) = 0',
      [Date.now(), sessionId]
    );
  }

  /**
   * Unarchive a message
   * NOTE: Updates go to chat_messages (source table)
   * @param messageId Message identifier
   */
  async unarchiveMessage(messageId: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET is_archived = 0, updated_at = ? WHERE message_id = ?',
      [Date.now(), messageId]
    );
  }

  /**
   * Pin or unpin a message
   * NOTE: Updates go to chat_messages (source table)
   * @param messageId Message identifier
   * @param pinned True to pin, false to unpin
   */
  async pinMessage(messageId: string, pinned: boolean): Promise<void> {
    await this.run('UPDATE chat_messages SET is_pinned = ?, updated_at = ? WHERE message_id = ?', [
      pinned ? 1 : 0,
      Date.now(),
      messageId,
    ]);
  }

  /**
   * Get statistics for a session
   * @param sessionId Session identifier
   * @returns Session statistics
   */
  async getSessionStats(sessionId: string): Promise<SessionStats | null> {
    const result = await this.first<{
      message_count: number;
      user_message_count: number;
      assistant_message_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
      first_message_at: number;
      last_message_at: number;
    }>(
      `SELECT
        COUNT(*) as message_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_message_count,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        MIN(created_at) as first_message_at,
        MAX(created_at) as last_message_at
      FROM analytics_messages
      WHERE session_id = ? AND is_archived = 0`,
      [sessionId]
    );

    if (!result) {
      return null;
    }

    return {
      sessionId,
      messageCount: result.message_count,
      userMessages: result.user_message_count,
      assistantMessages: result.assistant_message_count,
      totalInputTokens: result.total_input_tokens,
      totalOutputTokens: result.total_output_tokens,
      totalTokens: result.total_input_tokens + result.total_output_tokens,
      firstMessageAt: result.first_message_at,
      lastMessageAt: result.last_message_at,
      durationMs: result.last_message_at - result.first_message_at,
    };
  }

  /**
   * Get statistics for a user within a date range
   * @param userId User identifier
   * @param dateRange Optional date range filter
   * @returns User statistics
   */
  async getUserStats(userId: string, dateRange?: DateRange): Promise<UserStats | null> {
    const params: unknown[] = [userId];
    let sql = `SELECT
      COUNT(*) as message_count,
      COUNT(DISTINCT session_id) as session_count,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
    FROM analytics_messages
    WHERE user_id = ? AND is_archived = 0`;

    if (dateRange) {
      sql += ` AND created_at >= ? AND created_at <= ?`;
      params.push(dateRange.from, dateRange.to);
    }

    const result = await this.first<{
      message_count: number;
      session_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_tokens: number;
    }>(sql, params);

    if (!result) {
      return null;
    }

    return {
      userId,
      messageCount: result.message_count,
      sessionCount: result.session_count,
      totalInputTokens: result.total_input_tokens,
      totalOutputTokens: result.total_output_tokens,
      totalTokens: result.total_tokens,
      estimatedCostUsd: 0, // TODO: Calculate based on cost config
    };
  }

  /**
   * Get the next sequence number for a session
   * NOTE: Reads from chat_messages (source table) for accuracy
   * @param sessionId Session identifier
   * @returns Next available sequence number
   */
  async getNextSequence(sessionId: string): Promise<number> {
    const result = await this.first<{ max_seq: number | null }>(
      'SELECT MAX(sequence) as max_seq FROM chat_messages WHERE session_id = ?',
      [sessionId]
    );

    return (result?.max_seq ?? -1) + 1;
  }

  /**
   * Get global statistics across all users and sessions
   * Used for dashboard overview without requiring a userId
   * @returns Global statistics
   */
  async getGlobalStats(): Promise<{
    totalMessages: number;
    totalSessions: number;
    totalUsers: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    platformBreakdown: { platform: string; count: number }[];
  }> {
    const statsResult = await this.first<{
      total_messages: number;
      total_sessions: number;
      total_users: number;
      total_input_tokens: number;
      total_output_tokens: number;
    }>(
      `SELECT
        COUNT(*) as total_messages,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT user_id) as total_users,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens
      FROM analytics_messages
      WHERE is_archived = 0`
    );

    const platformResults = await this.all<{ platform: string; count: number }>(
      `SELECT platform, COUNT(*) as count
      FROM analytics_messages
      WHERE is_archived = 0
      GROUP BY platform
      ORDER BY count DESC`
    );

    return {
      totalMessages: statsResult?.total_messages ?? 0,
      totalSessions: statsResult?.total_sessions ?? 0,
      totalUsers: statsResult?.total_users ?? 0,
      totalInputTokens: statsResult?.total_input_tokens ?? 0,
      totalOutputTokens: statsResult?.total_output_tokens ?? 0,
      totalTokens: (statsResult?.total_input_tokens ?? 0) + (statsResult?.total_output_tokens ?? 0),
      platformBreakdown: platformResults,
    };
  }
}
