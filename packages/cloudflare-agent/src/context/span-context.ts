/**
 * SpanContext module for parallel agent execution
 *
 * Provides lightweight span context for parallel workers while sharing
 * the main GlobalContext accumulators. Each parallel agent gets its own
 * SpanContext pointing to shared GlobalContext to prevent race conditions.
 *
 * Key principle: Each parallel worker has its own spanId but appends to
 * shared accumulator arrays (toolCalls, warnings, errors, etc.) which is
 * thread-safe due to JavaScript's single-threaded execution model.
 */

import { randomUUID } from 'node:crypto';
import type { GlobalContext, TokenUsageRecord, ToolCallRecord } from './global-context.js';

/**
 * Lightweight span context for parallel workers
 *
 * Each parallel agent gets its own SpanContext pointing to shared GlobalContext.
 * This prevents race conditions from modifying ctx.currentSpanId concurrently,
 * while still sharing all accumulator arrays.
 *
 * @example
 * ```typescript
 * // In orchestrator, create spans for parallel workers
 * const worker1Span = createSpanContext(ctx, 'code-worker', orchestratorSpanId);
 * const worker2Span = createSpanContext(ctx, 'research-worker', orchestratorSpanId);
 *
 * // Execute in parallel - each records with its own spanId
 * await Promise.all([
 *   executeWorker(worker1Span),
 *   executeWorker(worker2Span),
 * ]);
 *
 * // Complete spans after parallel execution
 * completeSpan(worker1Span, 'success');
 * completeSpan(worker2Span, 'success');
 * ```
 */
export interface SpanContext {
  /** Reference to the shared GlobalContext */
  readonly unified: GlobalContext;
  /** This agent's span ID */
  readonly spanId: string;
  /** Parent span ID (orchestrator's span) */
  readonly parentSpanId: string;
  /** This agent's name */
  readonly agentName: string;
  /** When this span started (milliseconds since epoch) */
  readonly startedAt: number;
}

/**
 * Create a span context for a parallel worker
 *
 * Creates a new span and appends it to the unified GlobalContext's agentChain.
 * Does NOT modify unified.currentSpanId to prevent race conditions in parallel execution.
 *
 * Array push operations are atomic in single-threaded JavaScript (Cloudflare Workers),
 * so appending to shared arrays is safe even with concurrent workers.
 *
 * @param unified - The shared GlobalContext for all parallel workers
 * @param agentName - Name of this agent (e.g., 'code-worker', 'research-worker')
 * @param parentSpanId - Parent span ID for correlation (defaults to unified.currentSpanId)
 * @returns New SpanContext for this parallel worker
 *
 * @example
 * ```typescript
 * const span = createSpanContext(ctx, 'my-worker', orchestratorSpanId);
 * recordToolCall(span, { name: 'search', arguments: {} });
 * completeSpan(span, 'success');
 * ```
 */
export function createSpanContext(
  unified: GlobalContext,
  agentName: string,
  parentSpanId?: string
): SpanContext {
  const spanId = randomUUID();
  const now = Date.now();
  const finalParentSpanId = parentSpanId ?? unified.currentSpanId;

  // Append to shared agentChain
  // Safe: array push is atomic in JavaScript single-threaded execution
  unified.agentChain.push({
    agent: agentName,
    spanId,
    parentSpanId: finalParentSpanId,
    startedAt: now,
  });

  return {
    unified,
    spanId,
    parentSpanId: finalParentSpanId,
    agentName,
    startedAt: now,
  };
}

/**
 * Complete a span context after execution
 *
 * Finds the span entry in unified.agentChain by spanId and updates it with:
 * - endedAt: current timestamp
 * - durationMs: time elapsed since startedAt
 * - result: execution outcome
 *
 * @param span - The SpanContext to complete
 * @param result - Execution result: 'success', 'error', or 'delegated'
 *
 * @example
 * ```typescript
 * try {
 *   await executeWorker(span);
 *   completeSpan(span, 'success');
 * } catch (error) {
 *   completeSpan(span, 'error');
 * }
 * ```
 */
