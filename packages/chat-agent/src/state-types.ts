/**
 * State Management DO Types
 *
 * Type definitions for the centralized State DO that provides:
 * - Session tracking across all chat agents
 * - Execution traces for observability
 * - Watchdog recovery for stuck batches
 * - Aggregated metrics
 */

/**
 * Platform types supported by the system
 */
export type Platform = 'telegram' | 'github' | 'cli' | 'api';

/**
 * Batch status that can be tracked by State DO
 */
export type TrackedBatchStatus =
  | 'idle'
  | 'processing'
  | 'delegated'
  | 'completed'
  | 'failed'
  | 'recovered';

/**
 * Execution trace status
 */
export type TraceStatus = 'started' | 'completed' | 'failed' | 'recovered';

/**
 * Response target for sending messages back to users
 */
export interface ResponseTarget {
  /** Chat/conversation ID for the platform */
  chatId: string | number;
  /** Message ID for editing existing messages */
  messageId?: string | number;
}

/**
 * Session state tracked by State DO
 * Each session corresponds to a CloudflareChatAgent instance
 */
export interface SessionState {
  /** Unique session identifier (typically chatId or agentId) */
  sessionId: string;
  /** Platform where this session is running */
  platform: Platform;
  /** User ID within the platform */
  userId: string;
  /** Chat/conversation ID */
  chatId: string;
  /** Current batch processing status */
  batchStatus: TrackedBatchStatus | null;
  /** Current batch ID being processed */
  batchId: string | null;
  /** Last heartbeat timestamp from the agent */
  lastHeartbeat: number;
  /** Last activity timestamp (any interaction) */
  lastActivity: number;
  /** If delegated, which agent is handling it */
  delegatedTo: string | null;
  /** Target for sending recovery notifications */
  responseTarget: ResponseTarget | null;
  /** When this session was registered */
  registeredAt: number;
}

/**
 * Execution trace for observability
 * Tracks the journey of a request through the system
 */
export interface ExecutionTrace {
  /** Unique trace identifier */
  traceId: string;
  /** Session this trace belongs to */
  sessionId: string;
  /** Original query/message text */
  query: string;
  /** When processing started */
  startedAt: number;
  /** When processing completed (null if still in progress) */
  completedAt: number | null;
  /** Current status of the trace */
  status: TraceStatus;
  /** Query classification result */
  classification: {
    type: string;
    category: string;
    complexity: string;
  } | null;
  /** Which agent/worker handled this request */
  routedTo: string | null;
  /** Tools used during processing */
  toolsUsed: string[];
  /** Total processing duration in milliseconds */
  durationMs: number | null;
  /** Token count used (if available) */
  tokenCount: number | null;
  /** Error message if failed */
  error: string | null;
}

/**
 * Aggregated metrics for monitoring
 */
export interface AggregatedMetrics {
  /** Total number of executions */
  totalExecutions: number;
  /** Total tokens used across all sessions */
  totalTokens: number;
  /** Total processing time in milliseconds */
  totalDurationMs: number;
  /** Count of errors encountered */
  errorCount: number;
  /** Count of batches recovered by watchdog */
  recoveryCount: number;
  /** Metrics broken down by agent type */
  byAgent: Record<string, AgentMetrics>;
}

/**
 * Per-agent metrics
 */
export interface AgentMetrics {
  /** Number of times this agent was used */
  invocations: number;
  /** Total tokens used by this agent */
  tokens: number;
  /** Total processing time for this agent */
  durationMs: number;
  /** Errors from this agent */
  errors: number;
}

/**
 * State persisted by the State DO
 */
export interface StateDOState {
  /** Active sessions being tracked */
  sessions: Record<string, SessionState>;
  /** Recent execution traces (ring buffer, max 100) */
  traces: ExecutionTrace[];
  /** Aggregated metrics */
  metrics: AggregatedMetrics;
  /** When this State DO was created */
  createdAt: number;
  /** Last state update timestamp */
  updatedAt: number;
  /** When watchdog last ran */
  lastWatchdogRun: number;
}

// ============================================
// Method parameter types
// ============================================

/**
 * Parameters for registering a new batch
 */
export interface RegisterBatchParams {
  sessionId: string;
  batchId: string;
  platform: Platform;
  userId: string;
  chatId: string;
  responseTarget: ResponseTarget | null;
}

/**
 * Parameters for heartbeat updates
 */
export interface HeartbeatParams {
  sessionId: string;
  batchId: string;
}

/**
 * Parameters for marking delegation
 */
export interface MarkDelegatedParams {
  sessionId: string;
  batchId: string;
  delegatedTo: string;
}

/**
 * Parameters for completing a batch
 */
export interface CompleteBatchParams {
  sessionId: string;
  batchId: string;
  success: boolean;
  durationMs: number;
  tokenCount?: number;
  error?: string;
}

/**
 * Parameters for logging a trace
 */
export interface LogTraceParams {
  sessionId: string;
  query: string;
  status: TraceStatus;
  classification?: ExecutionTrace['classification'];
  routedTo?: string;
  toolsUsed?: string[];
  durationMs?: number;
  tokenCount?: number;
  error?: string;
}

/**
 * Result of force recovery operation
 */
export interface RecoveryResult {
  recovered: boolean;
  reason: string;
  sessionId: string;
}

// ============================================
// State DO method interface
// ============================================

/**
 * Methods exposed by the State DO
 */
export interface StateDOMethods {
  // Session Lifecycle
  registerBatch(params: RegisterBatchParams): Promise<void>;
  heartbeat(params: HeartbeatParams): Promise<void>;
  markDelegated(params: MarkDelegatedParams): Promise<void>;
  completeBatch(params: CompleteBatchParams): Promise<void>;

  // Trace Logging
  logTrace(params: LogTraceParams): Promise<void>;

  // Query
  getSession(sessionId: string): SessionState | null;
  getStuckSessions(thresholdMs: number): SessionState[];
  getTraces(sessionId: string, limit?: number): ExecutionTrace[];
  getMetrics(): AggregatedMetrics;

  // Recovery
  forceRecover(sessionId: string): Promise<RecoveryResult>;
}

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
export function createInitialStateDOState(): StateDOState {
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
export function createSessionState(params: RegisterBatchParams): SessionState {
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
