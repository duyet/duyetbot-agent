/**
 * Plan Executor
 *
 * Executes plan steps with parallel execution support.
 * Manages worker dispatch and dependency resolution.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import { type AgentContext } from '../agents/base-agent.js';
import type { ExecutionPlan, WorkerResult } from '../routing/schemas.js';
import type { WorkerInput, WorkerType } from '../workers/base-worker.js';
import { type PlannerConfig } from './planner.js';
/**
 * Worker dispatcher function type
 */
export type WorkerDispatcher = (
  workerType: WorkerType,
  input: WorkerInput
) => Promise<WorkerResult>;
/**
 * Executor configuration
 */
export interface ExecutorConfig {
  /** Function to dispatch work to workers */
  dispatcher: WorkerDispatcher;
  /** Maximum parallel executions */
  maxParallel?: number;
  /** Timeout per step in ms */
  stepTimeoutMs?: number;
  /** Continue on step failure */
  continueOnError?: boolean;
  /** Enable detailed logging */
  debug?: boolean;
  /** Maximum re-planning iterations (default: 2) */
  maxRePlanIterations?: number;
  /** Planner config for re-planning when needsMoreContext is triggered */
  plannerConfig?: PlannerConfig;
}
/**
 * Execution progress callback
 */
export type ExecutionProgressCallback = (
  stepId: string,
  status: 'started' | 'completed' | 'failed',
  result?: WorkerResult
) => void;
/**
 * Execution result
 */
export interface ExecutionResult {
  /** All step results */
  results: Map<string, WorkerResult>;
  /** Steps that succeeded */
  successfulSteps: string[];
  /** Steps that failed */
  failedSteps: string[];
  /** Steps that were skipped due to dependency failures */
  skippedSteps: string[];
  /** Total execution time in ms */
  totalDurationMs: number;
  /** Whether all steps succeeded */
  allSucceeded: boolean;
  /** Number of re-planning iterations that occurred */
  rePlanIterations: number;
  /** Original plan before any re-planning */
  originalPlan: ExecutionPlan;
  /** Final plan after all re-planning iterations */
  finalPlan: ExecutionPlan;
}
/**
 * Execute a plan with parallel step execution and bounded re-planning support
 *
 * When a step returns needsMoreContext, the executor will:
 * 1. Pause execution
 * 2. Gather context from completed steps and suggestions
 * 3. Call the planner to generate additional steps
 * 4. Resume execution with the updated plan
 *
 * Maximum re-planning iterations: 2 (bounded to prevent infinite loops)
 */
export declare function executePlan(
  plan: ExecutionPlan,
  context: AgentContext,
  config: ExecutorConfig,
  onProgress?: ExecutionProgressCallback
): Promise<ExecutionResult>;
/**
 * Create a simple in-memory dispatcher for testing
 */
export declare function createMockDispatcher(
  responses: Map<string, WorkerResult>
): WorkerDispatcher;
/**
 * Create a dispatcher that delegates to actual workers
 */
export declare function createWorkerDispatcher(
  workers: Map<
    WorkerType,
    {
      run: (input: WorkerInput) => Promise<WorkerResult>;
    }
  >
): WorkerDispatcher;
//# sourceMappingURL=executor.d.ts.map
