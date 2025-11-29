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

import { logger } from '@duyetbot/hono-middleware';
import { Agent, type Connection } from 'agents';
import { type AgentContext, AgentMixin } from '../agents/base-agent.js';
import type { PlanStep, WorkerResult } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import {
  type WorkerType,
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
} from './worker-utils.js';

// Re-export utilities from worker-utils for convenience
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
// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty - extend with provider env
export interface BaseWorkerEnv {}

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
  getStats(): { tasksExecuted: number; lastExecutedAt: number | undefined };
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
 * Default prompt builder
 */
function defaultBuildPrompt(step: PlanStep, dependencyContext: string): string {
  const parts: string[] = [];

  if (dependencyContext) {
    parts.push(dependencyContext);
  }

  parts.push(`## Task\n${step.task}`);
  parts.push(`\n## Expected Output Type: ${step.expectedOutput}`);
  parts.push('\n## Instructions');
  parts.push(`- ${step.description}`);
  parts.push('- Provide a clear, structured response');
  parts.push('- If you need to output code, wrap it in appropriate code blocks');

  return parts.join('\n');
}

/**
 * Default response parser
 */
function defaultParseResponse(content: string, expectedOutput: string): unknown {
  switch (expectedOutput) {
    case 'code': {
      // Extract code blocks if present
      const codeMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
      return codeMatch?.[1] ? codeMatch[1].trim() : content;
    }

    case 'data': {
      // Try to parse as JSON
      try {
        const jsonMatch = content.match(/```json\n?([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
          return JSON.parse(jsonMatch[1]);
        }
        // Try direct JSON parse
        return JSON.parse(content);
      } catch {
        return content;
      }
    }

    case 'action':
      // Return structured action data
      return { action: 'completed', result: content };
    default:
      return content;
  }
}

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
export function createBaseWorker<TEnv extends BaseWorkerEnv>(
  config: BaseWorkerConfig<TEnv>
): WorkerClass<TEnv> {
  const debug = config.debug ?? false;
  const buildPrompt = config.buildPrompt ?? defaultBuildPrompt;
  const parseResponse = config.parseResponse ?? defaultParseResponse;

  const WorkerClass = class BaseWorker extends Agent<TEnv, BaseWorkerState> {
    override initialState: BaseWorkerState = {
      workerId: '',
      tasksExecuted: 0,
      lastExecutedAt: undefined,
      createdAt: Date.now(),
    };

    /**
     * Handle state updates
     */
    override onStateUpdate(state: BaseWorkerState, source: 'server' | Connection): void {
      if (debug) {
        logger.info(`[${config.workerType}-worker] State updated`, {
          source,
          tasksExecuted: state.tasksExecuted,
        });
      }
    }

    /**
     * Execute a task step
     */
    async execute(input: WorkerInput): Promise<WorkerResult> {
      const startTime = Date.now();
      const { step, dependencyResults, traceId } = input;

      AgentMixin.log(`${config.workerType}-worker`, 'Executing step', {
        traceId,
        stepId: step.id,
        task: step.task.slice(0, 100),
      });

      try {
        // Get LLM provider (pass context for AI Gateway credentials)
        const env = (this as unknown as { env: TEnv }).env;
        const provider = config.createProvider(env, input.context);

        // Build context from dependencies
        const dependencyContext = formatDependencyContext(dependencyResults);

        // Build messages for LLM
        const messages: Array<{
          role: 'system' | 'user' | 'assistant';
          content: string;
        }> = [
          { role: 'system', content: config.systemPrompt },
          {
            role: 'user',
            content: buildPrompt(step, dependencyContext),
          },
        ];

        // Call LLM
        const response = await provider.chat(messages);
        const durationMs = Date.now() - startTime;

        // Update state
        this.setState({
          ...this.state,
          workerId: this.state.workerId || traceId,
          tasksExecuted: this.state.tasksExecuted + 1,
          lastExecutedAt: Date.now(),
        });

        AgentMixin.log(`${config.workerType}-worker`, 'Step completed', {
          traceId,
          stepId: step.id,
          durationMs,
        });

        // Parse response based on expected output type
        const data = parseResponse(response.content, step.expectedOutput);

        return {
          stepId: step.id,
          success: true,
          data,
          durationMs,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;

        AgentMixin.logError(`${config.workerType}-worker`, 'Step failed', error, {
          traceId,
          stepId: step.id,
          durationMs,
        });

        return {
          stepId: step.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs,
        };
      }
    }

    /**
     * Get worker statistics
     */
    getStats(): { tasksExecuted: number; lastExecutedAt: number | undefined } {
      return {
        tasksExecuted: this.state.tasksExecuted,
        lastExecutedAt: this.state.lastExecutedAt,
      };
    }
  };

  return WorkerClass as WorkerClass<TEnv>;
}
