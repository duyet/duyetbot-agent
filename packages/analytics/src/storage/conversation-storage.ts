/**
 * Analytics Conversation Storage
 *
 * Architecture (Centralized Data Monitoring):
 * - READ operations use `analytics_conversations` view (aggregated from chat_messages)
 * - WRITE operations are limited since conversations are computed views
 * - The view `analytics_conversations` is an alias to `analytics_conversations_view` (created in migration 0009)
 *
 * Note: Conversation data is derived from chat_messages grouped by session_id.
 * To modify conversation metadata (like title/summary), we would need to add
 * a separate metadata table or store it in chat_messages.
 */

import type { AnalyticsConversation } from '../types.js';
import { BaseStorage } from './base.js';

/**
 * ConversationStorage handles D1 operations for conversation metadata.
 * Reads from the analytics_conversations view which aggregates chat_messages data.
 */
export class ConversationStorage extends BaseStorage {
  /**
   * Get a conversation by ID.
   *
   * NOTE: Conversations are now computed views from chat_messages.
   * A "conversation" exists as soon as messages exist with that session_id.
   * This method returns the existing conversation if found, or a default structure if not.
   *
   * @param conversationId Conversation identifier (same as session_id)
   * @param userId User identifier (for default structure)
   * @param platform Platform type (for default structure)
   * @returns Conversation data
   */
  async getOrCreate(
    conversationId: string,
    userId: string,
    platform: 'telegram' | 'github' | 'cli' | 'api'
  ): Promise<AnalyticsConversation> {
    // Try to get existing conversation from view
    const existing = await this.getConversationById(conversationId);
    if (existing) {
      return existing;
    }

    // Return a default structure for non-existent conversations
    // The conversation will appear in the view once messages are added
    const now = Date.now();
    return {
      id: 0,
      conversationId,
      userId,
      platform,
      visibility: 'private',
      isArchived: false,
      isStarred: false,
      messageCount: 0,
      sessionCount: 0,
      totalTokens: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get conversation by ID
   * @param conversationId Conversation identifier
   * @returns Conversation if found, null otherwise
   */
  async getConversationById(conversationId: string): Promise<AnalyticsConversation | null> {
    const result = await this.first<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE conversation_id = ?',
      [conversationId]
    );

    return result || null;
  }

  /**
   * Get all conversations for a user
   * @param userId User identifier
   * @returns Array of conversations
   */
  async getConversationsByUser(userId: string): Promise<AnalyticsConversation[]> {
    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC',
      [userId]
    );
  }

