/**
 * Base Types for Durable Object Architecture
 *
 * Provides foundational types for all DO-based agents and services.
 * These types define the common interfaces that all DO implementations extend.
 */
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Create an initial base state with current timestamp
 *
 * @returns BaseState with timestamps set to now
 *
 * @example
 * ```typescript
 * const state = createBaseState();
 * // { createdAt: 1234567890, updatedAt: 1234567890 }
 * ```
 */
export function createBaseState() {
  const now = Date.now();
  return {
    createdAt: now,
    updatedAt: now,
  };
}
/**
 * Create a successful agent result
 *
 * @param content - The response content
 * @param durationMs - Execution duration in milliseconds
 * @param extra - Optional additional fields
 * @returns AgentResult with success=true
 */
export function createSuccessResult(content, durationMs, extra) {
  return {
    success: true,
    content,
    durationMs,
    ...extra,
  };
}
/**
 * Create a failed agent result
 *
 * @param error - The error message or Error object
 * @param durationMs - Execution duration in milliseconds
 * @param extra - Optional additional fields
 * @returns AgentResult with success=false
 */
export function createErrorResult(error, durationMs, extra) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    success: false,
    error: errorMessage,
    durationMs,
    ...extra,
  };
}
/**
 * Update timestamps on a base state to current time
 *
 * @param state - The state to update
 * @returns Updated state with new updatedAt timestamp
 */
export function updateBaseStateTimestamp(state) {
  return {
    ...state,
    updatedAt: Date.now(),
  };
}
/**
 * Add worker info to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param worker - Worker info to add
 * @returns Updated debug info
 */
export function addWorkerInfo(debug, worker) {
  const existing = debug ?? {};
  return {
    ...existing,
    workers: [...(existing.workers ?? []), worker],
  };
}
/**
 * Add sub-agent to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param subAgent - Sub-agent name to add
 * @returns Updated debug info
 */
export function addSubAgent(debug, subAgent) {
  const existing = debug ?? {};
  return {
    ...existing,
    subAgents: [...(existing.subAgents ?? []), subAgent],
  };
}
/**
 * Add tool to debug info
 *
 * @param debug - The debug info object (creates one if undefined)
 * @param tool - Tool name to add
 * @returns Updated debug info
 */
export function addTool(debug, tool) {
  const existing = debug ?? {};
  return {
    ...existing,
    tools: [...(existing.tools ?? []), tool],
  };
}
