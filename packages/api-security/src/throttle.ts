/**
 * Request Throttling for Expensive Operations
 *
 * In-memory throttling with configurable concurrency limits
 * and per-operation delays.
 */

import type { ThrottleConfig, ThrottleState } from './types.js';

/**
 * Default throttle configuration
 */
export const DEFAULT_THROTTLE_CONFIG: ThrottleConfig = {
  maxConcurrent: 3,
  perOperationDelay: 1000, // 1 second between operations
  windowMs: 60_000, // 1 minute window
};

/**
 * Throttle state for different operation types
 */
const throttleStates = new Map<string, ThrottleState>();

/**
 * Get or create throttle state for operation type
 *
 * @param operationType - Type of operation (e.g., 'llm_call', 'github_api')
 * @returns Throttle state
 */
function getOrCreateState(operationType: string): ThrottleState {
  let state = throttleStates.get(operationType);
  if (!state) {
    state = {
      activeCount: 0,
      lastOperationAt: 0,
      pendingQueue: [],
    };
    throttleStates.set(operationType, state);
  }
  return state;
}

/**
 * Check if operation can proceed
 *
 * @param operationType - Type of operation
 * @param config - Throttle configuration
 * @returns Object indicating if operation is allowed
 */
export function checkThrottle(
  operationType: string,
  config: Partial<ThrottleConfig> = {}
): { allowed: boolean; waitTime: number; position?: number } {
  const effectiveConfig = { ...DEFAULT_THROTTLE_CONFIG, ...config };
  const state = getOrCreateState(operationType);
  const now = Date.now();

  // Check if we can start a new operation
  if (state.activeCount < effectiveConfig.maxConcurrent) {
    // Check delay since last operation
    const timeSinceLastOperation = now - state.lastOperationAt;
    if (timeSinceLastOperation >= effectiveConfig.perOperationDelay) {
      return { allowed: true, waitTime: 0 };
    }
    return { allowed: true, waitTime: effectiveConfig.perOperationDelay - timeSinceLastOperation };
  }

  // At capacity - check position in queue
  const position = state.pendingQueue.indexOf(now);
  return {
    allowed: false,
    waitTime: effectiveConfig.windowMs,
    position: position >= 0 ? position : state.pendingQueue.length,
  };
}

/**
 * Acquire throttle slot for operation
 *
 * @param operationType - Type of operation
 * @returns Function to release the slot
 */
export function acquireThrottleSlot(operationType: string): () => void {
  const state = getOrCreateState(operationType);
  state.activeCount++;
  state.lastOperationAt = Date.now();

  // Return release function
  return () => {
    state.activeCount = Math.max(0, state.activeCount - 1);
    // Remove from queue if present
    const now = Date.now();
    const index = state.pendingQueue.indexOf(now);
    if (index >= 0) {
      state.pendingQueue.splice(index, 1);
    }
  };
}

/**
 * Add operation to pending queue
 *
 * @param operationType - Type of operation
 * @returns Function to remove from queue
 */
export function queueOperation(operationType: string): () => void {
  const state = getOrCreateState(operationType);
  const now = Date.now();
  state.pendingQueue.push(now);

  // Return cancel function
  return () => {
    const index = state.pendingQueue.indexOf(now);
    if (index >= 0) {
      state.pendingQueue.splice(index, 1);
    }
  };
}

/**
 * Execute throttled operation
 *
 * Automatically acquires and releases throttle slots.
 * Returns a promise that resolves when the operation completes.
 *
 * @param operationType - Type of operation
 * @param fn - Operation function to execute
 * @param config - Throttle configuration
 * @returns Promise with operation result
 */
export async function executeThrottled<T>(
  operationType: string,
  fn: () => Promise<T>,
  config: Partial<ThrottleConfig> = {}
): Promise<T> {
  const effectiveConfig = { ...DEFAULT_THROTTLE_CONFIG, ...config };

  // Wait for slot availability
  while (true) {
    const check = checkThrottle(operationType, effectiveConfig);
    if (check.allowed) {
      if (check.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, check.waitTime));
      }
      break;
    }

    // Wait before retrying
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Acquire slot and execute
  const release = acquireThrottleSlot(operationType);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Get throttle statistics
 *
 * @param operationType - Type of operation (or undefined for all)
 * @returns Throttle statistics
 */
export function getThrottleStats(operationType?: string):
  | {
      activeCount: number;
      queuedCount: number;
      lastOperationAt: number;
    }
  | Map<
      string,
      {
        activeCount: number;
        queuedCount: number;
        lastOperationAt: number;
      }
    > {
  if (operationType) {
    const state = throttleStates.get(operationType);
    if (!state) {
      return { activeCount: 0, queuedCount: 0, lastOperationAt: 0 };
    }
    return {
      activeCount: state.activeCount,
      queuedCount: state.pendingQueue.length,
      lastOperationAt: state.lastOperationAt,
    };
  }

  // Return stats for all operation types
  const stats = new Map();
  for (const [type, state] of throttleStates.entries()) {
    stats.set(type, {
      activeCount: state.activeCount,
      queuedCount: state.pendingQueue.length,
      lastOperationAt: state.lastOperationAt,
    });
  }
  return stats;
}

/**
 * Reset throttle state (testing/cleanup only)
 *
 * @param operationType - Type of operation to reset (undefined = all)
 */
export function resetThrottleState(operationType?: string): void {
  if (operationType) {
    throttleStates.delete(operationType);
  } else {
    throttleStates.clear();
  }
}

/**
 * Cleanup stale throttle entries
 *
 * Removes throttle states older than 1 hour with no activity.
 */
export function cleanupStaleThrottleStates(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [type, state] of throttleStates.entries()) {
    if (
      state.activeCount === 0 &&
      state.pendingQueue.length === 0 &&
      state.lastOperationAt < oneHourAgo
    ) {
      throttleStates.delete(type);
    }
  }
}
