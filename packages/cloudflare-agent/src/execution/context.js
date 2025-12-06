/**
 * ExecutionContext and related types
 *
 * Provides execution context for agent operations in the Durable Object architecture.
 * Tracks trace identifiers, platform origin, message references, timing, and debug information.
 */
import { randomUUID } from 'node:crypto';
/**
 * Generate a new trace ID using UUID v4
 *
 * @returns New trace ID
 */
export function createTraceId() {
  return randomUUID();
}
/**
 * Generate a new span ID using UUID v4
 *
 * @returns New span ID
 */
export function createSpanId() {
  return randomUUID();
}
/**
 * Create an empty debug accumulator
 *
 * @returns Initialized DebugAccumulator
 */
export function createDebugAccumulator() {
  return {
    agentChain: [],
    toolCalls: [],
    warnings: [],
    errors: [],
  };
}
/**
 * Record an agent execution span in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param agent - Agent name
 * @param spanId - Span ID for this execution
 * @param durationMs - Duration in milliseconds
 * @param parentSpanId - Parent span ID for correlation (optional)
 */
export function recordAgentSpan(debug, agent, spanId, durationMs, parentSpanId) {
  debug.agentChain.push({
    agent,
    spanId,
    ...(parentSpanId && { parentSpanId }),
    durationMs,
    timestamp: Date.now(),
  });
}
/**
 * Record a tool call in the debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param toolCall - Tool call information
 */
export function recordToolCall(debug, toolCall) {
  debug.toolCalls.push(toolCall);
}
/**
 * Add a warning message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param warning - Warning message
 */
export function addDebugWarning(debug, warning) {
  debug.warnings.push(warning);
}
/**
 * Add an error message to debug accumulator
 *
 * @param debug - Debug accumulator to update
 * @param error - Error message
 */
export function addDebugError(debug, error) {
  debug.errors.push(error);
}
/**
 * Create an ExecutionContext from ParsedInput (backward compatibility)
 *
 * @param input - ParsedInput containing extracted message data
 * @param platform - Platform identifier
 * @returns ExecutionContext with basic initialization
 *
 * @deprecated Use direct ExecutionContext creation instead
 */
export function createExecutionContext(input, platform) {
  const traceId = createTraceId();
  const spanId = createSpanId();
  const eventId = input.metadata?.eventId;
  return {
    traceId,
    spanId,
    ...(eventId && { eventId }),
    platform: platform || 'api',
    userId: input.userId,
    chatId: input.chatId,
    ...(input.username && { username: input.username }),
    userMessageId: input.messageRef || 0,
    provider: 'claude',
    model: 'claude-3-5-sonnet-20241022',
    query: input.text,
    conversationHistory: [],
    debug: createDebugAccumulator(),
    startedAt: Date.now(),
    deadline: Date.now() + 30000,
  };
}
