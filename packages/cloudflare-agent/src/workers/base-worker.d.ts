/**
 * Base Worker
 *
 * Abstract base class for all specialized workers in the Orchestrator-Workers pattern.
 * Workers are lightweight, stateless executors that handle single-domain tasks.
 *
 * Unlike agents which maintain conversation state, workers focus on
 * executing specific task types (code, research, github) and returning results.
 *
 * IMPORTANT: Workers are ONLY called by OrchestratorAgent with a proper WorkerInput.
 * DO NOT call workers directly from RouterAgent or other agents.
 * Workers expect a PlanStep and return WorkerResult, not AgentResult.
 *
 * @see https://developers.cloudflare.com/agents/patterns/
 */
import { Agent } from 'agents';
import { type AgentContext } from '../agents/base-agent.js';
import type { PlanStep, WorkerResult } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import {
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
  type WorkerType,
} from './worker-utils.js';
export { formatDependencyContext, isSuccessfulResult, summarizeResults };
export type { WorkerType };
/**
 * Input passed to workers for execution
 */
export interface WorkerInput {
  /** The plan step to execute */
  step: PlanStep;
  /** Results from dependent steps */
  dependencyResults: Map<string, WorkerResult>;
  /** Additional context from orchestrator */
  context: AgentContext;
  /** Trace ID for distributed tracing */
  traceId: string;
}
/**
 * Base worker state - minimal since workers are mostly stateless
 */
export interface BaseWorkerState {
  /** Worker instance ID */
  workerId: string;
  /** Number of tasks executed */
  tasksExecuted: number;
  /** Last execution timestamp */
  lastExecutedAt: number | undefined;
  /** Creation timestamp */
  createdAt: number;
}
/**
 * Environment bindings for workers
 * Note: Actual env fields depend on the provider (OpenRouterProviderEnv, etc.)
 * This interface is kept minimal - extend with provider-specific env in your app
 */
export type BaseWorkerEnv = {};
/**
 * Configuration for base worker
 */
export interface BaseWorkerConfig<TEnv extends BaseWorkerEnv> {
  /** Function to create LLM provider from env, optionally with context for credentials */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Worker type for identification */
  workerType: WorkerType;
  /** System prompt for the worker's domain */
  systemPrompt: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Enable detailed logging */
  debug?: boolean;
  /** Custom prompt builder */
  buildPrompt?: (step: PlanStep, dependencyContext: string) => string;
  /** Custom response parser */
  parseResponse?: (content: string, expectedOutput: string) => unknown;
}
/**
 * Methods exposed by workers
 */
export interface WorkerMethods {
  execute(input: WorkerInput): Promise<WorkerResult>;
  getStats(): {
    tasksExecuted: number;
    lastExecutedAt: number | undefined;
  };
}
/**
 * Type for Worker class
 */
export type WorkerClass<TEnv extends BaseWorkerEnv> = typeof Agent<TEnv, BaseWorkerState> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, BaseWorkerState>>
  ): Agent<TEnv, BaseWorkerState> & WorkerMethods;
};
/**
 * Create a base worker class factory
 *
 * This provides common functionality that specialized workers can use.
 *
 * @example
 * ```typescript
 * const CodeWorker = createBaseWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   workerType: 'code',
 *   systemPrompt: 'You are a code analysis expert...',
 * });
 * ```
 */
export declare function createBaseWorker<TEnv extends BaseWorkerEnv>(
  config: BaseWorkerConfig<TEnv>
): WorkerClass<TEnv>;
//# sourceMappingURL=base-worker.d.ts.map
