/**
 * Router Agent
 *
 * Classifies incoming queries and routes them to appropriate handlers.
 * Uses LLM-based classification with quick pattern matching for common cases.
 *
 * This is the entry point for all queries in the new routing architecture.
 * Extends BaseAgent and uses ExecutionContext for tracing and debug management.
 */
import { Agent, type AgentNamespace } from 'agents';
import { type AgentResult, type BaseEnv, type BaseState } from '../base/index.js';
import type { AgentProvider, ExecutionContext } from '../execution/index.js';
import { type ResponseTarget } from '../platform-response.js';
import { type QueryClassification, type RouteTarget } from '../routing/index.js';
export type { ResponseTarget } from '../platform-response.js';
/**
 * Pending execution for fire-and-forget pattern
 *
 * Stores ExecutionContext for deferred processing via alarm handler.
 * Allows immediate response to caller while routing continues separately.
 */
export interface PendingExecution {
  /** Unique execution identifier */
  executionId: string;
  /** Query to process */
  query: string;
  /** Execution context for routing (includes tracing, user info, etc.) */
  context: ExecutionContext;
  /** Target for response delivery */
  responseTarget: ResponseTarget;
  /** When execution was scheduled */
  scheduledAt: number;
}
/**
 * Router agent state
 *
 * Extends BaseState for common timestamp tracking.
 */
export interface RouterAgentState extends BaseState {
  /** Session identifier */
  sessionId: string;
  /** Last classification result */
  lastClassification: QueryClassification | undefined;
  /** Routing history for analytics */
  routingHistory: Array<{
    query: string;
    classification: QueryClassification;
    routedTo: RouteTarget;
    timestamp: number;
    durationMs: number;
  }>;
  /** Pending executions for fire-and-forget pattern */
  pendingExecutions?: PendingExecution[] | undefined;
}
/**
 * Environment bindings for router agent
 *
 * Note: Provider-specific fields (AI, AI_GATEWAY_NAME, AI_GATEWAY_API_KEY, OPENROUTER_API_KEY)
 * should be provided by the concrete environment type (e.g., from OpenRouterProviderEnv).
 * This interface only includes shared agent bindings.
 */
export interface RouterAgentEnv extends BaseEnv {
  /**
   * Agent bindings - these are optional since not all may be deployed.
   *
   * IMPORTANT: Router only dispatches to AGENTS, never directly to workers.
   * Workers (CodeWorker, ResearchWorker, GitHubWorker) are dispatched by
   * OrchestratorAgent as part of its ExecutionPlan.
   */
  SimpleAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  OrchestratorAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  HITLAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  LeadResearcherAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  DuyetInfoAgent?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
  /** State DO for centralized observability and watchdog recovery */
  StateDO?: AgentNamespace<Agent<RouterAgentEnv, unknown>>;
}
/**
 * Configuration for router agent
 */
export interface RouterAgentConfig<TEnv extends RouterAgentEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** Maximum routing history to keep */
  maxHistory?: number;
  /** Custom classification prompt override */
  customClassificationPrompt?: string;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Methods exposed by RouterAgent
 */
export interface RouterAgentMethods {
  /** Route a query using the execution context for full tracing support */
  route(ctx: ExecutionContext): Promise<AgentResult>;
  /** Get routing statistics */
  getStats(): {
    totalRouted: number;
    byTarget: Record<string, number>;
    avgDurationMs: number;
  };
  /** Get routing history with optional limit */
  getRoutingHistory(limit?: number): RouterAgentState['routingHistory'];
  /** Get the last classification result */
  getLastClassification(): QueryClassification | undefined;
  /** Clear routing history and classification state */
  clearHistory(): void;
}
/**
 * Type for RouterAgent class
 */
export type RouterAgentClass<TEnv extends RouterAgentEnv> = typeof Agent<TEnv, RouterAgentState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, RouterAgentState>>
  ): Agent<TEnv, RouterAgentState> & RouterAgentMethods;
};
/**
 * Create a Router Agent class
 *
 * @example
 * ```typescript
 * export const RouterAgent = createRouterAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 * });
 * ```
 */
export declare function createRouterAgent<TEnv extends RouterAgentEnv>(
  config: RouterAgentConfig<TEnv>
): RouterAgentClass<TEnv>;
/**
 * Type for router agent instance
 */
export type RouterAgentInstance<TEnv extends RouterAgentEnv> = InstanceType<
  ReturnType<typeof createRouterAgent<TEnv>>
>;
//# sourceMappingURL=router-agent.d.ts.map
