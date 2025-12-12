/**
 * Subagent Tool for Agentic Loop
 *
 * Delegates independent subtasks to parallel execution through spawned subagents.
 * Enforces strict hierarchical limits to prevent recursive subagent spawning.
 *
 * Features:
 * - Task delegation to independent subagents
 * - Recursive spawning prevention (critical safety check)
 * - Lower iteration limits for subtasks
 * - Proper error handling and reporting
 *
 * CRITICAL CONSTRAINT: Subagents cannot spawn more subagents (one level only).
 * This prevents runaway parallel execution and maintains control flow.
 *
 * @example
 * ```typescript
 * const result = await subagentTool.execute(
 *   {
 *     task: 'Analyze user feedback for common themes',
 *     context: 'User feedback: ["slow performance", "great UI", "slow performance"]'
 *   },
 *   loopContext
 * );
 * // {
 * //   success: true,
 * //   output: '[Subagent delegated] Analyzing feedback themes...',
 * //   durationMs: 156
 * // }
 * ```
 */

import type { LoopContext, LoopTool, ToolResult } from '../types.js';

/**
 * Subagent tool for delegating independent subtasks
 *
 * CRITICAL: This tool includes a recursion prevention check.
 * If ctx.isSubagent === true, the tool returns an error immediately,
 * preventing subagents from spawning more subagents.
 */
export const subagentTool: LoopTool = {
  name: 'subagent',
  description:
    'Delegate an independent subtask to parallel execution. Use for tasks that can run independently without blocking the main flow. IMPORTANT: Subagents cannot spawn more subagents. Use this for parallel decomposition of independent work items.',
  parameters: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description:
          'Clear, specific description of the independent subtask to delegate. Should be self-contained and not depend on other parallel tasks.',
      },
      context: {
        type: 'string',
        description:
          'Relevant context from the parent loop that the subagent needs to understand the task. Include any prerequisites or background information.',
      },
    },
    required: ['task'],
  },
  execute: async (args, ctx: LoopContext): Promise<ToolResult> => {
    const startTime = Date.now();
    const { task, context } = args as { task: string; context?: string };

    // ========================================================================
    // CRITICAL: Prevent recursive subagent spawning
    // ========================================================================
    // This is the key safety check that enforces the one-level hierarchy.
    // If we're already in a subagent (isSubagent === true), we must reject
    // any attempt to spawn another subagent.
    // ========================================================================
    if (ctx.isSubagent) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        output:
          'Subagents cannot spawn more subagents. Complete this task directly using available tools instead.',
        error: 'Recursive subagent attempted (one-level hierarchy enforced)',
        durationMs,
      };
    }

    // ========================================================================
    // Task Delegation (Stub Implementation)
    // ========================================================================
    // TODO: Integrate with AgenticLoop to spawn actual child loop
    //
    // Implementation plan:
    // 1. Create new AgenticLoop instance with:
    //    - isSubagent: true (mark as subagent)
    //    - maxIterations: 10 (lower than parent, e.g., parent=50)
    //    - parentLoopId: ctx.executionContext.traceId
    //    - Inherit tools from parent context
    //    - Inherit execution context (auth, etc.)
    //
    // 2. Execute loop with task as initial query
    //
    // 3. Return loop result formatted as ToolResult
    //
    // Current behavior: Stub returns placeholder indicating delegation pending
    // ========================================================================
    const durationMs = Date.now() - startTime;
    const contextInfo = context ? `\n\nContext: ${context}` : '';

    return {
      success: true,
      output:
        `Subagent delegated for independent execution:\n\n` +
        `Task: ${task}${contextInfo}\n\n` +
        `[Subagent execution pending - will be implemented with AgenticLoop integration]\n\n` +
        `Once implemented, subagent will execute with:\n` +
        `- Max iterations: 10\n` +
        `- Same tools as parent loop\n` +
        `- Independent parallel execution\n` +
        `- Results propagated back to parent`,
      durationMs,
    };
  },
};
