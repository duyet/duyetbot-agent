/**
 * Execution State Types for Alarm-Based Agent Architecture
 *
 * Type definitions for tracking execution state throughout the lifecycle
 * of agent batch processing using Cloudflare Durable Object Alarms.
 * Supports step-by-step progress tracking, timing metrics, and results aggregation.
 */

import type { Message, TokenUsage, ToolCall } from './types.js';

/**
 * Execution step states representing the progression through agent processing
 *
 * - 'init': Initial state, batch just created
 * - 'mcp_connecting': Establishing connection to MCP servers for tool discovery
 * - 'llm_calling': Making API call to LLM with current messages and tools
 * - 'tool_executing': Executing tools returned by LLM
 * - 'responding': Formatting and sending response back to user
 * - 'completed': Execution finished successfully
 * - 'error': Execution encountered unrecoverable error
 */
export type ExecutionStep =
  | 'init'
  | 'mcp_connecting'
  | 'llm_calling'
  | 'tool_executing'
  | 'responding'
  | 'completed'
  | 'error';

/**
 * Context information about the query being processed
 */
export interface QueryContext {
  /** Original user query text */
  query: string;
  /** Platform where request originated (telegram|github|cli|api) */
  platform: 'telegram' | 'github' | 'cli' | 'api';
  /** Chat/conversation ID on the platform */
  chatId: string | number;
  /** Message ID for editing existing messages (optional) */
  messageId?: string | number;
  /** User ID on the platform */
  userId: string | number;
  /** Username for admin checks and attribution */
  username?: string;
  /** Conversation history up to this point */
  conversationHistory: Message[];
}

/**
 * Transport layer configuration for sending responses
 */
export interface TransportConfig {
  /** Transport type (telegram|github|cli|api) */
  type: 'telegram' | 'github' | 'cli' | 'api';
  /** Bot token for direct Telegram API calls (if applicable) */
  botToken?: string;
  /** Chat ID for direct message sending (if applicable) */
  chatId?: string | number;
  /** Additional transport-specific configuration */
  config?: Record<string, unknown>;
}

/**
 * Progress tracking data for execution phases
 */
export interface ExecutionProgress {
  /** Whether MCP connection has been established */
  mcpConnected: boolean;
  /** MCP server ID if connected (e.g., 'memory-mcp', 'github-api') */
  mcpServerId?: string;
  /** Total number of LLM API calls made */
  llmCalls: number;
  /** Array of tool names that have been executed */
  toolsExecuted: string[];
  /** Timestamp of last state update */
  lastUpdate: number;
}

/**
 * Aggregated results from execution
 */
export interface ExecutionResults {
  /** Array of all LLM responses received during this execution */
  llmResponses: Array<{
    /** The text response from LLM */
    content: string;
    /** Tool calls requested by LLM (if any) */
    toolCalls?: ToolCall[];
    /** Token usage for this response */
    usage?: TokenUsage;
  }>;
  /** Results from executed tools mapped by tool name */
  toolResults: Record<string, unknown>;
  /** Final formatted response to send to user (if execution completed) */
  finalResponse?: string;
}

/**
 * Timing information for execution profiling
 */
export interface ExecutionTiming {
  /** Timestamp when execution started */
  createdAt: number;
  /** Timestamp of last state update */
  updatedAt: number;
  /** Deadline timestamp - execution should abort after this */
  deadlineAt: number;
}

/**
 * Complete execution state for alarm-based batch processing
 *
 * Tracks the full lifecycle of a single batch from arrival through completion,
 * including context, progress, results, and timing information.
 */
export interface ExecutionState {
  /**
   * Unique execution identifier
   * Format: `exec_${batchId}_${timestamp}`
   */
  executionId: string;

  /**
   * Current execution step
   * @see ExecutionStep for state descriptions
   */
  step: ExecutionStep;

  /**
   * Current iteration count (for multi-turn conversations with tools)
   * Incremented each time LLM is called
   */
  iteration: number;

  /**
   * Maximum allowed iterations before timeout
   * Default: 5 (prevents infinite tool loops)
   */
  maxIterations: number;

  // =========== Context ===========

  /**
   * Query context containing user message and conversation state
   */
  context: QueryContext;

  // ========== Transport ==========

  /**
   * Transport configuration for response delivery
   */
  transport: TransportConfig;

  // ========= Progress =========

  /**
   * Progress tracking data
   */
  progress: ExecutionProgress;

  // ========= Results ==========

  /**
   * Aggregated results from execution
   */
  results: ExecutionResults;

  // ========= Timing ==========