  /**
   * Get active conversations for a user (those updated recently)
   * @param userId User identifier
   * @param days Number of days to look back
   * @param limit Maximum number to return
   * @returns Array of active conversations
   */
  async getActiveConversationsByUser(
    userId: string,
    days: number = 7,
    limit: number = 100
  ): Promise<AnalyticsConversation[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE user_id = ? AND is_archived = 0 AND updated_at > ? ORDER BY updated_at DESC LIMIT ?',
      [userId, cutoff, limit]
    );
  }

  /**
   * Set conversation visibility by updating all messages in the session.
   * NOTE: Updates go to chat_messages (source table).
   * @param conversationId Conversation identifier (session_id)
   * @param visibility Visibility level
   */
  async setVisibility(
    conversationId: string,
    visibility: 'private' | 'public' | 'unlisted'
  ): Promise<void> {
    await this.run('UPDATE chat_messages SET visibility = ?, updated_at = ? WHERE session_id = ?', [
      visibility,
      Date.now(),
      conversationId,
    ]);
  }

  /**
   * Archive a conversation by archiving all its messages.
   * NOTE: Updates go to chat_messages (source table).
   * @param conversationId Conversation identifier (session_id)
   */
  async archive(conversationId: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET is_archived = 1, updated_at = ? WHERE session_id = ?',
      [Date.now(), conversationId]
    );
  }

  /**
   * Unarchive a conversation by unarchiving all its messages.
   * NOTE: Updates go to chat_messages (source table).
   * @param conversationId Conversation identifier (session_id)
   */
  async unarchive(conversationId: string): Promise<void> {
    await this.run(
      'UPDATE chat_messages SET is_archived = 0, updated_at = ? WHERE session_id = ?',
      [Date.now(), conversationId]
    );
  }

  /**
   * Star or unstar a conversation.
   * NOTE: This functionality requires storing metadata outside the view.
   * Currently implemented by updating is_pinned on all messages.
   * @param conversationId Conversation identifier (session_id)
   * @param starred True to star, false to unstar
   */
  async star(conversationId: string, starred: boolean): Promise<void> {
    // Use is_pinned on messages as a proxy for "starred conversation"
    await this.run('UPDATE chat_messages SET is_pinned = ?, updated_at = ? WHERE session_id = ?', [
      starred ? 1 : 0,
      Date.now(),
      conversationId,
    ]);
  }

  /**
   * Update conversation title.
   * NOTE: Conversation title/summary are not directly supported in the view architecture.
   * This is a no-op placeholder. Consider adding a conversation_metadata table if needed.
   * @param conversationId Conversation identifier
   * @param title New title
   */
  async setTitle(_conversationId: string, _title: string): Promise<void> {
    // No-op: Conversation titles are not supported in view-based architecture
    // TODO: Add conversation_metadata table if title/summary storage is needed
    console.warn('setTitle: Not supported in view-based architecture');
  }

  /**
   * Update conversation summary.
   * NOTE: Conversation title/summary are not directly supported in the view architecture.
   * This is a no-op placeholder. Consider adding a conversation_metadata table if needed.
   * @param conversationId Conversation identifier
   * @param summary New summary
   */
  async setSummary(_conversationId: string, _summary: string): Promise<void> {
    // No-op: Conversation summaries are not supported in view-based architecture
    // TODO: Add conversation_metadata table if title/summary storage is needed
    console.warn('setSummary: Not supported in view-based architecture');
  }

  /**
   * Get conversation statistics.
   * NOTE: Stats are now computed by the view directly from chat_messages.
   * This method just returns the view data.
   * @param conversationId Conversation identifier (session_id)
   */
  async updateStats(conversationId: string): Promise<void> {
    // Stats are now computed by the view - this is a no-op
    // Just verify the conversation exists
    const exists = await this.getConversationById(conversationId);
    if (!exists) {
      console.warn(`updateStats: Conversation ${conversationId} not found`);
    }
    // View automatically reflects current state - no manual update needed
  }

  /**
   * Get starred conversations for a user
   * @param userId User identifier
   * @returns Array of starred conversations
   */
  async getStarredConversations(userId: string): Promise<AnalyticsConversation[]> {
    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE user_id = ? AND is_starred = 1 AND is_archived = 0 ORDER BY updated_at DESC',
      [userId]
    );
  }

  /**
   * Get top conversations by token usage
   * @param limit Maximum number to return
   * @returns Array of conversations
   */
  async getTopConversationsByTokens(limit: number = 50): Promise<AnalyticsConversation[]> {
    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE is_archived = 0 ORDER BY total_tokens DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Get conversations by platform
   * @param platform Platform type
   * @param limit Maximum number to return
   * @returns Array of conversations
   */
  async getConversationsByPlatform(
    platform: string,
    limit: number = 100
  ): Promise<AnalyticsConversation[]> {
    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE platform = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT ?',
      [platform, limit]
    );
  }

  /**
   * Get recent conversations across all users
   * @param limit Maximum number to return
   * @returns Array of recent conversations
   */
  async getRecentConversations(limit: number = 50): Promise<AnalyticsConversation[]> {
    return this.all<AnalyticsConversation>(
      'SELECT * FROM analytics_conversations WHERE is_archived = 0 ORDER BY updated_at DESC LIMIT ?',
      [limit]
    );
  }
}
