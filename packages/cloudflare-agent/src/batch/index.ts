/**
 * Batch processing module
 *
 * Provides utilities for message batching, queue management, and batch processing:
 *
 * - **BatchProcessor**: Core batch processing logic with routing and chat
 * - **BatchQueue**: Two-batch message queue with stuck detection and recovery
 * - **StuckDetector**: Heartbeat-based stuck batch detection
 * - **ContextBuilder**: Platform context reconstruction from batch messages
 * - **Types**: Re-exports from batch-types.ts plus extended types
 *
 * @example
 * ```typescript
 * import { BatchProcessor, BatchQueue, StuckDetector, ContextBuilder } from '@duyetbot/cloudflare-agent/batch';
 *
 * const processor = new BatchProcessor({ thinkingMessages: ['Thinking...'] });
 * const detector = new StuckDetector(30000);
 * const queue = new BatchQueue(
 *   () => state,
 *   (update) => setState(update),
 *   detector
 * );
 *
 * const result = queue.queueMessage(input, ctx);
 * if (result.queued) {
 *   const procResult = await processor.process(batch, deps, env, 'telegram');
 *   logger.info(`Batch ${result.batchId} processed: ${procResult.success}`);
 * }
 * ```
 */

export type {
  BatchProcessingResult,
  BatchProcessorConfig,
  BatchProcessorDeps,
} from './batch-processor.js';
export { BatchProcessor, createBatchProcessor } from './batch-processor.js';
export { BatchQueue } from './batch-queue.js';
export { ContextBuilder, type Platform } from './context-builder.js';
export { StuckDetector } from './stuck-detector.js';

export type {
  BatchConfig,
  BatchState,
  // Re-exported from batch-types.ts
  BatchStatus,
  EnhancedBatchState,
  HeartbeatConfig,
  MessageStage,
  PendingMessage,
  PlatformConfig,
  QueueResult,
  ReceiveMessageResult,
  RetryConfig,
  RetryError,
  StageTransition,
  StateGetter,
  StateSetter,
  StuckCheckResult,
} from './types.js';

export {
  calculateRetryDelay,
  combineBatchMessages,
  createInitialBatchState,
  createInitialEnhancedBatchState,
  DEFAULT_BATCH_CONFIG,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  isBatchStuckByHeartbeat,
  isDuplicateInBothBatches,
  isDuplicateMessage,
  shouldProcessImmediately,
} from './types.js';