  /**
   * Timing information for profiling and deadlines
   */
  timing: ExecutionTiming;

  /**
   * Optional error message if step is 'error'
   */
  error?: string | undefined;

  /**
   * Optional error stack trace for debugging
   */
  errorStack?: string | undefined;
}

/**
 * Parameters for creating a new execution state
 */
export interface CreateExecutionStateParams {
  /** Execution ID (optional, auto-generated if not provided) */
  executionId?: string;
  /** Query context */
  context: QueryContext;
  /** Transport configuration */
  transport: TransportConfig;
  /** Maximum iterations (default: 5) */
  maxIterations?: number;
  /** Execution timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

/**
 * Transition parameters for updating execution state
 */
export interface TransitionParams {
  /** Next step to transition to */
  step: ExecutionStep;
  /** Optional error message if step is 'error' */
  error?: string;
  /** Optional error stack trace */
  errorStack?: string;
  /** Optional progress updates */
  progress?: Partial<ExecutionProgress>;
  /** Optional results updates */
  results?: Partial<ExecutionResults>;
}

/**
 * Create initial execution state for a new batch
 *
 * @param params - Parameters for creating execution state
 * @returns Initialized ExecutionState
 */
export function createInitialExecutionState(params: CreateExecutionStateParams): ExecutionState {
  const now = Date.now();
  const executionId = params.executionId || `exec_${now}_${Math.random().toString(36).slice(2, 9)}`;
  const timeoutMs = params.timeoutMs ?? 30000;

  return {
    executionId,
    step: 'init',
    iteration: 0,
    maxIterations: params.maxIterations ?? 5,
    context: params.context,
    transport: params.transport,
    progress: {
      mcpConnected: false,
      llmCalls: 0,
      toolsExecuted: [],
      lastUpdate: now,
    },
    results: {
      llmResponses: [],
      toolResults: {},
    },
    timing: {
      createdAt: now,
      updatedAt: now,
      deadlineAt: now + timeoutMs,
    },
  };
}

/**
 * Transition execution state to a new step
 *
 * Updates the step, timestamps, and optionally progress/results
 *
 * @param state - Current execution state
 * @param params - Transition parameters
 * @returns Updated ExecutionState
 */
export function transitionExecutionState(
  state: ExecutionState,
  params: TransitionParams
): ExecutionState {
  const now = Date.now();

  return {
    ...state,
    step: params.step,
    error: params.error,
    errorStack: params.errorStack,
    progress: params.progress ? { ...state.progress, ...params.progress } : state.progress,
    results: params.results ? { ...state.results, ...params.results } : state.results,
    timing: {
      ...state.timing,
      updatedAt: now,
    },
  };
}

/**
 * Check if execution has exceeded deadline
 *
 * @param state - Current execution state
 * @returns True if current time exceeds deadline
 */
export function isExecutionDeadlineExceeded(state: ExecutionState): boolean {
  return Date.now() > state.timing.deadlineAt;
}

/**
 * Check if execution has reached max iterations
 *
 * @param state - Current execution state
 * @returns True if iteration >= maxIterations
 */
export function isMaxIterationsReached(state: ExecutionState): boolean {
  return state.iteration >= state.maxIterations;
}

/**
 * Get elapsed time since execution started
 *
 * @param state - Current execution state
 * @returns Elapsed milliseconds
 */
export function getExecutionElapsedMs(state: ExecutionState): number {
  return Date.now() - state.timing.createdAt;
}

/**
 * Get remaining time before deadline
 *
 * @param state - Current execution state
 * @returns Remaining milliseconds (negative if exceeded)
 */
export function getExecutionRemainingMs(state: ExecutionState): number {
  return state.timing.deadlineAt - Date.now();
}

/**
 * Format execution state for logging/debugging
 *
 * @param state - Execution state to format
 * @returns Summary string
 */
export function formatExecutionState(state: ExecutionState): string {
  const elapsed = getExecutionElapsedMs(state);
  const remaining = getExecutionRemainingMs(state);

  return [
    `ExecutionState {`,
    `  id: ${state.executionId}`,
    `  step: ${state.step}`,
    `  iteration: ${state.iteration}/${state.maxIterations}`,
    `  llmCalls: ${state.progress.llmCalls}`,
    `  toolsExecuted: ${state.progress.toolsExecuted.join(', ') || 'none'}`,
    `  elapsed: ${elapsed}ms`,
    `  remaining: ${remaining}ms`,
    state.error ? `  error: ${state.error}` : '',
    `}`,
  ]
    .filter(Boolean)
    .join('\n');
}
