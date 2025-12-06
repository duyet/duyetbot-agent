/**
 * Orchestrator Agent
 *
 * Manages complex task orchestration by:
 * 1. Planning: Decomposing tasks into atomic steps
 * 2. Executing: Running steps in parallel where possible
 * 3. Aggregating: Combining results into unified response
 *
 * Extends BaseAgent to provide standardized agent interface with ExecutionContext
 * for message handling, LLM communication, and execution tracing.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import { BaseAgent } from '../base/base-agent.js';
import type { BaseState } from '../base/base-types.js';
import type { ExecutionContext } from '../execution/index.js';
import { Agent, type AgentNamespace } from 'agents';
import type { AgentResult, BaseEnv } from '../base/base-types.js';
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionPlan } from '../routing/schemas.js';
/**
 * Orchestrator agent state
 *
 * Extends BaseState to include orchestration-specific state.
 * Conversation history is managed via ExecutionContext.conversationHistory,
 * enabling centralized state management where only the parent (CloudflareAgent) stores history.
 */
export interface OrchestratorState extends BaseState {
  /** Session identifier */
  sessionId: string;
  /** Current execution plan */
  currentPlan: ExecutionPlan | undefined;
  /** Execution history for analytics */
  orchestrationHistory: Array<{
    taskId: string;
    summary: string;
    stepCount: number;
    successCount: number;
    failureCount: number;
    totalDurationMs: number;
    timestamp: number;
  }>;
}
/**
 * Environment bindings for orchestrator agent
 */
export interface OrchestratorEnv extends BaseEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  /** Worker agent bindings */
  CodeWorker?: AgentNamespace<Agent<OrchestratorEnv, unknown>>;
  ResearchWorker?: AgentNamespace<Agent<OrchestratorEnv, unknown>>;
  GitHubWorker?: AgentNamespace<Agent<OrchestratorEnv, unknown>>;
  GeneralWorker?: AgentNamespace<Agent<OrchestratorEnv, unknown>>;
}
/**
 * Configuration for orchestrator agent
 */
export interface OrchestratorConfig<TEnv extends OrchestratorEnv> {
  /** Function to create agent provider from env */
  createProvider: (env: TEnv) => AgentProvider;
  /** Maximum steps per plan */
  maxSteps?: number;
  /** Maximum parallel executions */
  maxParallel?: number;
  /** Step timeout in ms */
  stepTimeoutMs?: number;
  /** Continue on step failure */
  continueOnError?: boolean;
  /** Use LLM for result aggregation */
  useLLMAggregation?: boolean;
  /** Maximum history entries to keep */
  maxHistory?: number;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Methods exposed by OrchestratorAgent
 */
export interface OrchestratorMethods {
  orchestrate(ctx: ExecutionContext): Promise<AgentResult>;
  getCurrentPlan(): ExecutionPlan | undefined;
  getStats(): {
    totalOrchestrated: number;
    avgStepsPerTask: number;
    avgDurationMs: number;
    successRate: number;
  };
  clearHistory(): void;
}
/**
 * Type for OrchestratorAgent class
 */
export type OrchestratorAgentClass<TEnv extends OrchestratorEnv> = typeof BaseAgent<
  TEnv,
  OrchestratorState
> & {
  new (
    ...args: ConstructorParameters<typeof BaseAgent<TEnv, OrchestratorState>>
  ): BaseAgent<TEnv, OrchestratorState> & OrchestratorMethods;
};
/**
 * Create an Orchestrator Agent class
 *
 * @example
 * ```typescript
 * export const OrchestratorAgent = createOrchestratorAgent({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   maxSteps: 10,
 *   maxParallel: 3,
 * });
 * ```
 */
export declare function createOrchestratorAgent<TEnv extends OrchestratorEnv>(
  config: OrchestratorConfig<TEnv>
): OrchestratorAgentClass<TEnv>;
/**
 * Type for orchestrator agent instance
 */
export type OrchestratorAgentInstance<TEnv extends OrchestratorEnv> = InstanceType<
  ReturnType<typeof createOrchestratorAgent<TEnv>>
>;
//# sourceMappingURL=orchestrator-agent.d.ts.map
