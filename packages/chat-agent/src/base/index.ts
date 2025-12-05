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
  // Debug information
  AgentDebugInfo,
  AgentNextAction,
  // Agent execution
  AgentResult,
  // Environment
  BaseEnv,
  // State management
  BaseState,
  WorkerInfo,
} from './base-types.js';

export {
  addSubAgent,
  addTool,
  // Debug helpers
  addWorkerInfo,
  // Factory functions
  createBaseState,
  createErrorResult,
  createSuccessResult,
  updateBaseStateTimestamp,
} from './base-types.js';
