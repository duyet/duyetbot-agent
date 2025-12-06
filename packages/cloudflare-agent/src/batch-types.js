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
 * Default batch configuration
 */
export const DEFAULT_BATCH_CONFIG = {
  windowMs: 500,
  maxWindowMs: 5000,
  maxMessages: 10,
};
/**
 * Default retry configuration (matches Cloudflare DO Alarms behavior)
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 6,
  initialDelayMs: 2000,
  maxDelayMs: 64000,
  backoffMultiplier: 2,
};
/**
 * Create initial batch state
 */
export function createInitialBatchState() {
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
 * Create initial enhanced batch state with stage tracking
 */
export function createInitialEnhancedBatchState() {
  return {
    ...createInitialBatchState(),
    currentStage: 'queued',
    stageHistory: [],
    traceId: crypto.randomUUID(),
    retryErrors: [],
  };
}
/**
 * Calculate retry delay using exponential backoff
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(retryCount, config = DEFAULT_RETRY_CONFIG) {
  const delay = config.initialDelayMs * config.backoffMultiplier ** retryCount;
  return Math.min(delay, config.maxDelayMs);
}
/**
 * Combine pending messages into a single input string
 *
 * @param messages - Array of pending messages
 * @returns Combined message text with newlines
 */
export function combineBatchMessages(messages) {
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
export function shouldProcessImmediately(state, config = DEFAULT_BATCH_CONFIG) {
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
export function isDuplicateMessage(requestId, messages) {
  return messages.some((m) => m.requestId === requestId);
}
/**
 * Default heartbeat configuration
 */
export const DEFAULT_HEARTBEAT_CONFIG = {
  maxHeartbeatAgeMs: 20000, // 20 seconds - 4 missed heartbeats (P99 response time + buffer)
  heartbeatIntervalMs: 5000, // 5 seconds - matches ThinkingRotator
};
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
export function isBatchStuckByHeartbeat(batch, config = DEFAULT_HEARTBEAT_CONFIG) {
  // Only check if actually processing
  if (batch.status !== 'processing') {
    return { isStuck: false };
  }
  const now = Date.now();
  // Fall back to batchStartedAt if no heartbeat recorded yet
  const lastHeartbeat = batch.lastHeartbeat ?? batch.batchStartedAt;
  // If no timestamps at all, can't determine stuck state
  if (lastHeartbeat === 0) {
    return { isStuck: false };
  }
  const heartbeatAge = now - lastHeartbeat;
  if (heartbeatAge > config.maxHeartbeatAgeMs) {
    return {
      isStuck: true,
      reason: `No heartbeat for ${Math.round(heartbeatAge / 1000)}s (threshold: ${config.maxHeartbeatAgeMs / 1000}s)`,
    };
  }
  return { isStuck: false };
}
/**
 * Check if a message is duplicate across both active and pending batches
 *
 * @param requestId - Request ID to check
 * @param activeBatch - Currently processing batch
 * @param pendingBatch - Batch collecting new messages
 * @returns True if duplicate found in either batch
 */
export function isDuplicateInBothBatches(requestId, activeBatch, pendingBatch) {
  // Check activeBatch if it exists
  if (activeBatch && isDuplicateMessage(requestId, activeBatch.pendingMessages)) {
    return true;
  }
  // Check pendingBatch if it exists
  if (pendingBatch && isDuplicateMessage(requestId, pendingBatch.pendingMessages)) {
    return true;
  }
  return false;
}
