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
import { logger } from '@duyetbot/hono-middleware';
/**
 * Create a new execution metrics object
 */
export function createMetrics(id) {
  return {
    id,
    startTime: Date.now(),
    toolCalls: 0,
    status: 'pending',
    children: [],
  };
}
/**
 * Create a new research trace
 */
export function createTrace(traceId, query) {
  return {
    traceId,
    query,
    startTime: Date.now(),
    subagentCount: 0,
    totalToolCalls: 0,
    totalTokens: 0,
    parallelEfficiency: 0,
    subagentMetrics: [],
    rootMetrics: createMetrics('root'),
    succeeded: false,
  };
}
/**
 * Update execution metrics with result
 */
export function completeMetrics(metrics, result) {
  const endTime = Date.now();
  const durationMs = endTime - metrics.startTime;
  const updated = {
    ...metrics,
    endTime,
    durationMs,
    toolCalls: (metrics.toolCalls || 0) + (result.toolCalls || 0),
    status: result.success ? 'success' : 'failed',
  };
  if (result.tokensUsed !== undefined) {
    updated.tokensUsed = result.tokensUsed;
  }
  if (result.error !== undefined) {
    updated.error = result.error;
  }
  return updated;
}
/**
 * Calculate parallel efficiency
 * Measures how much time was spent in true parallel execution vs sequential
 */
export function calculateParallelEfficiency(metrics) {
  if (metrics.length === 0) {
    return 0;
  }
  // Find the total time span
  const startTimes = metrics.map((m) => m.startTime);
  const endTimes = metrics.map((m) => m.endTime || Date.now());
  const minStart = Math.min(...startTimes);
  const maxEnd = Math.max(...endTimes);
  const totalSpan = maxEnd - minStart;
  if (totalSpan === 0) {
    return 1; // Instant execution
  }
  // Sum of individual durations
  const totalIndividualTime = metrics.reduce((sum, m) => sum + (m.durationMs || 0), 0);
  // Efficiency = total individual time / (total time span) / number of tasks
  // This approaches 1.0 with perfect parallelism and 1/n with pure sequential
  const efficiency = Math.min(1, totalIndividualTime / (totalSpan * metrics.length));
  return efficiency;
}
/**
 * Log execution metrics in structured format
 */
export function logMetrics(metrics, prefix) {
  const logs = [
    `${prefix} - ${metrics.status.toUpperCase()}`,
    `ID: ${metrics.id}`,
    `Duration: ${metrics.durationMs}ms`,
    `Tool Calls: ${metrics.toolCalls}`,
  ];
  if (metrics.tokensUsed) {
    logs.push(`Tokens: ${metrics.tokensUsed}`);
  }
  if (metrics.error) {
    logs.push(`Error: ${metrics.error}`);
  }
  logger.info(logs.join(' | '));
}
/**
 * Log research trace summary
 */
export function logTrace(trace) {
  const efficiency = calculateParallelEfficiency(trace.subagentMetrics);
  const summary = {
    traceId: trace.traceId,
    query: trace.query.slice(0, 100),
    durationMs: trace.durationMs,
    subagents: trace.subagentCount,
    toolCalls: trace.totalToolCalls,
    tokens: trace.totalTokens,
    efficiency: `${(efficiency * 100).toFixed(1)}%`,
    status: trace.succeeded ? 'SUCCESS' : 'FAILED',
    error: trace.error,
  };
  logger.info('[ResearchTrace]', summary);
}
/**
 * Create debug report for troubleshooting
 */
