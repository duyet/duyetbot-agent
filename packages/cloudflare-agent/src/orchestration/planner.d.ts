/**
 * Task Planner
 *
 * Uses LLM to decompose complex tasks into atomic execution steps.
 * Creates dependency graphs for parallel execution optimization.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import type { AgentProvider } from '../execution/agent-provider.js';
import type { ExecutionPlan, PlanStep } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
/**
 * Planner configuration
 */
export interface PlannerConfig {
  /** LLM/Agent provider for generating plans */
  provider: LLMProvider | AgentProvider;
  /** Maximum steps in a plan */
  maxSteps?: number;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Context for plan generation
 */
export interface PlanningContext {
  /** User ID for personalization */
  userId?: string;
  /** Platform (telegram, github, etc.) */
  platform?: string;
  /** Previous task history for context */
  previousTasks?: string[];
  /** Available worker types */
  availableWorkers?: Array<'code' | 'research' | 'github' | 'general'>;
  /** Custom instructions */
  customInstructions?: string;
}
/**
 * Create an execution plan from a task description
 */
export declare function createPlan(
  task: string,
  config: PlannerConfig,
  context?: PlanningContext
): Promise<ExecutionPlan>;
/**
 * Validate plan dependencies (check for cycles and invalid refs)
 */
export declare function validatePlanDependencies(plan: ExecutionPlan): {
  valid: boolean;
  errors: string[];
};
/**
 * Optimize plan by reordering steps and adjusting dependencies
 */
export declare function optimizePlan(plan: ExecutionPlan): ExecutionPlan;
/**
 * Group steps by dependency level for parallel execution
 */
export declare function groupStepsByLevel(steps: PlanStep[]): PlanStep[][];
//# sourceMappingURL=planner.d.ts.map
