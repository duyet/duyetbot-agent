/**
 * State Management Durable Object
 *
 * DEPRECATED: This module is part of the legacy architecture.
 * Legacy implementation kept for backward compatibility during migration.
 *
 * Centralized hub for:
 * - Session tracking across all chat agents
 * - Execution traces for observability
 * - Watchdog recovery for stuck batches (with user notification)
 * - Aggregated metrics
 *
 * The new architecture moves observability to ExecutionContext (src/execution/context.ts) and
 * DebugAccumulator. StateDO will be removed in a future phase after migrating any remaining
 * dependencies.
 */
import { Agent } from 'agents';
import {
  type AggregatedMetrics,
  type CompleteBatchParams,
  type ExecutionTrace,
  type HeartbeatParams,
  type LogTraceParams,
  type MarkDelegatedParams,
  type RecoveryResult,
  type RegisterBatchParams,
  type SessionState,
  type StateDOMethods,
  type StateDOState,
} from '../state-types.js';
/**
 * Environment bindings for State DO
 */
export interface StateDOEnv {
  /** Telegram bot token for sending recovery notifications */
  TELEGRAM_BOT_TOKEN?: string;
  /** GitHub token for sending recovery notifications */
  GITHUB_TOKEN?: string;
}
/**
 * State Management Durable Object
 *
 * Provides centralized observability and watchdog recovery for all chat agents.
 * Uses a single global instance per deployment.
 */
export declare class StateDO extends Agent<StateDOEnv, StateDOState> implements StateDOMethods {
  initialState: StateDOState;
  /**
   * Called when the DO is first created or after hibernation
   */
  onStart(): Promise<void>;
  /**
   * Register a new batch for tracking
   */
  registerBatch(params: RegisterBatchParams): Promise<void>;
  /**
   * Update heartbeat for a session
   */
  heartbeat(params: HeartbeatParams): Promise<void>;
  /**
   * Mark a session as delegated to another agent
   */
  markDelegated(params: MarkDelegatedParams): Promise<void>;
  /**
   * Complete a batch (success or failure)
   */
  completeBatch(params: CompleteBatchParams): Promise<void>;
  /**
   * Log an execution trace
   */
  logTrace(params: LogTraceParams): Promise<void>;
  /**
   * Get session state by ID
   */
  getSession(sessionId: string): SessionState | null;
  /**
   * Get all sessions that are stuck (no heartbeat within threshold)
   */
  getStuckSessions(thresholdMs?: number): SessionState[];
  /**
   * Get traces for a session
   */
  getTraces(sessionId: string, limit?: number): ExecutionTrace[];
  /**
   * Get aggregated metrics
   */
  getMetrics(): AggregatedMetrics;
  /**
   * Force recover a stuck session
   */
  forceRecover(sessionId: string): Promise<RecoveryResult>;
  /**
   * Schedule the next watchdog run
   */
  private scheduleWatchdog;
  /**
   * Watchdog alarm handler
   * Runs periodically to detect and recover stuck sessions
   */
  onWatchdogAlarm(): Promise<void>;
  /**
   * Clear a session and update metrics
   */
  private clearSession;
  /**
   * Send notification to user about recovery
   */
  private notifyUser;
  /**
   * Send Telegram notification
   */
  private sendTelegramNotification;
}
//# sourceMappingURL=state-do.d.ts.map
