/**
 * AnalyticsCollector
 *
 * Integrates with CloudflareChatAgent to capture all messages and agent steps
 * for persistent analytics and observability.
 *
 * ARCHITECTURE NOTE (Centralized Data Monitoring):
 * - WRITE operations go to `chat_messages` table (source of truth)
 * - READ operations can use `analytics_messages` view (computed from chat_messages + observability_events)
 * - The `analytics_messages` is a VIEW (created in migration 0009), NOT a table
 * - Agent steps are now stored in observability_events.agents JSON (migration 0008)
 *
 * CRITICAL: This collector NEVER deletes data. All messages are append-only.
 */

import { v7 as uuidv7 } from 'uuid';
import type { MessageCreateInput, PendingStep, StepCompletion, StepCreateInput } from '../types.js';

// Cloudflare D1 Database type
type D1Database = any; // From @cloudflare/workers-types
type D1PreparedStatement = any; // From @cloudflare/workers-types

/**
 * AnalyticsCollector captures and persists analytics data
 * to Cloudflare D1 database
 */
export class AnalyticsCollector {
  private db: D1Database;
  private pendingSteps: Map<string, PendingStep> = new Map();
  private sequenceCounters: Map<string, number> = new Map();

  /**
   * Create a new AnalyticsCollector instance
   * @param db Cloudflare D1 database instance
   */
  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Generate a new message ID (UUID v7 for time-ordering)
   */
  generateMessageId(): string {
    return uuidv7();
  }

  /**
   * Generate a new step ID (UUID v7 for time-ordering)
   */
  generateStepId(): string {
    return uuidv7();
  }

  /**
   * Get next sequence number for a session
   * Maintains in-memory cache to avoid repeated database queries
   * NOTE: Reads from chat_messages (source table) for accuracy
   */
  private async getNextSequence(sessionId: string): Promise<number> {
    // Check cache first
    let seq = this.sequenceCounters.get(sessionId);
    if (seq !== undefined) {
      seq++;
      this.sequenceCounters.set(sessionId, seq);
      return seq;
    }

    // Query DB for max sequence (from source table, not view)
    const result = (await this.db
      .prepare('SELECT MAX(sequence) as max_seq FROM chat_messages WHERE session_id = ?')
      .bind(sessionId)
      .first()) as { max_seq: number | null } | null;

    const maxSeq = result?.max_seq ?? -1;
    seq = maxSeq + 1;
    this.sequenceCounters.set(sessionId, seq);
    return seq;
  }

