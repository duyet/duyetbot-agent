/**
 * Plan Tool - Task Decomposition for Agentic Loop
 *
 * Provides a structured planning capability for the agent to break down
 * complex tasks into executable steps. This is a "thinking out loud" tool
 * that enables the agent to decompose work before execution.
 *
 * Usage:
 * - Agent encounters a complex, multi-step task
 * - Calls plan tool to decompose into structured steps
 * - Agent then executes the plan using other available tools
 * - Useful for code generation, research, and orchestration tasks
 *
 * Design:
 * - This is intentionally a lightweight "planning" tool
 * - Returns a structured response indicating the task and context
 * - The actual step generation happens in the LLM reasoning
 * - Tool result is used as context for subsequent actions
 *
 * @example
 * ```typescript
 * const planResult = await executor.execute(ctx, {
 *   id: 'call_123',
 *   name: 'plan',
 *   arguments: {
 *     task: 'Implement authentication flow with JWT',
 *     context: 'Express.js backend with PostgreSQL'
 *   }
 * });
 * // Result prompts LLM to break down the task into executable steps
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopContext, LoopTool, ToolResult } from '../types.js';

/**
 * Plan tool - breaks complex tasks into executable steps
 *
 * When the agent encounters a complex task that requires multiple steps,
 * it can use this tool to create a structured plan. The tool doesn't actually
 * execute the steps, but rather provides context and validation that helps
 * the agent reason about how to decompose the work.
 *
 * This follows the pattern of "thinking out loud" - giving the agent a chance
 * to organize its thoughts before proceeding with actual execution.
 */
export const planTool: LoopTool = {
  name: 'plan',
  description:
    'Break a complex task into smaller, executable steps. Use when facing multi-step tasks that require decomposition. Returns a structured plan acknowledgment that prompts the agent to generate steps.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description:
          'The complex task to decompose into steps. Be specific about what needs to be accomplished.',
      },
      context: {
        type: 'string',
        description:
          'Additional context or constraints for planning (optional). Include relevant details like tech stack, requirements, or limitations.',
      },
    },
    required: ['task'],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();

    try {
      // Extract arguments with proper typing
      const task = args.task as string;
      const context = (args.context as string | undefined) || '';

      // Log plan invocation
      logger.debug('[PlanTool] Task decomposition initiated', {
        task,
        hasContext: !!context,
        iteration: ctx.iteration,
        isSubagent: ctx.isSubagent,
      });

      // Validate task is not empty
      if (!task || task.trim().length === 0) {
        return {
          success: false,
          output: '',
          error:
            'Task cannot be empty. Please provide a clear description of what needs to be planned.',
          durationMs: Date.now() - startTime,
        };
      }

      // Create structured planning response
      // This response serves as a "thinking checkpoint" that helps the agent
      // organize its reasoning before proceeding with actual steps
      const planningOutput = createPlanningResponse(task, context, ctx);

      return {
        success: true,
        output: planningOutput,
        data: {
          task,
          context,
          iteration: ctx.iteration,
          toolHistory: ctx.toolHistory.map((inv) => ({
            toolName: inv.toolName,
            iteration: inv.iteration,
          })),
        },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[PlanTool] Planning failed', {
        error: errorMessage,
        iteration: ctx.iteration,
      });

      return {
        success: false,
        output: '',
        error: `Planning failed: ${errorMessage}`,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Create a structured planning response
 *
 * Generates a response that acknowledges the planning request and provides
 * context for the agent to reason about how to break down the task.
 *
 * @param task - The task to plan
 * @param context - Additional context
 * @param ctx - Loop execution context
 * @returns Formatted planning response
 */
function createPlanningResponse(task: string, context: string, ctx: LoopContext): string {
  const contextInfo = context ? `\n\nContext: ${context}` : '';
  const iterationInfo = `Iteration: ${ctx.iteration + 1}`;
  const toolHistoryInfo =
    ctx.toolHistory.length > 0
      ? `\nPrevious tools used: ${ctx.toolHistory.map((t) => t.toolName).join(', ')}`
      : '';

  return `Planning task decomposition:

Task: ${task}${contextInfo}

${iterationInfo}${toolHistoryInfo}

Now, generate a structured plan by breaking this task into numbered steps. Each step should be:
1. Specific and actionable
2. Sequential or parallel as appropriate
3. Executable using available tools or direct action
4. Progressively building toward the final goal

Please provide the step breakdown and proceed with execution.`;
}

/**
 * Create a plan tool with custom configuration
 *
 * Convenience factory function for creating plan tools with custom
 * descriptions or parameters if needed.
 *
 * @returns Plan tool with standard configuration
 *
 * @example
 * ```typescript
 * const tool = createPlanTool();
 * executor.register(tool);
 * ```
 */
export function createPlanTool(): LoopTool {
  return planTool;
}
