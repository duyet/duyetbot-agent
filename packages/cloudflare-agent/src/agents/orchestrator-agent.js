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
import { logger } from '@duyetbot/hono-middleware';
import { BaseAgent } from '../base/base-agent.js';
import { agentRegistry } from './registry.js';

// =============================================================================
// Agent Self-Registration
// =============================================================================
/**
 * Register OrchestratorAgent with the agent registry.
 * Handles complex multi-step tasks requiring planning and coordination.
 * Priority is medium (40) - specialized agents should be checked first.
 */
agentRegistry.register({
  name: 'orchestrator-agent',
  description:
    'Handles complex multi-step tasks requiring planning, decomposition, and coordination of multiple workers. Use for tasks that need code analysis, research synthesis, GitHub operations, or any combination of specialized capabilities.',
  examples: [
    'refactor this module and create a PR',
    'analyze this codebase and suggest improvements',
    'research best practices and implement them',
    'fix this bug across multiple files',
    'create a comprehensive documentation',
  ],
  triggers: {
    keywords: [
      'refactor',
      'analyze and',
      'research and',
      'create pr',
      'pull request',
      'comprehensive',
      'across files',
      'multiple',
    ],
    patterns: [
      /\b(refactor|rewrite)\s+(this|the)\s+\w+/i,
      /\banalyze\s+.*(and|then)\s+(fix|implement|create)/i,
      /\b(create|open|submit)\s+(a\s+)?(pr|pull\s+request)\b/i,
      /\bfix\s+.*(across|in\s+multiple)\s+files?\b/i,
    ],
    categories: ['code', 'github', 'complex'],
  },
  capabilities: {
    tools: ['code_tools', 'github_api', 'web_search', 'planning'],
    complexity: 'high',
  },
  priority: 40, // Medium priority - after specialized agents
});