export function completeSpan(span: SpanContext, result: 'success' | 'error' | 'delegated'): void {
  const entry = span.unified.agentChain.find((s) => s.spanId === span.spanId);
  if (entry) {
    const now = Date.now();
    entry.endedAt = now;
    entry.durationMs = now - entry.startedAt;
    entry.result = result;
  }
}

/**
 * Record a tool call for a specific span
 *
 * Appends a tool call record to the unified context's toolCalls array with
 * this span's spanId. Uses the span's spanId instead of unified.currentSpanId
 * to correctly attribute the call in parallel execution.
 *
 * @param span - The SpanContext making the tool call
 * @param call - Tool call information (spanId and timestamp are added automatically)
 *
 * @example
 * ```typescript
 * recordToolCallSpan(span, {
 *   name: 'search',
 *   arguments: { query: 'example' },
 *   result: 'search results...',
 *   durationMs: 150,
 * });
 * ```
 */
export function recordToolCallSpan(
  span: SpanContext,
  call: Omit<ToolCallRecord, 'spanId' | 'timestamp'>
): void {
  span.unified.toolCalls.push({
    ...call,
    spanId: span.spanId,
    timestamp: Date.now(),
  });
}

/**
 * Record token usage for a specific span
 *
 * Appends a token usage record to the unified context's tokenUsage array
 * with this span's spanId.
 *
 * @param span - The SpanContext using tokens
 * @param usage - Token usage information (spanId and timestamp are added automatically)
 *
 * @example
 * ```typescript
 * recordTokenUsageSpan(span, {
 *   provider: 'claude',
 *   model: 'claude-3-5-sonnet',
 *   inputTokens: 1000,
 *   outputTokens: 500,
 * });
 * ```
 */
export function recordTokenUsageSpan(
  span: SpanContext,
  usage: Omit<TokenUsageRecord, 'spanId' | 'timestamp'>
): void {
  span.unified.tokenUsage.push({
    ...usage,
    spanId: span.spanId,
    timestamp: Date.now(),
  });
}

/**
 * Add a warning message for a specific span
 *
 * Appends a warning to the unified context's warnings array with
 * agent name and truncated spanId prefix for traceability.
 *
 * Format: `[agent:spanIdPrefix] warning message`
 *
 * @param span - The SpanContext that generated the warning
 * @param warning - Warning message
 *
 * @example
 * ```typescript
 * addWarningSpan(span, 'API rate limit approaching');
 * // Stored as: "[code-worker:a1b2c3d4] API rate limit approaching"
 * ```
 */
export function addWarningSpan(span: SpanContext, warning: string): void {
  const prefix = `[${span.agentName}:${span.spanId.slice(0, 8)}]`;
  span.unified.warnings.push(`${prefix} ${warning}`);
}

/**
 * Add an error message for a specific span
 *
 * Appends an error to the unified context's errors array with
 * agent name and truncated spanId prefix for traceability.
 *
 * Format: `[agent:spanIdPrefix] error message`
 *
 * @param span - The SpanContext that generated the error
 * @param error - Error message
 *
 * @example
 * ```typescript
 * addErrorSpan(span, 'Failed to fetch data from API');
 * // Stored as: "[research-worker:x9y8z7w6] Failed to fetch data from API"
 * ```
 */
export function addErrorSpan(span: SpanContext, error: string): void {
  const prefix = `[${span.agentName}:${span.spanId.slice(0, 8)}]`;
  span.unified.errors.push(`${prefix} ${error}`);
}

/**
 * Set metadata for a specific span
 *
 * Stores arbitrary metadata in the unified context's metadata object
 * with a key prefixed by spanId for namespace isolation between parallel agents.
 *
 * Format: `spanId:key`
 *
 * @param span - The SpanContext setting metadata
 * @param key - Metadata key
 * @param value - Metadata value
 *
 * @example
 * ```typescript
 * setMetadataSpan(span, 'search_count', 5);
 * // Stored as: metadata['a1b2c3d4-...:search_count'] = 5
 * ```
 */
export function setMetadataSpan(span: SpanContext, key: string, value: unknown): void {
  span.unified.metadata[`${span.spanId}:${key}`] = value;
}

// Re-export from global-context for convenience
export type { ToolCallRecord, TokenUsageRecord };