  /**
   * Capture a user message when received
   * Returns the generated message_id for correlation
   *
   * ARCHITECTURE NOTE: Writes to `chat_messages` (source of truth).
   * The `analytics_messages` view provides enriched read access.
   *
   * @param input User message data
   * @returns Generated message ID (UUID v7)
   */
  async captureUserMessage(input: {
    sessionId: string;
    content: string;
    platform: 'telegram' | 'github' | 'cli' | 'api';
    userId: string;
    username?: string;
    chatId?: string;
    platformMessageId?: string;
    eventId?: string;
  }): Promise<string> {
    const messageId = this.generateMessageId();
    const sequence = await this.getNextSequence(input.sessionId);
    const now = Date.now();

    try {
      // Insert into chat_messages (source of truth)
      await this.db
        .prepare(
          `
        INSERT INTO chat_messages (
          message_id, session_id, sequence, role, content,
          visibility, is_archived, is_pinned,
          event_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, username, chat_id,
          timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          'user',
          input.content,
          'private',
          0, // is_archived
          0, // is_pinned
          input.eventId ?? null,
          0,
          0,
          0,
          0, // tokens (user messages don't have token counts)
          input.platform,
          input.userId,
          input.username ?? null,
          input.chatId ?? null,
          now, // timestamp
          now, // created_at
          now // updated_at
        )
        .run();
    } catch (error) {
      console.error('Failed to capture user message:', error);
      throw error;
    }

    return messageId;
  }

  /**
   * Capture an assistant response with token counts
   *
   * ARCHITECTURE NOTE: Writes to `chat_messages` (source of truth).
   * The `analytics_messages` view provides enriched read access.
   *
   * @param input Assistant response data
   * @returns Generated message ID (UUID v7)
   */
  async captureAssistantMessage(input: {
    sessionId: string;
    content: string;
    platform: 'telegram' | 'github' | 'cli' | 'api';
    userId: string;
    triggerMessageId: string;
    eventId?: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
    model?: string;
  }): Promise<string> {
    const messageId = this.generateMessageId();
    const sequence = await this.getNextSequence(input.sessionId);
    const now = Date.now();

    try {
      // Insert into chat_messages (source of truth)
      await this.db
        .prepare(
          `
        INSERT INTO chat_messages (
          message_id, session_id, sequence, role, content,
          visibility, is_archived, is_pinned,
          event_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, model,
          timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          'assistant',
          input.content,
          'private',
          0,
          0,
          input.eventId ?? null,
          input.inputTokens,
          input.outputTokens,
          input.cachedTokens ?? 0,
          input.reasoningTokens ?? 0,
          input.platform,
          input.userId,
          input.model ?? null,
          now, // timestamp
          now, // created_at
          now // updated_at
        )
        .run();
    } catch (error) {
      console.error('Failed to capture assistant message:', error);
      throw error;
    }

    return messageId;
  }

  /**
   * Capture a system or tool message
   *
   * ARCHITECTURE NOTE: Writes to `chat_messages` (source of truth).
   * The `analytics_messages` view provides enriched read access.
   *
   * @param input System/tool message data
   * @returns Generated message ID (UUID v7)
   */
  async captureSystemMessage(input: {
    sessionId: string;
    role: 'system' | 'tool';
    content: string;
    platform: 'telegram' | 'github' | 'cli' | 'api';
    userId: string;
    eventId?: string;
    parentMessageId?: string;
    model?: string;
  }): Promise<string> {
    const messageId = this.generateMessageId();
    const sequence = await this.getNextSequence(input.sessionId);
    const now = Date.now();

    try {
      // Insert into chat_messages (source of truth)
      await this.db
        .prepare(
          `
        INSERT INTO chat_messages (
          message_id, session_id, sequence, role, content,
          visibility, is_archived, is_pinned,
          event_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, model,
          timestamp, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          input.role,
          input.content,
          'private',
          0,
          0,
          input.eventId ?? null,
          0,
          0,
          0,
          0,
          input.platform,
          input.userId,
          input.model ?? null,
          now, // timestamp
          now, // created_at
          now // updated_at
        )
        .run();
    } catch (error) {
      console.error('Failed to capture system message:', error);
      throw error;
    }

    return messageId;
  }

  /**
   * Start tracking an agent step
   * Returns step ID for later completion
   *
   * @param input Step initialization data
   * @returns Generated step ID (UUID v7)
   */
  startAgentStep(input: StepCreateInput): string {
    const stepId = this.generateStepId();

    this.pendingSteps.set(stepId, {
      stepId,
      eventId: input.eventId,
      messageId: input.messageId ?? null,
      agentName: input.agentName,
      agentType: input.agentType,
      parentStepId: input.parentStepId ?? null,
      sequence: input.sequence,
      startedAt: Date.now(),
      status: 'running',
    });

    return stepId;
  }

  /**
   * Complete an agent step with results
   * Must call startAgentStep first to get stepId
   *
   * DEPRECATION NOTE: After migration 0009, analytics_agent_steps is a VIEW
   * computed from observability_events.agents JSON. Direct writes are no longer
   * supported. Agent step data should be written to observability_events.agents
   * via the ObservabilityStorage class instead.
   *
   * This method now logs a warning and cleans up pending state without writing
   * to the database. To track agent steps, update observability_events.agents JSON.
   *
   * @param stepId Step ID from startAgentStep
   * @param completion Step completion data
   */
  async completeAgentStep(stepId: string, _completion: StepCompletion): Promise<void> {
    const pending = this.pendingSteps.get(stepId);
    if (!pending) {
      console.warn(`No pending step found for stepId: ${stepId}`);
      return;
    }

    // Log deprecation warning - analytics_agent_steps is now a view
    console.warn(
      `[DEPRECATED] completeAgentStep: analytics_agent_steps is now a view. ` +
        `Agent step data should be written to observability_events.agents JSON. ` +
        `Step ${stepId} for agent "${pending.agentName}" was not persisted.`
    );

    // Clean up pending state
    this.pendingSteps.delete(stepId);
  }

  /**
   * Batch capture multiple messages for efficiency
   *
   * ARCHITECTURE NOTE: Writes to `chat_messages` (source of truth).
   * The `analytics_messages` view provides enriched read access.
   *
   * @param messages Array of message create inputs
   * @returns Array of generated message IDs
   */
  async captureMessages(messages: MessageCreateInput[]): Promise<string[]> {
    const messageIds: string[] = [];

    if (messages.length === 0) {
      return messageIds;
    }

    try {
      // Insert into chat_messages (source of truth)
      const stmt = this.db.prepare(
        `
      INSERT INTO chat_messages (
        message_id, session_id, sequence, role, content,
        visibility, is_archived, is_pinned,
        event_id,
        input_tokens, output_tokens, cached_tokens, reasoning_tokens,
        platform, user_id, username, chat_id, model,
        timestamp, created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      );

      const batch: D1PreparedStatement[] = [];
      const now = Date.now();

      for (const msg of messages) {
        const messageId = this.generateMessageId();
        const sequence = await this.getNextSequence(msg.sessionId);

        batch.push(
          stmt.bind(
            messageId,
            msg.sessionId,
            sequence,
            msg.role,
            msg.content,
            msg.visibility ?? 'private',
            0, // is_archived
            0, // is_pinned
            msg.eventId ?? null,
            msg.inputTokens ?? 0,
            msg.outputTokens ?? 0,
            msg.cachedTokens ?? 0,
            msg.reasoningTokens ?? 0,
            msg.platform,
            msg.userId,
            msg.username ?? null,
            msg.chatId ?? null,
            msg.model ?? null,
            now, // timestamp
            now, // created_at
            now, // updated_at
            msg.metadata ? JSON.stringify(msg.metadata) : null
          )
        );

        messageIds.push(messageId);
      }

      await this.db.batch(batch);
    } catch (error) {
      console.error('Failed to batch capture messages:', error);
      throw error;
    }

    return messageIds;
  }

  /**
   * Clear cached sequence counters
   * Useful for testing or memory management
   */
  clearSequenceCache(): void {
    this.sequenceCounters.clear();
  }

  /**
   * Get number of pending steps
   * Useful for monitoring
   */
  getPendingStepCount(): number {
    return this.pendingSteps.size;
  }

  /**
   * Get pending step IDs
   * Useful for monitoring/cleanup
   */
  getPendingStepIds(): string[] {
    return Array.from(this.pendingSteps.keys());
  }

  /**
   * Archive a message
   * Sets is_archived flag without deleting data
   * NOTE: Updates go to chat_messages (source table)
   *
   * @param messageId Message ID to archive
   */
  async archiveMessage(messageId: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        UPDATE chat_messages
        SET is_archived = 1, updated_at = ?
        WHERE message_id = ?
      `
        )
        .bind(Date.now(), messageId)
        .run();
    } catch (error) {
      console.error(`Failed to archive message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Pin a message
   * NOTE: Updates go to chat_messages (source table)
   *
   * @param messageId Message ID to pin
   */
  async pinMessage(messageId: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        UPDATE chat_messages
        SET is_pinned = 1, updated_at = ?
        WHERE message_id = ?
      `
        )
        .bind(Date.now(), messageId)
        .run();
    } catch (error) {
      console.error(`Failed to pin message ${messageId}:`, error);
      throw error;
    }
  }

  /**
   * Update message visibility
   * NOTE: Updates go to chat_messages (source table)
   *
   * @param messageId Message ID to update
   * @param visibility New visibility level
   */
  async setMessageVisibility(
    messageId: string,
    visibility: 'private' | 'public' | 'unlisted'
  ): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        UPDATE chat_messages
        SET visibility = ?, updated_at = ?
        WHERE message_id = ?
      `
        )
        .bind(visibility, Date.now(), messageId)
        .run();
    } catch (error) {
      console.error(`Failed to set visibility for message ${messageId}:`, error);
      throw error;
    }
  }
}
