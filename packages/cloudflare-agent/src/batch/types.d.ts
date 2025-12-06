/**
 * Re-exports and extended types for batch processing
 *
 * This module re-exports types from batch-types.ts for convenience and defines
 * additional types used by BatchQueue, StuckDetector, and ContextBuilder classes.
 */
export type {
  BatchConfig,
  BatchState,
  BatchStatus,
  EnhancedBatchState,
  HeartbeatConfig,
  MessageStage,
  PendingMessage,
  RetryConfig,
  RetryError,
  StageTransition,
  StuckCheckResult,
} from '../batch-types.js';
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
/**
 * Result of message queuing operation
 */
export interface QueueResult {
  /** Whether the message was successfully queued */
  queued: boolean;
  /** Batch ID if message was queued */
  batchId?: string;
  /** Whether batch was recovered from stuck state */
  recoveredFromStuck?: boolean;
}
/**
 * Result of receiveMessage operation
 */
export interface ReceiveMessageResult extends QueueResult {
  /** Trace ID for correlation and observability */
  traceId: string;
}
/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  /** Platform name (telegram, github, etc.) */
  platform?: string;
}
/**
 * Type for state getter callback
 */
export type StateGetter<TState> = () => TState;
/**
 * Type for state setter callback
 */
export type StateSetter<TState> = (update: Partial<TState>) => void;
//# sourceMappingURL=types.d.ts.map
