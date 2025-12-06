/**
 * Types for message batching and alarm-based processing
 *
 * DEPRECATED: This module is part of the legacy architecture.
 * Legacy implementation kept for backward compatibility with cloudflare-agent.ts.
 *
 * This module defines types for combining rapid-fire messages within
 * a time window into a single LLM input, using Cloudflare Durable Object Alarms.
 * The new architecture uses ExecutionContext and AgentProvider for request handling.
 */
/**
 * Status of a message batch
 * - idle: No batch in progress
 * - collecting: Accumulating messages within time window
 * - processing: Batch is being processed by LLM
 * - completed: Batch completed successfully
 * - failed: Batch failed after max retries
 * - delegated: Batch delegated to another DO via fire-and-forget pattern
 */
export type BatchStatus =
  | 'idle'
  | 'collecting'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'delegated';
/**
 * Detailed stages for message lifecycle tracking with timestamps
 */
export type MessageStage =
  | 'queued'
  | 'scheduled'
  | 'processing'
  | 'routing'
  | 'llm_call'
  | 'sending'
  | 'done'
  | 'retrying'
  | 'failed'
  | 'notified';
/**
 * Stage transition with timestamp for observability debugging
 */
export interface StageTransition {
  stage: MessageStage;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
/**
 * A pending message waiting to be processed
 */
export interface PendingMessage<TContext = unknown> {
  /** Message text content */
  text: string;
  /** Timestamp when message was received */
  timestamp: number;
  /** Request ID for deduplication (short, for logging) */
  requestId: string;
  /**
   * Event ID for D1 observability correlation (full UUID)
   * Used to update the observability event when batch completes
   */
  eventId?: string;
  /** User ID who sent the message */
  userId?: string | number;
  /** Chat/conversation ID */
  chatId?: string | number;
  /** Username of the sender (for debug footer admin check) */
  username?: string;
  /**
   * Original context for transport operations
   * Stored as serialized JSON to preserve full context (e.g., bot token for Telegram)
   * This is required because processBatch needs the full context to send messages
   */
  originalContext?: TContext;
}
/**
 * State for batch processing
 */
export interface BatchState {
  /** Current status of the batch */
  status: BatchStatus;
  /** Messages waiting to be processed */
  pendingMessages: PendingMessage[];
  /** Unique batch ID (set when processing starts) */
  batchId: string | null;
  /** Number of retry attempts */
  retryCount: number;
  /** Reference to "Thinking..." message for editing */
  messageRef?: string | number;
  /** Last error message if failed */
  error?: string;
  /** Timestamp of last message added */
  lastMessageAt: number;
  /** Timestamp when batch started collecting */
  batchStartedAt: number;
  /** Heartbeat timestamp - updated every 5s during processing via ThinkingRotator */
  lastHeartbeat?: number | undefined;
}
/**
 * Enhanced BatchState with lifecycle tracking and retry support
 * Extends existing BatchState for backward compatibility
 */
export interface EnhancedBatchState extends BatchState {
  /** Current stage in message lifecycle */
  currentStage: MessageStage;
  /** History of all stage transitions with timestamps */
  stageHistory: StageTransition[];
  /** Trace ID for observability correlation */
  traceId: string;
  /** Errors from each retry attempt */
  retryErrors: RetryError[];
}
/**
 * Configuration for batching behavior
 */
export interface BatchConfig {
  /** Time window to wait for more messages (ms, default: 500) */
  windowMs: number;
  /** Maximum time to collect messages (ms, default: 5000) */
  maxWindowMs: number;
  /** Maximum messages per batch (default: 10) */
  maxMessages: number;
}
/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retries (default: 6) */
  maxRetries: number;
  /** Initial delay before first retry (ms, default: 2000) */
  initialDelayMs: number;
  /** Maximum delay between retries (ms, default: 64000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
}
/**
 * Error record for retry tracking
 */
export interface RetryError {
  timestamp: number;
  message: string;
  stack?: string;
}
/**
 * Default batch configuration
 */
export declare const DEFAULT_BATCH_CONFIG: BatchConfig;
/**
 * Default retry configuration (matches Cloudflare DO Alarms behavior)
 */
export declare const DEFAULT_RETRY_CONFIG: RetryConfig;
/**
 * Create initial batch state
 */
export declare function createInitialBatchState(): BatchState;
/**
 * Create initial enhanced batch state with stage tracking
 */
export declare function createInitialEnhancedBatchState(): EnhancedBatchState;
/**
 * Calculate retry delay using exponential backoff
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds before next retry
 */
export declare function calculateRetryDelay(retryCount: number, config?: RetryConfig): number;
/**
 * Combine pending messages into a single input string
 *
 * @param messages - Array of pending messages
 * @returns Combined message text with newlines
 */
export declare function combineBatchMessages(messages: PendingMessage[]): string;
/**
 * Check if batch should be processed immediately
 * (max window reached or max messages reached)
 *
 * @param state - Current batch state
 * @param config - Batch configuration
 * @returns True if batch should process now
 */
export declare function shouldProcessImmediately(state: BatchState, config?: BatchConfig): boolean;
/**
 * Check if a message is a duplicate based on requestId
 *
 * @param requestId - Request ID to check
 * @param messages - Existing pending messages
 * @returns True if duplicate
 */
export declare function isDuplicateMessage(requestId: string, messages: PendingMessage[]): boolean;
/**
 * Configuration for heartbeat-based stuck detection
 */
export interface HeartbeatConfig {
  /** Max time since last heartbeat before considering stuck (ms, default: 30000) */
  maxHeartbeatAgeMs: number;
  /** Heartbeat update interval (ms, default: 5000) - matches ThinkingRotator */
  heartbeatIntervalMs: number;
}
/**
 * Default heartbeat configuration
 */
export declare const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig;
/**
 * Result of stuck batch detection
 */
export interface StuckCheckResult {
  /** Whether the batch is stuck */
  isStuck: boolean;
  /** Reason for being stuck (if applicable) */
  reason?: string;
}
/**
 * Check if batch is stuck based on heartbeat timestamp
 *
 * A batch is considered stuck if:
 * - Status is 'processing' AND
 * - Last heartbeat was more than maxHeartbeatAgeMs ago
 *
 * @param batch - Current batch state
 * @param config - Heartbeat configuration
 * @returns StuckCheckResult with isStuck and optional reason
 */
export declare function isBatchStuckByHeartbeat(
  batch: BatchState,
  config?: HeartbeatConfig
): StuckCheckResult;
/**
 * Check if a message is duplicate across both active and pending batches
 *
 * @param requestId - Request ID to check
 * @param activeBatch - Currently processing batch
 * @param pendingBatch - Batch collecting new messages
 * @returns True if duplicate found in either batch
 */
export declare function isDuplicateInBothBatches(
  requestId: string,
  activeBatch: BatchState | undefined,
  pendingBatch: BatchState | undefined
): boolean;
//# sourceMappingURL=batch-types.d.ts.map
