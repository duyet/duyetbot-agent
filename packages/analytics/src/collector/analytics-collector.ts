/**
 * AnalyticsCollector
 *
 * Integrates with CloudflareChatAgent to capture all messages and agent steps
 * for persistent analytics and observability.
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
   */
  private async getNextSequence(sessionId: string): Promise<number> {
    // Check cache first
    let seq = this.sequenceCounters.get(sessionId);
    if (seq !== undefined) {
      seq++;
      this.sequenceCounters.set(sessionId, seq);
      return seq;
    }

    // Query DB for max sequence
    const result = (await this.db
      .prepare('SELECT MAX(sequence) as max_seq FROM analytics_messages WHERE session_id = ?')
      .bind(sessionId)
      .first()) as { max_seq: number | null } | null;

    const maxSeq = result?.max_seq ?? -1;
    seq = maxSeq + 1;
    this.sequenceCounters.set(sessionId, seq);
    return seq;
  }

  /**
   * Hash content for deduplication checking
   * Returns first 16 chars of SHA-256 hash
   */
  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 16);
  }

  /**
   * Capture a user message when received
   * Returns the generated message_id for correlation
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

    // Create content hash for dedup checking
    const contentHash = await this.hashContent(input.content);

    try {
      await this.db
        .prepare(
          `
        INSERT INTO analytics_messages (
          message_id, session_id, sequence, role, content, content_hash,
          visibility, is_archived, is_pinned,
          event_id, platform_message_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, username, chat_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          'user',
          input.content,
          contentHash,
          'private',
          0, // is_archived
          0, // is_pinned
          input.eventId ?? null,
          input.platformMessageId ?? null,
          0,
          0,
          0,
          0, // tokens (user messages don't have token counts)
          input.platform,
          input.userId,
          input.username ?? null,
          input.chatId ?? null,
          now,
          now
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
    const contentHash = await this.hashContent(input.content);

    try {
      await this.db
        .prepare(
          `
        INSERT INTO analytics_messages (
          message_id, session_id, sequence, role, content, content_hash,
          visibility, is_archived, is_pinned,
          event_id, trigger_message_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, model,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          'assistant',
          input.content,
          contentHash,
          'private',
          0,
          0,
          input.eventId ?? null,
          input.triggerMessageId,
          input.inputTokens,
          input.outputTokens,
          input.cachedTokens ?? 0,
          input.reasoningTokens ?? 0,
          input.platform,
          input.userId,
          input.model ?? null,
          now,
          now
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
    const contentHash = await this.hashContent(input.content);

    try {
      await this.db
        .prepare(
          `
        INSERT INTO analytics_messages (
          message_id, session_id, sequence, role, content, content_hash,
          visibility, is_archived, is_pinned,
          event_id, parent_message_id,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          platform, user_id, model,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          messageId,
          input.sessionId,
          sequence,
          input.role,
          input.content,
          contentHash,
          'private',
          0,
          0,
          input.eventId ?? null,
          input.parentMessageId ?? null,
          0,
          0,
          0,
          0,
          input.platform,
          input.userId,
          input.model ?? null,
          now,
          now
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
   * @param stepId Step ID from startAgentStep
   * @param completion Step completion data
   * @throws If stepId is not found in pending steps
   */
  async completeAgentStep(stepId: string, completion: StepCompletion): Promise<void> {
    const pending = this.pendingSteps.get(stepId);
    if (!pending) {
      console.warn(`No pending step found for stepId: ${stepId}`);
      return;
    }

    const completedAt = Date.now();
    const durationMs = completedAt - pending.startedAt;

    try {
      await this.db
        .prepare(
          `
        INSERT INTO analytics_agent_steps (
          step_id, event_id, message_id, parent_step_id,
          agent_name, agent_type, sequence,
          started_at, completed_at, duration_ms, queue_time_ms,
          status,
          input_tokens, output_tokens, cached_tokens, reasoning_tokens,
          error_type, error_message, retry_count,
          model, tools_used, tool_calls_count,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          pending.stepId,
          pending.eventId,
          pending.messageId ?? null,
          pending.parentStepId ?? null,
          pending.agentName,
          pending.agentType,
          pending.sequence,
          pending.startedAt,
          completedAt,
          durationMs,
          0, // queue_time_ms (computed later)
          completion.status,
          completion.inputTokens,
          completion.outputTokens,
          completion.cachedTokens ?? 0,
          completion.reasoningTokens ?? 0,
          completion.errorType ?? null,
          completion.errorMessage ?? null,
          0, // retry_count
          completion.model ?? null,
          completion.toolsUsed ? JSON.stringify(completion.toolsUsed) : null,
          completion.toolCallsCount ?? 0,
          Date.now()
        )
        .run();
    } catch (error) {
      console.error(`Failed to complete agent step ${stepId}:`, error);
      throw error;
    }

    this.pendingSteps.delete(stepId);
  }

  /**
   * Batch capture multiple messages for efficiency
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
      const stmt = this.db.prepare(
        `
      INSERT INTO analytics_messages (
        message_id, session_id, sequence, role, content, content_hash,
        visibility, is_archived, is_pinned,
        event_id, trigger_message_id, parent_message_id, platform_message_id,
        input_tokens, output_tokens, cached_tokens, reasoning_tokens,
        platform, user_id, username, chat_id, model,
        created_at, updated_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      );

      const batch: D1PreparedStatement[] = [];
      const now = Date.now();

      for (const msg of messages) {
        const messageId = this.generateMessageId();
        const sequence = await this.getNextSequence(msg.sessionId);
        const contentHash = await this.hashContent(msg.content);

        batch.push(
          stmt.bind(
            messageId,
            msg.sessionId,
            sequence,
            msg.role,
            msg.content,
            contentHash,
            msg.visibility ?? 'private',
            0, // is_archived
            0, // is_pinned
            msg.eventId ?? null,
            msg.triggerMessageId ?? null,
            msg.parentMessageId ?? null,
            msg.platformMessageId ?? null,
            msg.inputTokens ?? 0,
            msg.outputTokens ?? 0,
            msg.cachedTokens ?? 0,
            msg.reasoningTokens ?? 0,
            msg.platform,
            msg.userId,
            msg.username ?? null,
            msg.chatId ?? null,
            msg.model ?? null,
            now,
            now,
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
   *
   * @param messageId Message ID to archive
   */
  async archiveMessage(messageId: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        UPDATE analytics_messages
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
   *
   * @param messageId Message ID to pin
   */
  async pinMessage(messageId: string): Promise<void> {
    try {
      await this.db
        .prepare(
          `
        UPDATE analytics_messages
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
        UPDATE analytics_messages
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
