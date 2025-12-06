/**
 * Execution Module
 *
 * Provides types and interfaces for agent execution:
 * - ExecutionContext (DO architecture): Full context for Durable Objects
 * - ProviderExecutionContext (AgentProvider): Simplified context for transport layer
 * - AgentProvider: Unified LLM + Transport interface
 */
export {
  type AgentProvider,
  type ChatOptions,
  createProviderContext,
  type ExtendedAgentProvider,
  type ParsedInputOptions,
  type ProviderExecutionContext,
} from './agent-provider.js';
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
//# sourceMappingURL=index.d.ts.map
