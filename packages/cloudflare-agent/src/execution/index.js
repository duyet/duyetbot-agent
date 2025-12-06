/**
 * Execution Module
 *
 * Provides types and interfaces for agent execution:
 * - ExecutionContext (DO architecture): Full context for Durable Objects
 * - ProviderExecutionContext (AgentProvider): Simplified context for transport layer
 * - AgentProvider: Unified LLM + Transport interface
 */
// Agent Provider interfaces (transport layer)
export { createProviderContext } from './agent-provider.js';
// Context types and functions (DO architecture)
export {
  addDebugError,
  addDebugWarning,
  createDebugAccumulator,
  createExecutionContext,
  createSpanId,
  createTraceId,
  recordAgentSpan,
  recordToolCall,
} from './context.js';