import { Agent, getAgentByName } from 'agents';
import {
  aggregateResults,
  createPlan,
  executePlan,
  quickAggregate,
  validatePlanDependencies,
} from '../orchestration/index.js';
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
export function createOrchestratorAgent(config) {
  const maxSteps = config.maxSteps ?? 10;
  const maxParallel = config.maxParallel ?? 3;
  const stepTimeoutMs = config.stepTimeoutMs ?? 60000;
  const continueOnError = config.continueOnError ?? true;
  const useLLMAggregation = config.useLLMAggregation ?? true;
  const maxHistory = config.maxHistory ?? 50;
  const debug = config.debug ?? false;
  const AgentClass = class OrchestratorAgent extends BaseAgent {
    initialState = {
      sessionId: '',
      currentPlan: undefined,
      orchestrationHistory: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    /**
     * Handle state updates
     */
    onStateUpdate(state, source) {
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
     *
     * Manages the full orchestration workflow:
     * 1. Plan task decomposition using LLM
     * 2. Execute steps in parallel
     * 3. Aggregate results with LLM or quick aggregation
     *
     * @param ctx - ExecutionContext containing query and conversation history
     * @returns AgentResult with orchestration response and metadata
     */
    async orchestrate(ctx) {
      const startTime = Date.now();
      logger.info('[OrchestratorAgent] Starting orchestration', {
        spanId: ctx.spanId,
        queryLength: ctx.query.length,
      });
      try {
        const env = this.env;
        const provider = config.createProvider(env);
        this.setProvider(provider);
        // Update UI: show thinking status
        await this.updateThinking(ctx, 'Planning task decomposition');
        // Step 1: Create execution plan
        const plannerConfig = {
          provider,
          maxSteps,
          debug,
        };
        const planningContext = {
          availableWorkers: this.getAvailableWorkers(env),
          ...(ctx.platform ? { platform: String(ctx.platform) } : {}),
        };
        const plan = await createPlan(ctx.query, plannerConfig, planningContext);
        // Validate plan
        const validation = validatePlanDependencies(plan);
        if (!validation.valid) {
          logger.error('[OrchestratorAgent] Invalid plan', {
            spanId: ctx.spanId,
            errors: validation.errors,
          });
          return {
            success: false,
            error: `Invalid plan: ${validation.errors.join(', ')}`,
            durationMs: Date.now() - startTime,
          };
        }
        // Update state with current plan
        this.setState({
          ...this.state,
          currentPlan: plan,
          sessionId: this.state.sessionId || ctx.chatId?.toString() || ctx.traceId,
          updatedAt: Date.now(),
        });
        logger.info('[OrchestratorAgent] Plan created', {
          spanId: ctx.spanId,
          taskId: plan.taskId,
          stepCount: plan.steps.length,
          complexity: plan.estimatedComplexity,
        });
        // Update UI: show execution status
        await this.updateThinking(ctx, `Executing ${plan.steps.length} steps`);
        // Step 2: Execute plan
        const dispatcher = this.createDispatcher(env, ctx);
        const executorConfig = {
          dispatcher,
          maxParallel,
          stepTimeoutMs,
          continueOnError,
          debug,
        };
        const executionResult = await executePlan(plan, ctx, executorConfig);
        // Track orchestration execution
        this.recordExecution(ctx, 'orchestrator-agent', Date.now() - startTime);
        // Update UI: show aggregation status
        await this.updateThinking(ctx, 'Synthesizing results');
        // Step 3: Aggregate results
        let aggregationResult;
        if (useLLMAggregation) {
          const aggregatorConfig = {
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
        logger.info('[OrchestratorAgent] Orchestration completed', {
          spanId: ctx.spanId,
          taskId: plan.taskId,
          durationMs,
          successCount: executionResult.successfulSteps.length,
          failureCount: executionResult.failedSteps.length,
        });
        // Build worker debug info from execution results
        const workers = plan.steps
          .filter((step) => executionResult.results.has(step.id))
          .map((step) => {
            const result = executionResult.results.get(step.id);
            const workerInfo = {
              name: `${step.workerType}-worker`,
              status: result?.success ? 'success' : 'failed',
              durationMs: result?.durationMs ?? 0,
            };
            if (result?.error) {
              workerInfo.error = result.error;
            }
            return workerInfo;
          });
        // Build result with orchestration data
        const result = {
          success: true,
          content: aggregationResult.response,
          durationMs,
          data: {
            newMessages: [
              { role: 'user', content: ctx.query },
              {
                role: 'assistant',
                content: aggregationResult.response,
              },
            ],
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
        };
        // Add worker debug info if available
        if (workers.length > 0) {
          result.debug = { workers };
        }
        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        logger.error('[OrchestratorAgent] Orchestration failed', {
          spanId: ctx.spanId,
          durationMs,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        };
      }
    }
    /**
     * Get available worker types based on environment bindings
     */
    getAvailableWorkers(env) {
      const available = ['general'];
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
     *
     * @param env - Environment bindings
     * @param ctx - ExecutionContext for tracing and worker coordination
     * @returns WorkerDispatcher function for executing individual steps
     */
    createDispatcher(env, ctx) {
      return async (workerType, input) => {
        const startTime = Date.now();
        try {
          // Get the appropriate worker namespace
          const workerNamespace = this.getWorkerNamespace(env, workerType);
          if (!workerNamespace) {
            // Fallback to inline execution
            return this.executeInline(workerType, input, env);
          }
          // Get worker instance
          const workerId = `${ctx.traceId}_${input.step.id}`;
          const worker = await getAgentByName(workerNamespace, workerId);
          // Execute step
          const result = await worker.execute(input);
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
    getWorkerNamespace(env, workerType) {
      switch (workerType) {
        case 'code':
          return env.CodeWorker;
        case 'research':
          return env.ResearchWorker;
        case 'github':
          return env.GitHubWorker;
        case 'general':
          return env.GeneralWorker;
        default:
          return undefined;
      }
    }
    /**
     * Fallback inline execution when workers are not available
     */
    async executeInline(workerType, input, env) {
      const startTime = Date.now();
      const { step, dependencyResults } = input;
      try {
        const provider = config.createProvider(env);
        // Build context from dependencies
        let contextStr = '';
        if (dependencyResults.size > 0) {
          const parts = ['## Previous Step Results'];
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
            role: 'system',
            content: `You are a ${workerType} specialist. Complete the assigned task efficiently.`,
          },
          {
            role: 'user',
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
    updateHistory(plan, executionResult, durationMs) {
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
    getCurrentPlan() {
      return this.state.currentPlan;
    }
    /**
     * Get orchestration statistics
     */
    getStats() {
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
     * @deprecated This agent is stateless for conversation messages. Only clears orchestration history.
     */
    clearHistory() {
      // Conversation history is managed by parent agent
      logger.info(
        '[OrchestratorAgent] clearHistory called - clearing orchestration history only (conversation history is stateless)'
      );
      this.setState({
        ...this.state,
        orchestrationHistory: [],
        currentPlan: undefined,
        updatedAt: Date.now(),
      });
    }
  };
  return AgentClass;
}
