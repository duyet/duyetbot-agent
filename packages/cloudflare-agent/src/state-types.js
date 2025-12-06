/**
 * State Management DO Types
 *
 * DEPRECATED: This module is part of the legacy architecture.
 * Legacy implementation kept for backward compatibility with cloudflare-agent.ts and state-do.ts.
 *
 * Type definitions for the centralized State DO that provides:
 * - Session tracking across all chat agents
 * - Execution traces for observability
 * - Watchdog recovery for stuck batches
 * - Aggregated metrics
 *
 * Observability in the new architecture is handled through ExecutionContext (src/execution/context.ts)
 * and DebugAccumulator instead of a centralized State DO.
 */
// ============================================
// Constants
// ============================================
/** Maximum number of traces to keep in ring buffer */
export const MAX_TRACES = 100;
/** Default stuck threshold in milliseconds (60 seconds) */
export const DEFAULT_STUCK_THRESHOLD_MS = 60_000;
/** Watchdog interval in seconds */
export const WATCHDOG_INTERVAL_SECONDS = 30;
/**
 * Create initial State DO state
 */
export function createInitialStateDOState() {
  return {
    sessions: {},
    traces: [],
    metrics: {
      totalExecutions: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      errorCount: 0,
      recoveryCount: 0,
      byAgent: {},
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastWatchdogRun: 0,
  };
}
/**
 * Create a new session state
 */
export function createSessionState(params) {
  const now = Date.now();
  return {
    sessionId: params.sessionId,
    platform: params.platform,
    userId: params.userId,
    chatId: params.chatId,
    batchStatus: 'processing',
    batchId: params.batchId,
    lastHeartbeat: now,
    lastActivity: now,
    delegatedTo: null,
    responseTarget: params.responseTarget,
    registeredAt: now,
  };
}
