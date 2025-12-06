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
import { Agent } from 'agents';
import { AgentMixin } from '../agents/base-agent.js';
import { formatDependencyContext, isSuccessfulResult, summarizeResults } from './worker-utils.js';
// Re-export utilities from worker-utils for convenience
export { formatDependencyContext, isSuccessfulResult, summarizeResults };
/**
 * Default prompt builder
 */
function defaultBuildPrompt(step, dependencyContext) {
  const parts = [];
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
function defaultParseResponse(content, expectedOutput) {
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
export function createBaseWorker(config) {
  const debug = config.debug ?? false;
  const buildPrompt = config.buildPrompt ?? defaultBuildPrompt;
  const parseResponse = config.parseResponse ?? defaultParseResponse;
  const WorkerClass = class BaseWorker extends Agent {
    initialState = {
      workerId: '',
      tasksExecuted: 0,
      lastExecutedAt: undefined,
      createdAt: Date.now(),
    };
    /**
     * Handle state updates
     */
    onStateUpdate(state, source) {
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
    async execute(input) {
      const startTime = Date.now();
      const { step, dependencyResults, traceId } = input;
      AgentMixin.log(`${config.workerType}-worker`, 'Executing step', {
        traceId,
        stepId: step.id,
        task: step.task.slice(0, 100),
      });
      try {
        // Get LLM provider (pass context for AI Gateway credentials)
        const env = this.env;
        const provider = config.createProvider(env, input.context);
        // Build context from dependencies
        const dependencyContext = formatDependencyContext(dependencyResults);
        // Build messages for LLM
        const messages = [
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
    getStats() {
      return {
        tasksExecuted: this.state.tasksExecuted,
        lastExecutedAt: this.state.lastExecutedAt,
      };
    }
  };
  return WorkerClass;
}