export function createDebugReport(trace) {
  const timeline = trace.subagentMetrics.map((m) => ({
    time: m.startTime - trace.startTime,
    duration: m.durationMs || 0,
    agent: m.id,
    status: m.status,
  }));
  const timeline_text = timeline
    .map((t) => `[${t.time}ms] ${t.agent} (${t.duration}ms) - ${t.status}`)
    .join('\n');
  const summary = `
Research Trace Debug Report
===========================
Trace ID: ${trace.traceId}
Query: ${trace.query}
Status: ${trace.succeeded ? 'SUCCESS' : 'FAILED'}
Duration: ${trace.durationMs}ms

Summary:
- Subagents: ${trace.subagentCount}
- Total Tool Calls: ${trace.totalToolCalls}
- Total Tokens: ${trace.totalTokens}
- Parallel Efficiency: ${(calculateParallelEfficiency(trace.subagentMetrics) * 100).toFixed(1)}%

${trace.error ? `Error: ${trace.error}` : 'No errors'}

Execution Timeline:
${timeline_text}
`;
  return { summary, timeline, timeline_text };
}
/**
 * Observable wrapper for async functions
 * Tracks execution time and status
 */
export async function observeExecution(id, fn, options) {
  const metrics = createMetrics(id);
  metrics.status = 'running';
  try {
    const result = await fn();
    const completed = completeMetrics(metrics, { success: true });
    if (options?.prefix) {
      logMetrics(completed, options.prefix);
    }
    options?.onComplete?.(completed);
    return result;
  } catch (error) {
    const completed = completeMetrics(metrics, {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    if (options?.prefix) {
      logMetrics(completed, options.prefix);
    }
    options?.onComplete?.(completed);
    throw error;
  }
}
/**
 * Create a trace-aware logger for debugging
 */
export function createTraceLogger(traceId, prefix) {
  return {
    info: (message, data) => {
      logger.info(`[${traceId}] [${prefix}] ${message}`, data);
    },
    error: (message, error, data) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[${traceId}] [${prefix}] ${message}: ${errorMsg}`, data);
    },
    warn: (message, data) => {
      logger.warn(`[${traceId}] [${prefix}] ${message}`, data);
    },
    debug: (message, data) => {
      if (process.env.DEBUG) {
        logger.info(`[DEBUG] [${traceId}] [${prefix}] ${message}`, data);
      }
    },
  };
}
/**
 * Performance monitor for tracking multi-agent efficiency
 */
export class PerformanceMonitor {
  traces = new Map();
  maxTraces = 100;
  /**
   * Record a new trace
   */
  recordTrace(trace) {
    this.traces.set(trace.traceId, trace);
    // Keep only recent traces in memory
    if (this.traces.size > this.maxTraces) {
      const oldest = Array.from(this.traces.entries()).sort(
        ([, a], [, b]) => a.startTime - b.startTime
      )[0];
      if (oldest) {
        this.traces.delete(oldest[0]);
      }
    }
    // Log the trace
    logTrace(trace);
  }
  /**
   * Get trace by ID
   */
  getTrace(traceId) {
    return this.traces.get(traceId);
  }
  /**
   * Get performance statistics
   */
  getStats() {
    const traces = Array.from(this.traces.values());
    if (traces.length === 0) {
      return {
        totalTraces: 0,
        avgDuration: 0,
        avgSubagents: 0,
        avgParallelEfficiency: 0,
        successRate: 0,
      };
    }
    const avgDuration = traces.reduce((sum, t) => sum + (t.durationMs || 0), 0) / traces.length;
    const avgSubagents = traces.reduce((sum, t) => sum + t.subagentCount, 0) / traces.length;
    const avgParallelEfficiency =
      traces.reduce((sum, t) => sum + calculateParallelEfficiency(t.subagentMetrics), 0) /
      traces.length;
    const successRate = traces.filter((t) => t.succeeded).length / traces.length;
    return {
      totalTraces: traces.length,
      avgDuration: Math.round(avgDuration),
      avgSubagents: Math.round(avgSubagents * 100) / 100,
      avgParallelEfficiency: Math.round(avgParallelEfficiency * 10000) / 100,
      successRate: Math.round(successRate * 10000) / 100,
    };
  }
  /**
   * Clear all traces
   */
  clear() {
    this.traces.clear();
  }
}
/**
 * Global performance monitor instance
 */
export const globalPerformanceMonitor = new PerformanceMonitor();
