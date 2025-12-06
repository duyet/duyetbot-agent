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
import type { CloudflareAgentState } from '../cloudflare-agent.js';
import { StuckDetector } from './stuck-detector.js';
import { type BatchConfig, type BatchState, type QueueResult } from './types.js';
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
export declare class BatchQueue<TContext = unknown> {
  private _getState;
  private _setState;
  private stuckDetector;
  /**
   * Create a BatchQueue instance
   *
   * @param getState - Callback to get current CloudflareAgentState
   * @param setState - Callback to update CloudflareAgentState
   * @param stuckDetector - StuckDetector instance for hung batch recovery
   * @param config - Optional batch configuration
   */
  constructor(
    _getState: () => {
      activeBatch?: BatchState;
      pendingBatch?: BatchState;
      processedRequestIds?: string[];
    },
    _setState: (update: Partial<CloudflareAgentState>) => void,
    stuckDetector: StuckDetector,
    _config?: BatchConfig
  );
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
  ): QueueResult;
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
  promoteToActive(): BatchState | null;
  /**
   * Clear the active batch (after processing completes)
   *
   * @example
   * ```typescript
   * // After successful processing
   * queue.clearActiveBatch();
   * ```
   */
  clearActiveBatch(): void;
  /**
   * Get current queue state
   *
   * @returns Object with activeBatch and pendingBatch (only if defined)
   */
  getCurrentState(): {
    activeBatch?: BatchState;
    pendingBatch?: BatchState;
  };
  /**
   * Check if there is currently an active batch being processed
   *
   * @returns True if activeBatch exists and is not stuck
   */
  hasActiveProcessing(): boolean;
  /**
   * Check if there are pending messages waiting to be processed
   *
   * @returns True if pendingBatch has messages
   */
  hasPendingMessages(): boolean;
  /**
   * Clear the active batch (internal helper)
   *
   * @param now - Current timestamp
   * @internal
   */
  private _clearActiveBatch;
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
  private _shouldScheduleAlarm;
}
//# sourceMappingURL=batch-queue.d.ts.map
