/**
 * Orchestrator Agent
 *
 * Manages complex task orchestration by:
 * 1. Planning: Decomposing tasks into atomic steps
 * 2. Executing: Running steps in parallel where possible
 * 3. Aggregating: Combining results into unified response
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type AgentNamespace, type Connection, getAgentByName } from 'agents';
import {
  type AggregationResult,
  type AggregatorConfig,
  type ExecutionResult,
  type ExecutorConfig,
  type PlannerConfig,
  type WorkerDispatcher,
  aggregateResults,
  createPlan,
  executePlan,
  quickAggregate,
  validatePlanDependencies,
} from '../orchestration/index.js';
import type { ExecutionPlan, WorkerResult } from '../routing/schemas.js';
import type { LLMProvider, Message } from '../types.js';
import type { WorkerInput, WorkerType } from '../workers/base-worker.js';
import { type AgentContext, AgentMixin, type AgentResult } from './base-agent.js';

/**
 * Orchestrator agent state
 */
export interface OrchestratorAgentState {
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
  /** Conversation messages */
  messages: Message[];
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Environment bindings for orchestrator agent
 */
export interface OrchestratorAgentEnv {
  /** LLM provider configuration */
  AI_GATEWAY_ACCOUNT_ID?: string;
  AI_GATEWAY_ID?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;

