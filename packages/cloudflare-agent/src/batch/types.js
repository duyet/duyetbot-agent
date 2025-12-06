/**
 * Re-exports and extended types for batch processing
 *
 * This module re-exports types from batch-types.ts for convenience and defines
 * additional types used by BatchQueue, StuckDetector, and ContextBuilder classes.
 */
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
} from '../batch-types.js';
