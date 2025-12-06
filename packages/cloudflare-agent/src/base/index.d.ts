/**
 * Base types and utilities for Durable Object architecture
 *
 * Exports:
 * - BaseAgent: Abstract base class for all DO agents
 * - BaseState: Common state interface with timestamps
 * - BaseEnv: Minimal environment bindings for all agents
 * - AgentResult: Result type for agent execution
 * - AgentDebugInfo: Debug information for tracing
 * - WorkerInfo: Worker execution metrics
 * - Helper functions for creating and updating states
 */
export { BaseAgent } from './base-agent.js';
export type {
  AgentDebugInfo,
  AgentNextAction,
  AgentResult,
  BaseEnv,
  BaseState,
  WorkerInfo,
} from './base-types.js';
export {
  addSubAgent,
  addTool,
  addWorkerInfo,
  createBaseState,
  createErrorResult,
  createSuccessResult,
  updateBaseStateTimestamp,
} from './base-types.js';
//# sourceMappingURL=index.d.ts.map
