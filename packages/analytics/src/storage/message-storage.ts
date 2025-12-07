/**
 * Analytics Message Storage
 * Provides TypeScript interface to analytics_messages table
 * Append-only semantics - messages are never deleted, only archived
 */

import type {
  AnalyticsMessage,
  MessageCreateInput,
  MessageQueryFilter,
} from '../types.js';
import { BaseStorage } from './base.js';

/**
 * Session statistics
 */
export interface SessionStats {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  activeMessageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalReasoningTokens: number;
  firstMessageAt: number;
  lastMessageAt: number;
  sessionDurationMs: number;
}

/**
 * User statistics
 */
export interface UserStats {
  userId: string;
  messageCount: number;
  sessionCount: number;
  totalTokens: number;
  userMessages: number;
  assistantMessages: number;
  startTime: number;
  endTime: number;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Date range filter
 */
export interface DateRange {
  startTime: number;
  endTime: number;
}

/**
 * Query options
 */
export interface QueryOptions extends PaginationOptions {
  filters?: MessageQueryFilter;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

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
    return messages[0];
  }

  /**
   * Create multiple messages in batch (more efficient)
   * @param inputs Array of message creation inputs
   * @returns Array of created messages
   */
  async createMessages(
    inputs: MessageCreateInput[]
  ): Promise<AnalyticsMessage[]> {
    if (inputs.length === 0) {
      return [];
    }

    const now = Date.now();

    // Get max sequence for each session first
    const sessionSequences = new Map<string, number>();

    for (const input of inputs) {
      if (!sessionSequences.has(input.sessionId)) {
        const result = await this.first<{ max_seq: number | null }>(
          'SELECT MAX(sequence) as max_seq FROM analytics_messages WHERE session_id = ?',
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
      const totalTokens =
        (input.inputTokens || 0) +
        (input.outputTokens || 0) +
        (input.cachedTokens || 0) +
        (input.reasoningTokens || 0);

      const message = await this.first<AnalyticsMessage>(
        `INSERT INTO analytics_messages (
          message_id, session_id, conversation_id, parent_message_id,
          sequence, role, content,
          visibility, is_archived, is_pinned,
          event_id, trigger_message_id, platform_message_id,
          platform, user_id, username, chat_id, repo,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          model, created_at, updated_at, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING *`,
        [
          messageId,
          input.sessionId,
          input.conversationId ?? null,
          input.parentMessageId ?? null,
          sequence,
          input.role,
          input.content,
          input.visibility ?? 'private',
          0,
          0,
          input.eventId ?? null,
          input.triggerMessageId ?? null,
          input.platformMessageId ?? null,
          input.platform,
          input.userId,
          input.username ?? null,
          input.chatId ?? null,
          input.repo ?? null,
          input.inputTokens ?? 0,
          input.outputTokens ?? 0,
          input.cachedTokens ?? 0,
          input.reasoningTokens ?? 0,
          input.model ?? null,
          now,
          now,
          input.metadata ? JSON.stringify(input.metadata) : null,
        ]
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
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // Get total count
    const countResult = await this.first<{ total: number }>(
      'SELECT COUNT(*) as total FROM analytics_messages WHERE user_id = ? AND is_archived = 0',
      [userId]
    );

    const total = countResult?.total ?? 0;

    // Get paginated results
    const data = await this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE user_id = ? AND is_archived = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );

    return { data, total, limit, offset };
  }

  /**
   * Get all messages in a conversation
   * @param conversationId Conversation identifier
   * @returns Array of messages ordered by sequence
   */
  async getMessagesByConversation(
    conversationId: string
  ): Promise<AnalyticsMessage[]> {
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
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
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
      [searchTerm, limit, offset]
    );

    return { data, total, limit, offset };
  }

  /**
   * Get the most recent messages across all sessions
   * @param limit Maximum number of messages to return
   * @returns Array of recent messages
   */
  async getRecentMessages(limit: number = 50): Promise<AnalyticsMessage[]> {
    return this.all<AnalyticsMessage>(
      'SELECT * FROM analytics_messages WHERE is_archived = 0 ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Set visibility of a message
   * @param messageId Message identifier
   * @param visibility Visibility level
   */
  async setVisibility(
    messageId: string,
    visibility: 'private' | 'public' | 'unlisted'
  ): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET visibility = ?, updated_at = ? WHERE message_id = ?',
      [visibility, Date.now(), messageId]
    );
  }

  /**
   * Set visibility for all messages in a conversation
   * @param conversationId Conversation identifier
   * @param visibility Visibility level
   */
  async setConversationVisibility(
    conversationId: string,
    visibility: string
  ): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET visibility = ?, updated_at = ? WHERE conversation_id = ? AND is_archived = 0',
      [visibility, Date.now(), conversationId]
    );
  }

