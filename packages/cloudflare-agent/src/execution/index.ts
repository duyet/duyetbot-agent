/**
 * Execution Module
 *
 * Provides types and interfaces for agent execution:
 * - ExecutionContext (DO architecture): Full context for Durable Objects
 * - ProviderExecutionContext (AgentProvider): Simplified context for transport layer
 * - AgentProvider: Unified LLM + Transport interface
 */

// Agent Provider interfaces (transport layer)
export {
  type AgentProvider,
  type ChatOptions,
  createProviderContext,
  type ExtendedAgentProvider,
  type ParsedInputOptions,
  type ProviderExecutionContext,
} from './agent-provider.js';
// Context types and functions (DO architecture)
export {
  type AgentSpan,
  addDebugError,
  addDebugWarning,
  createDebugAccumulator,
  createExecutionContext,
  createSpanId,
  createTraceId,
  type DebugAccumulator,
  type DebugToolCall,
  type ExecutionContext,
  type Platform,
  recordAgentSpan,
  recordToolCall,
} from './context.js';
