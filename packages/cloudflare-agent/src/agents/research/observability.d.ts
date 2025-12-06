/**
 * Observability and Debugging Utilities
 *
 * Provides structured logging, metrics collection, and debug tracing
 * for multi-agent research system execution.
 *
 * Tracks:
 * - Execution flow and timing
 * - Resource usage (tokens, API calls)
 * - Parallel execution efficiency
 * - Error patterns and debugging info
 */
/**
 * Execution metrics for a single task or subagent
 */
export interface ExecutionMetrics {
  /** Task or agent ID */
  id: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Number of tool calls made */
  toolCalls: number;
  /** Total tokens used */
  tokensUsed?: number;
  /** Status: pending, running, success, failed */
  status: 'pending' | 'running' | 'success' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Child task metrics (for parallel execution tracking) */
  children?: ExecutionMetrics[];
}
/**
 * Research execution trace - tracks the entire research operation
 */
export interface ResearchTrace {
  /** Trace ID for correlation */
  traceId: string;
  /** Original query */
  query: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime?: number;
  /** Total duration */
  durationMs?: number;
  /** Number of subagents spawned */
  subagentCount: number;
  /** Total tool calls across all subagents */
  totalToolCalls: number;
  /** Total tokens used */
  totalTokens: number;
  /** Parallel efficiency (0-1) */
  parallelEfficiency: number;
  /** Metrics for each subagent */
  subagentMetrics: ExecutionMetrics[];
  /** Root metrics for lead researcher */
  rootMetrics: ExecutionMetrics;
  /** Whether execution succeeded */
  succeeded: boolean;
  /** Overall error if any */
  error?: string;
}
/**
 * Create a new execution metrics object
 */
export declare function createMetrics(id: string): ExecutionMetrics;
/**
 * Create a new research trace
 */
export declare function createTrace(traceId: string, query: string): ResearchTrace;
/**
 * Update execution metrics with result
 */
export declare function completeMetrics(
  metrics: ExecutionMetrics,
  result: {
    success: boolean;
    toolCalls?: number;
    tokensUsed?: number;
    error?: string;
  }
): ExecutionMetrics;
/**
 * Calculate parallel efficiency
 * Measures how much time was spent in true parallel execution vs sequential
 */
export declare function calculateParallelEfficiency(metrics: ExecutionMetrics[]): number;
/**
 * Log execution metrics in structured format
 */
export declare function logMetrics(metrics: ExecutionMetrics, prefix: string): void;
/**
 * Log research trace summary
 */
export declare function logTrace(trace: ResearchTrace): void;
/**
 * Create debug report for troubleshooting
 */
export declare function createDebugReport(trace: ResearchTrace): {
  summary: string;
  timeline: Array<{
    time: number;
    duration: number;
    agent: string;
    status: string;
  }>;
  timeline_text: string;
};
/**
 * Observable wrapper for async functions
 * Tracks execution time and status
 */
export declare function observeExecution<T>(
  id: string,
  fn: () => Promise<T>,
  options?: {
    prefix?: string;
    onComplete?: (metrics: ExecutionMetrics) => void;
  }
): Promise<T>;
/**
 * Create a trace-aware logger for debugging
 */
export declare function createTraceLogger(
  traceId: string,
  prefix: string
): {
  info: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, error?: Error | unknown, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  debug: (message: string, data?: Record<string, unknown>) => void;
};
/**
 * Performance monitor for tracking multi-agent efficiency
 */
export declare class PerformanceMonitor {
  private traces;
  private maxTraces;
  /**
   * Record a new trace
   */
  recordTrace(trace: ResearchTrace): void;
  /**
   * Get trace by ID
   */
  getTrace(traceId: string): ResearchTrace | undefined;
  /**
   * Get performance statistics
   */
  getStats(): {
    totalTraces: number;
    avgDuration: number;
    avgSubagents: number;
    avgParallelEfficiency: number;
    successRate: number;
  };
  /**
   * Clear all traces
   */
  clear(): void;
}
/**
 * Global performance monitor instance
 */
export declare const globalPerformanceMonitor: PerformanceMonitor;
//# sourceMappingURL=observability.d.ts.map