  /**
   * Archive a message (soft-delete)
   * @param messageId Message identifier
   */
  async archiveMessage(messageId: string): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET is_archived = 1, updated_at = ? WHERE message_id = ?',
      [Date.now(), messageId]
    );
  }

  /**
   * Archive all messages in a session
   * @param sessionId Session identifier
   */
  async archiveSession(sessionId: string): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET is_archived = 1, updated_at = ? WHERE session_id = ? AND is_archived = 0',
      [Date.now(), sessionId]
    );
  }

  /**
   * Unarchive a message
   * @param messageId Message identifier
   */
  async unarchiveMessage(messageId: string): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET is_archived = 0, updated_at = ? WHERE message_id = ?',
      [Date.now(), messageId]
    );
  }

  /**
   * Pin or unpin a message
   * @param messageId Message identifier
   * @param pinned True to pin, false to unpin
   */
  async pinMessage(messageId: string, pinned: boolean): Promise<void> {
    await this.run(
      'UPDATE analytics_messages SET is_pinned = ?, updated_at = ? WHERE message_id = ?',
      [pinned ? 1 : 0, Date.now(), messageId]
    );
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
      active_message_count: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_cached_tokens: number;
      total_reasoning_tokens: number;
      first_message_at: number;
      last_message_at: number;
    }>(
      `SELECT
        COUNT(*) as message_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_message_count,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_message_count,
        SUM(CASE WHEN is_archived = 0 THEN 1 ELSE 0 END) as active_message_count,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(cached_tokens), 0) as total_cached_tokens,
        COALESCE(SUM(reasoning_tokens), 0) as total_reasoning_tokens,
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
      messageCount: result.message_count,
      userMessageCount: result.user_message_count,
      assistantMessageCount: result.assistant_message_count,
      activeMessageCount: result.active_message_count,
      totalInputTokens: result.total_input_tokens,
      totalOutputTokens: result.total_output_tokens,
      totalCachedTokens: result.total_cached_tokens,
      totalReasoningTokens: result.total_reasoning_tokens,
      firstMessageAt: result.first_message_at,
      lastMessageAt: result.last_message_at,
      sessionDurationMs: result.last_message_at - result.first_message_at,
    };
  }

  /**
   * Get statistics for a user within a date range
   * @param userId User identifier
   * @param dateRange Optional date range filter
   * @returns User statistics
   */
  async getUserStats(
    userId: string,
    dateRange?: DateRange
  ): Promise<UserStats | null> {
    const params: unknown[] = [userId];
    let sql = `SELECT
      COUNT(*) as message_count,
      COUNT(DISTINCT session_id) as session_count,
      COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_messages,
      SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
      MIN(created_at) as start_time,
      MAX(created_at) as end_time
    FROM analytics_messages
    WHERE user_id = ? AND is_archived = 0`;

    if (dateRange) {
      sql += ` AND created_at >= ? AND created_at <= ?`;
      params.push(dateRange.startTime, dateRange.endTime);
    }

    const result = await this.first<{
      message_count: number;
      session_count: number;
      total_tokens: number;
      user_messages: number;
      assistant_messages: number;
      start_time: number;
      end_time: number;
    }>(sql, params);

    if (!result) {
      return null;
    }

    return {
      userId,
      messageCount: result.message_count,
      sessionCount: result.session_count,
      totalTokens: result.total_tokens,
      userMessages: result.user_messages,
      assistantMessages: result.assistant_messages,
      startTime: result.start_time,
      endTime: result.end_time,
    };
  }

  /**
   * Get the next sequence number for a session
   * @param sessionId Session identifier
   * @returns Next available sequence number
   */
  async getNextSequence(sessionId: string): Promise<number> {
    const result = await this.first<{ max_seq: number | null }>(
      'SELECT MAX(sequence) as max_seq FROM analytics_messages WHERE session_id = ?',
      [sessionId]
    );

    return (result?.max_seq ?? -1) + 1;
  }
}
