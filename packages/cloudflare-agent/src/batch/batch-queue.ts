/**
 * Message queue manager for batch processing
 *
 * Implements a two-batch queue system:
 * - activeBatch: Currently being processed (immutable)
 * - pendingBatch: Collecting new messages (mutable)
 *
 * This separation ensures that while a batch is processing, new incoming
 * messages don't interfere with the active processing.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { CloudflareAgentState } from '../cloudflare-agent.js';
import { StuckDetector } from './stuck-detector.js';
import {
  type BatchConfig,
  type BatchState,
  createInitialBatchState,
  isDuplicateInBothBatches,
  type PendingMessage,
  type QueueResult,
} from './types.js';

/**
 * Message queue manager for the two-batch system
 *
 * Manages queueing messages to pendingBatch with:
 * - Deduplication across both active and pending batches
 * - Automatic stuck batch detection and recovery
 * - Alarm scheduling for batch processing
 * - State persistence via callbacks
 *
 * The queue uses callbacks for state access/mutation to remain stateless:
 * ```typescript
 * const queue = new BatchQueue(
 *   () => state,                    // getState callback
 *   (update) => setState(update),   // setState callback
 *   stuckDetector                   // StuckDetector instance
 * );
 * ```
 */
export class BatchQueue<TContext = unknown> {
  /**
   * Create a BatchQueue instance
   *
   * @param getState - Callback to get current CloudflareAgentState
   * @param setState - Callback to update CloudflareAgentState
   * @param stuckDetector - StuckDetector instance for hung batch recovery
   * @param config - Optional batch configuration
   */
  constructor(
    private _getState: () => {
      activeBatch?: BatchState;
      pendingBatch?: BatchState;
      processedRequestIds?: string[];
    },
    private _setState: (update: Partial<CloudflareAgentState>) => void,
    private stuckDetector: StuckDetector,
    _config?: BatchConfig
  ) {}

  /**
   * Queue a message to the pending batch
   *
   * Handles:
   * 1. Stuck batch detection and recovery
   * 2. Deduplication across both batches
   * 3. Creation of pending message with context
   * 4. State update and alarm scheduling
   *
   * @param input - Parsed input with text, userId, chatId
   * @param context - Original transport context for later reconstruction
   * @returns QueueResult with queued status and optional batchId
   *
   * @example
   * ```typescript
   * const result = await queue.queueMessage(
   *   { text: "hello", userId: 123, chatId: 456 },
   *   originalContext
   * );
   *
   * if (result.queued) {
   *   logger.info(`Message queued to batch ${result.batchId}`);
   * }
   * ```
   */
  queueMessage(
    input: {
      text: string;
      userId?: string | number;
      chatId?: string | number;
      metadata?: Record<string, unknown>;
    },
    context: TContext
  ): QueueResult {
    const state = this._getState();
    const requestId = (input.metadata?.requestId as string) || crypto.randomUUID();
    const now = Date.now();
    let recoveredFromStuck = false;

    // Detect and recover from stuck activeBatch
    if (state.activeBatch && this.stuckDetector.isStuck(state.activeBatch)) {
      logger.warn('[BatchQueue] Detected stuck activeBatch, recovering', {
        batchId: state.activeBatch.batchId,
        duration: this.stuckDetector.getStuckDuration(state.activeBatch),
      });

      // Clear stuck batch
      this._clearActiveBatch(now);
      recoveredFromStuck = true;
    }

    // Get or create pendingBatch
    const pendingBatch = state.pendingBatch ?? createInitialBatchState();

    // Check for duplicates across both batches
    if (isDuplicateInBothBatches(requestId, state.activeBatch, pendingBatch)) {
      logger.info(`[BatchQueue] Duplicate request ${requestId}, skipping`);
      return { queued: false };
    }

    // Extract eventId from metadata for observability
    const eventId = input.metadata?.eventId as string | undefined;

    // Create pending message with original context for transport operations
    // Build object conditionally to avoid strict null issues with exactOptionalPropertyTypes
    const pendingMessage: PendingMessage<TContext> = {
      text: input.text,
      timestamp: now,
      requestId,
      originalContext: context,
    };

    // Add optional fields only if defined
    if (input.userId !== undefined) {
      pendingMessage.userId = input.userId;
    }
    if (input.chatId !== undefined) {
      pendingMessage.chatId = input.chatId;
    }
    if (eventId) {
      pendingMessage.eventId = eventId;
    }

    // Add to pending batch
    pendingBatch.pendingMessages.push(pendingMessage);
    pendingBatch.lastMessageAt = now;

    // Initialize batch if first message
    if (pendingBatch.status === 'idle') {
      pendingBatch.status = 'collecting';
      pendingBatch.batchStartedAt = now;
      pendingBatch.batchId = crypto.randomUUID();
    }

    // Determine if alarm should be scheduled
    const shouldSchedule = this._shouldScheduleAlarm(
      pendingBatch,
      state.activeBatch,
      recoveredFromStuck
    );

    // Update state with new pendingBatch
    this._setState({
      pendingBatch,
      updatedAt: now,
    });

    logger.info('[BatchQueue] Message queued', {
      requestId,
      batchId: pendingBatch.batchId,
      pendingCount: pendingBatch.pendingMessages.length,
      hasActiveBatch: !!state.activeBatch,
      recoveredFromStuck,
      willScheduleAlarm: shouldSchedule,
    });

    const result: QueueResult = {
      queued: true,
      recoveredFromStuck,
    };

    if (pendingBatch.batchId) {
      result.batchId = pendingBatch.batchId;
    }

    return result;
  }

