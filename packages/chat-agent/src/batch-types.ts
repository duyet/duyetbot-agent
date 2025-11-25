/**
 * Types for message batching and alarm-based processing
 *
 * This module defines types for combining rapid-fire messages within
 * a time window into a single LLM input, using Cloudflare Durable Object Alarms.
 */

/**
 * Status of a message batch
 */
export type BatchStatus = 'idle' | 'collecting' | 'processing' | 'completed' | 'failed';

/**
 * A pending message waiting to be processed
 */
export interface PendingMessage<TContext = unknown> {
  /** Message text content */
  text: string;
  /** Timestamp when message was received */
  timestamp: number;
  /** Request ID for deduplication */
  requestId: string;
  /** User ID who sent the message */
  userId?: string | number;
  /** Chat/conversation ID */
  chatId?: string | number;
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
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  windowMs: 500,
  maxWindowMs: 5000,
  maxMessages: 10,
};

/**
 * Default retry configuration (matches Cloudflare DO Alarms behavior)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 6,
  initialDelayMs: 2000,
  maxDelayMs: 64000,
  backoffMultiplier: 2,
};

/**
 * Create initial batch state
 */
export function createInitialBatchState(): BatchState {
  return {
    status: 'idle',
    pendingMessages: [],
    batchId: null,
    retryCount: 0,
    lastMessageAt: 0,
    batchStartedAt: 0,
  };
}

/**
 * Calculate retry delay using exponential backoff
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * config.backoffMultiplier ** retryCount;
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Combine pending messages into a single input string
 *
 * @param messages - Array of pending messages
 * @returns Combined message text with newlines
 */
export function combineBatchMessages(messages: PendingMessage[]): string {
  return messages.map((m) => m.text).join('\n');
}

/**
 * Check if batch should be processed immediately
 * (max window reached or max messages reached)
 *
 * @param state - Current batch state
 * @param config - Batch configuration
 * @returns True if batch should process now
 */
export function shouldProcessImmediately(
  state: BatchState,
  config: BatchConfig = DEFAULT_BATCH_CONFIG
): boolean {
  const now = Date.now();

  // Max messages reached
  if (state.pendingMessages.length >= config.maxMessages) {
    return true;
  }

  // Max window elapsed since batch started
  if (state.batchStartedAt > 0 && now - state.batchStartedAt >= config.maxWindowMs) {
    return true;
  }

  return false;
}

/**
 * Check if a message is a duplicate based on requestId
 *
 * @param requestId - Request ID to check
 * @param messages - Existing pending messages
 * @returns True if duplicate
 */
export function isDuplicateMessage(requestId: string, messages: PendingMessage[]): boolean {
  return messages.some((m) => m.requestId === requestId);
}