  /** Worker agent bindings */
  CodeWorker?: AgentNamespace<Agent<OrchestratorAgentEnv, unknown>>;
  ResearchWorker?: AgentNamespace<Agent<OrchestratorAgentEnv, unknown>>;
  GitHubWorker?: AgentNamespace<Agent<OrchestratorAgentEnv, unknown>>;
  GeneralWorker?: AgentNamespace<Agent<OrchestratorAgentEnv, unknown>>;
}

/**
 * Configuration for orchestrator agent
 */
export interface OrchestratorAgentConfig<TEnv extends OrchestratorAgentEnv> {
  /** Function to create LLM provider from env */
  createProvider: (env: TEnv) => LLMProvider;
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
export interface OrchestratorAgentMethods {
  orchestrate(query: string, context: AgentContext): Promise<AgentResult>;
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
export type OrchestratorAgentClass<TEnv extends OrchestratorAgentEnv> = typeof Agent<
  TEnv,
  OrchestratorAgentState
> & {
  new (
    ...args: ConstructorParameters<typeof Agent<TEnv, OrchestratorAgentState>>
  ): Agent<TEnv, OrchestratorAgentState> & OrchestratorAgentMethods;
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
export function createOrchestratorAgent<TEnv extends OrchestratorAgentEnv>(
  config: OrchestratorAgentConfig<TEnv>
): OrchestratorAgentClass<TEnv> {
  const maxSteps = config.maxSteps ?? 10;
  const maxParallel = config.maxParallel ?? 3;
  const stepTimeoutMs = config.stepTimeoutMs ?? 60000;
  const continueOnError = config.continueOnError ?? true;
  const useLLMAggregation = config.useLLMAggregation ?? true;
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;

  const AgentClass = class OrchestratorAgent extends Agent<TEnv, OrchestratorAgentState> {
    override initialState: OrchestratorAgentState = {
      sessionId: '',
      currentPlan: undefined,
      orchestrationHistory: [],
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: OrchestratorAgentState, source: 'server' | Connection): void {
      if (debug) {
        logger.info('[OrchestratorAgent] State updated', {
          source,
          hasPlan: !!state.currentPlan,
          historyCount: state.orchestrationHistory.length,
        });
      }
    }

    /**
     * Main orchestration entry point
     */
    async orchestrate(query: string, context: AgentContext): Promise<AgentResult> {
      const startTime = Date.now();
      const traceId = context.traceId ?? AgentMixin.generateId('trace');

      AgentMixin.log('OrchestratorAgent', 'Starting orchestration', {
        traceId,
        queryLength: query.length,
      });

      try {
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env);

        // Step 1: Create execution plan
        const plannerConfig: PlannerConfig = {
          provider,
          maxSteps,
          debug,
        };

        const planningContext = {
          availableWorkers: this.getAvailableWorkers(env),
          ...(context.platform ? { platform: String(context.platform) } : {}),
        };
        const plan = await createPlan(query, plannerConfig, planningContext);

        // Validate plan
        const validation = validatePlanDependencies(plan);
        if (!validation.valid) {
          AgentMixin.logError('OrchestratorAgent', 'Invalid plan', validation.errors);
          return AgentMixin.createErrorResult(
            new Error(`Invalid plan: ${validation.errors.join(', ')}`),
            Date.now() - startTime
          );
        }

        // Update state with current plan
        this.setState({
          ...this.state,
          currentPlan: plan,
          sessionId: this.state.sessionId || context.chatId?.toString() || traceId,
          updatedAt: Date.now(),
        });

        AgentMixin.log('OrchestratorAgent', 'Plan created', {
          traceId,
          taskId: plan.taskId,
          stepCount: plan.steps.length,
          complexity: plan.estimatedComplexity,
        });

        // Step 2: Execute plan
        const dispatcher = this.createDispatcher(env, traceId);
        const executorConfig: ExecutorConfig = {
          dispatcher,
          maxParallel,
          stepTimeoutMs,
          continueOnError,
          debug,
        };

        const executionResult = await executePlan(plan, { ...context, traceId }, executorConfig);

        // Step 3: Aggregate results
        let aggregationResult: AggregationResult;
        if (useLLMAggregation) {
          const aggregatorConfig: AggregatorConfig = {
            provider,
            debug,
          };
          aggregationResult = await aggregateResults(plan, executionResult, aggregatorConfig);
        } else {
          aggregationResult = quickAggregate(plan, executionResult);
        }

        const durationMs = Date.now() - startTime;

        // Update history
        this.updateHistory(plan, executionResult, durationMs);

        AgentMixin.log('OrchestratorAgent', 'Orchestration completed', {
          traceId,
          taskId: plan.taskId,
          durationMs,
          successCount: executionResult.successfulSteps.length,
          failureCount: executionResult.failedSteps.length,
        });

        return AgentMixin.createResult(true, aggregationResult.response, durationMs, {
          data: {
            plan: {
              taskId: plan.taskId,
              summary: plan.summary,
              stepCount: plan.steps.length,
            },
            execution: {
              successCount: executionResult.successfulSteps.length,
              failureCount: executionResult.failedSteps.length,
              skippedCount: executionResult.skippedSteps.length,
            },
            errors: aggregationResult.errors,
          },
          nextAction: executionResult.allSucceeded ? 'complete' : 'continue',
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;
        AgentMixin.logError('OrchestratorAgent', 'Orchestration failed', error, {
          traceId,
          durationMs,
        });
        return AgentMixin.createErrorResult(error, durationMs);
      }
    }

    /**
     * Get available worker types based on environment bindings
     */
    private getAvailableWorkers(env: TEnv): Array<'code' | 'research' | 'github' | 'general'> {
      const available: Array<'code' | 'research' | 'github' | 'general'> = ['general'];

      if (env.CodeWorker) {
        available.push('code');
      }
      if (env.ResearchWorker) {
        available.push('research');
      }
      if (env.GitHubWorker) {
        available.push('github');
      }

      return available;
    }

    /**
     * Create a dispatcher for executing steps
     */
    private createDispatcher(env: TEnv, traceId: string): WorkerDispatcher {
      return async (workerType: WorkerType, input: WorkerInput): Promise<WorkerResult> => {
        const startTime = Date.now();

        try {
          // Get the appropriate worker namespace
          const workerNamespace = this.getWorkerNamespace(env, workerType);

          if (!workerNamespace) {
            // Fallback to inline execution
            return this.executeInline(workerType, input, env);
          }

          // Get worker instance
          const workerId = `${traceId}_${input.step.id}`;
          const worker = await getAgentByName(workerNamespace, workerId);

          // Execute step
          const result = await (
            worker as unknown as {
              execute: (input: WorkerInput) => Promise<WorkerResult>;
            }
          ).execute(input);

          return result;
        } catch (error) {
          return {
            stepId: input.step.id,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          };
        }
      };
    }

    /**
     * Get worker namespace by type
     */
    private getWorkerNamespace(
      env: TEnv,
      workerType: WorkerType
    ): AgentNamespace<Agent<TEnv, unknown>> | undefined {
      switch (workerType) {
        case 'code':
          return env.CodeWorker as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'research':
          return env.ResearchWorker as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'github':
          return env.GitHubWorker as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        case 'general':
          return env.GeneralWorker as AgentNamespace<Agent<TEnv, unknown>> | undefined;
        default:
          return undefined;
      }
    }

    /**
     * Fallback inline execution when workers are not available
     */
    private async executeInline(
      workerType: WorkerType,
      input: WorkerInput,
      env: TEnv
    ): Promise<WorkerResult> {
      const startTime = Date.now();
      const { step, dependencyResults } = input;

      try {
        const provider = config.createProvider(env);

        // Build context from dependencies
        let contextStr = '';
        if (dependencyResults.size > 0) {
          const parts: string[] = ['## Previous Step Results'];
          for (const [stepId, result] of dependencyResults) {
            if (result.success) {
              const dataStr =
                typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
              parts.push(`### ${stepId}\n${dataStr.slice(0, 500)}`);
            }
          }
          contextStr = parts.join('\n\n');
        }

        // Simple LLM-based execution
        const messages = [
          {
            role: 'system' as const,
            content: `You are a ${workerType} specialist. Complete the assigned task efficiently.`,
          },
          {
            role: 'user' as const,
            content: `${contextStr ? `${contextStr}\n\n` : ''}## Task\n${step.task}\n\n## Instructions\n${step.description}`,
          },
        ];

        const response = await provider.chat(messages);

        return {
          stepId: step.id,
          success: true,
          data: response.content,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        return {
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        };
      }
    }

    /**
     * Update orchestration history
     */
    private updateHistory(
      plan: ExecutionPlan,
      executionResult: ExecutionResult,
      durationMs: number
    ): void {
      const historyEntry = {
        taskId: plan.taskId,
        summary: plan.summary,
        stepCount: plan.steps.length,
        successCount: executionResult.successfulSteps.length,
        failureCount: executionResult.failedSteps.length,
        totalDurationMs: durationMs,
        timestamp: Date.now(),
      };

      this.setState({
        ...this.state,
        currentPlan: undefined, // Clear current plan after completion
        orchestrationHistory: [
          ...this.state.orchestrationHistory.slice(-(maxHistory - 1)),
          historyEntry,
        ],
        updatedAt: Date.now(),
      });
    }

    /**
     * Get current execution plan
     */
    getCurrentPlan(): ExecutionPlan | undefined {
      return this.state.currentPlan;
    }

    /**
     * Get orchestration statistics
     */
    getStats(): {
      totalOrchestrated: number;
      avgStepsPerTask: number;
      avgDurationMs: number;
      successRate: number;
    } {
      const history = this.state.orchestrationHistory;

      if (history.length === 0) {
        return {
          totalOrchestrated: 0,
          avgStepsPerTask: 0,
          avgDurationMs: 0,
          successRate: 0,
        };
      }

      const totalSteps = history.reduce((sum, h) => sum + h.stepCount, 0);
      const totalDuration = history.reduce((sum, h) => sum + h.totalDurationMs, 0);
      const totalSuccesses = history.reduce((sum, h) => sum + h.successCount, 0);
      const totalAttempted = history.reduce((sum, h) => sum + h.successCount + h.failureCount, 0);

      return {
        totalOrchestrated: history.length,
        avgStepsPerTask: totalSteps / history.length,
        avgDurationMs: totalDuration / history.length,
        successRate: totalAttempted > 0 ? totalSuccesses / totalAttempted : 0,
      };
    }

    /**
     * Clear orchestration history
     */
    clearHistory(): void {
      this.setState({
        ...this.state,
        orchestrationHistory: [],
        currentPlan: undefined,
        updatedAt: Date.now(),
      });
    }
  };

  return AgentClass as OrchestratorAgentClass<TEnv>;
}

/**
 * Type for orchestrator agent instance
 */
export type OrchestratorAgentInstance<TEnv extends OrchestratorAgentEnv> = InstanceType<
  ReturnType<typeof createOrchestratorAgent<TEnv>>
>;
