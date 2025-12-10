/**
 * Helper functions for GlobalContext manipulation
 *
 * These functions support sequential agent execution in the unified pipeline.
 * For parallel execution, use SpanContext helpers instead.
 */

import {
  type AgentSpan,
  createSpanId,
  type GlobalContext,
  type TokenUsageRecord,
  type ToolCallRecord,
} from './global-context.js';

/**
 * Enter an agent, updating the current span context
 *
 * Use this for sequential agent transitions (Router -> SimpleAgent -> etc).
 * For parallel worker execution, use SpanContext instead.
 *
 * @param ctx - Global context to update
 * @param agentName - Name of the agent being entered
 * @returns Span ID for this agent execution
 */
export function enterAgent(ctx: GlobalContext, agentName: string): string {
  const spanId = createSpanId();
  const now = Date.now();

  // Record span entry (will be completed later)
  const span: AgentSpan = {
    agent: agentName,
    spanId,
    startedAt: now,
  };

  // Only set parentSpanId if this is not a root agent
  if (ctx.currentSpanId !== ctx.traceId) {
    span.parentSpanId = ctx.currentSpanId;
  }

  ctx.agentChain.push(span);

  // Update current execution state
  ctx.currentSpanId = spanId;
  ctx.currentAgent = agentName;

  return spanId;
}

/**
 * Exit current agent, recording timing and result
 *
 * Must be paired with a previous enterAgent() call.
 *
 * @param ctx - Global context to update
 * @param result - Execution result (success, error, or delegated to another agent)
 */
export function exitAgent(ctx: GlobalContext, result: 'success' | 'error' | 'delegated'): void {
  // Find the current agent span (should be the last one)
  const currentSpan = ctx.agentChain[ctx.agentChain.length - 1];

  if (currentSpan && !currentSpan.endedAt) {
    const now = Date.now();
    currentSpan.endedAt = now;
    currentSpan.durationMs = now - currentSpan.startedAt;
    currentSpan.result = result;
  }

  // Revert to parent span if it exists, otherwise back to root
  if (ctx.agentChain.length > 1) {
    const previousSpan = ctx.agentChain[ctx.agentChain.length - 2]!;
    ctx.currentSpanId = previousSpan.spanId;
    ctx.currentAgent = previousSpan.agent;
  } else {
    ctx.currentSpanId = ctx.traceId;
    ctx.currentAgent = 'entry';
  }
}

/**
 * Record a tool call in the context
 *
 * @param ctx - Global context to update
 * @param call - Tool call information (spanId and timestamp will be added automatically)
 */
export function recordToolCall(
  ctx: GlobalContext,
  call: Omit<ToolCallRecord, 'spanId' | 'timestamp'>
): void {
  ctx.toolCalls.push({
    ...call,
    spanId: ctx.currentSpanId,
    timestamp: Date.now(),
  });
}

/**
 * Record token usage in the context
 *
 * @param ctx - Global context to update
 * @param usage - Token usage information (spanId and timestamp will be added automatically)
 */
export function recordTokenUsage(
  ctx: GlobalContext,
  usage: Omit<TokenUsageRecord, 'spanId' | 'timestamp'>
): void {
  ctx.tokenUsage.push({
    ...usage,
    spanId: ctx.currentSpanId,
    timestamp: Date.now(),
  });
}

/**
 * Add a warning message to the context
 *
 * Warnings are non-fatal issues that don't stop execution.
 *
 * @param ctx - Global context to update
 * @param warning - Warning message
 */
export function addWarning(ctx: GlobalContext, warning: string): void {
  ctx.warnings.push(`[${ctx.currentAgent}:${ctx.currentSpanId.slice(0, 8)}] ${warning}`);
}

/**
 * Add an error message to the context
 *
 * Errors are non-fatal issues that don't stop execution.
 * For fatal errors, throw an exception instead.
 *
 * @param ctx - Global context to update
 * @param error - Error message
 */
export function addError(ctx: GlobalContext, error: string): void {
  ctx.errors.push(`[${ctx.currentAgent}:${ctx.currentSpanId.slice(0, 8)}] ${error}`);
}

/**
 * Set metadata in the context
 *
 * Metadata key is prefixed with the current span ID to avoid collisions
 * when multiple agents store metadata simultaneously.
 *
 * @param ctx - Global context to update
 * @param key - Metadata key (will be prefixed with spanId)
 * @param value - Metadata value
 */
export function setMetadata(ctx: GlobalContext, key: string, value: unknown): void {
  ctx.metadata[`${ctx.currentSpanId}:${key}`] = value;
}

/**
 * Set a timing metric in the context
 *
 * @param ctx - Global context to update
 * @param key - Timing metric key
 * @param value - Timing value in milliseconds
 */
export function setTiming(
  ctx: GlobalContext,
  key: keyof GlobalContext['timing'],
  value: number
): void {
  ctx.timing[key] = value;
}