  /**
   * Promote pending batch to active batch atomically
   *
   * Called when batch alarm fires to transition from collecting to processing.
   * This operation is atomic - either the full transition happens or nothing.
   *
   * @returns Promoted batch state, or null if no pending batch
   *
   * @example
   * ```typescript
   * const activeBatch = queue.promoteToActive();
   * if (activeBatch) {
   *   // Start processing the batch
   * }
   * ```
   */
  promoteToActive(): BatchState | null {
    const queueState = this._getState();

    if (!queueState.pendingBatch || queueState.pendingBatch.status !== 'collecting') {
      return null;
    }

    const promotedBatch = {
      ...queueState.pendingBatch,
      status: 'processing' as const,
    };

    // Update state atomically - remove pendingBatch from state
    const { pendingBatch: _removed, ...restOfState } = queueState as any;
    this._setState({
      ...restOfState,
      activeBatch: promotedBatch,
      updatedAt: Date.now(),
    });

    logger.info('[BatchQueue] Promoted pendingBatch to active', {
      batchId: promotedBatch.batchId,
      messageCount: promotedBatch.pendingMessages.length,
    });

    return promotedBatch;
  }

  /**
   * Clear the active batch (after processing completes)
   *
   * @example
   * ```typescript
   * // After successful processing
   * queue.clearActiveBatch();
   * ```
   */
  clearActiveBatch(): void {
    this._clearActiveBatch(Date.now());
  }

  /**
   * Get current queue state
   *
   * @returns Object with activeBatch and pendingBatch (only if defined)
   */
  getCurrentState(): { activeBatch?: BatchState; pendingBatch?: BatchState } {
    const queueState = this._getState();
    const result: { activeBatch?: BatchState; pendingBatch?: BatchState } = {};

    if (queueState.activeBatch) {
      result.activeBatch = queueState.activeBatch;
    }
    if (queueState.pendingBatch) {
      result.pendingBatch = queueState.pendingBatch;
    }

    return result;
  }

  /**
   * Check if there is currently an active batch being processed
   *
   * @returns True if activeBatch exists and is not stuck
   */
  hasActiveProcessing(): boolean {
    const queueState = this._getState();
    if (!queueState.activeBatch) {
      return false;
    }

    // Don't report active if it's stuck
    return !this.stuckDetector.isStuck(queueState.activeBatch);
  }

  /**
   * Check if there are pending messages waiting to be processed
   *
   * @returns True if pendingBatch has messages
   */
  hasPendingMessages(): boolean {
    const queueState = this._getState();
    return (queueState.pendingBatch?.pendingMessages.length ?? 0) > 0;
  }

  /**
   * Clear the active batch (internal helper)
   *
   * @param now - Current timestamp
   * @internal
   */
  private _clearActiveBatch(now: number): void {
    const queueState = this._getState();
    const { activeBatch: _removed, ...restOfState } = queueState as any;
    this._setState({
      ...restOfState,
      updatedAt: now,
    });
  }

  /**
   * Determine if alarm should be scheduled
   *
   * Schedules if:
   * 1. No active batch AND first message (normal flow)
   * 2. Just recovered from stuck batch
   * 3. Orphaned pending batch (alarm lost due to deployment/hibernation)
   *
   * @param pendingBatch - Current pending batch
   * @param activeBatch - Current active batch
   * @param recoveredFromStuck - Whether just recovered from stuck
   * @returns True if alarm should be scheduled
   * @internal
   */
  private _shouldScheduleAlarm(
    pendingBatch: BatchState,
    activeBatch: BatchState | undefined,
    recoveredFromStuck: boolean
  ): boolean {
    const isFirstMessage = pendingBatch.pendingMessages.length === 1;
    const hasNoActiveProcessing = !activeBatch;

    // Normal case: no active processing and first message
    const shouldScheduleNormal = hasNoActiveProcessing && isFirstMessage;

    // Recovery case: just recovered from stuck
    const shouldScheduleAfterRecovery =
      recoveredFromStuck && pendingBatch.pendingMessages.length > 0;

    // Edge case: orphaned pending batch (alarm was lost)
    const hasOrphanedPendingBatch =
      hasNoActiveProcessing &&
      !isFirstMessage &&
      pendingBatch.pendingMessages.length > 0 &&
      pendingBatch.status === 'collecting';

    return shouldScheduleNormal || shouldScheduleAfterRecovery || hasOrphanedPendingBatch;
  }
}
