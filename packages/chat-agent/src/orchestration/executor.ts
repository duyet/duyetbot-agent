/**
 * Plan Executor
 *
 * Executes plan steps with parallel execution support.
 * Manages worker dispatch and dependency resolution.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */

import { type AgentContext, AgentMixin } from '../agents/base-agent.js';
import type { ExecutionPlan, PlanStep, WorkerResult } from '../routing/schemas.js';
import type { WorkerInput, WorkerType } from '../workers/base-worker.js';
import { groupStepsByLevel } from './planner.js';

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
}

/**
 * Execute a plan with parallel step execution
 */
export async function executePlan(
  plan: ExecutionPlan,
  context: AgentContext,
  config: ExecutorConfig,
  onProgress?: ExecutionProgressCallback
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const traceId = context.traceId || AgentMixin.generateId('trace');
  const results = new Map<string, WorkerResult>();
  const successfulSteps: string[] = [];
  const failedSteps: string[] = [];
  const skippedSteps: string[] = [];

  const maxParallel = config.maxParallel ?? 5;
  const continueOnError = config.continueOnError ?? true;

  AgentMixin.log('Executor', 'Starting plan execution', {
    traceId,
    taskId: plan.taskId,
    stepCount: plan.steps.length,
    maxParallel,
  });

  // Group steps by dependency level for parallel execution
  const stepGroups = groupStepsByLevel(plan.steps);

  AgentMixin.log('Executor', 'Grouped steps by level', {
    traceId,
    groupCount: stepGroups.length,
    groupSizes: stepGroups.map((g) => g.length),
  });

  // Execute each level sequentially, steps within a level in parallel
  // Using Promise.allSettled for true fault-tolerant parallelism
  for (let level = 0; level < stepGroups.length; level++) {
    const group = stepGroups[level];
    if (!group || group.length === 0) {
      continue;
    }

    AgentMixin.log('Executor', `Executing level ${level}`, {
      traceId,
      stepCount: group.length,
      steps: group.map((s) => s.id),
    });

    // Check if we should skip this level due to failed dependencies
    const groupWithDependencyStatus = group.map((step) => {
      const failedDeps = step.dependsOn.filter((depId) => failedSteps.includes(depId));
      const skippedDeps = step.dependsOn.filter((depId) => skippedSteps.includes(depId));
      return {
        step,
        shouldSkip: failedDeps.length > 0 || skippedDeps.length > 0,
        failedDeps,
        skippedDeps,
      };
    });

    // Separate executable steps from skipped steps
    const executableSteps = groupWithDependencyStatus
      .filter(({ shouldSkip }) => !shouldSkip)
      .map(({ step }) => step);

    const stepsToSkip = groupWithDependencyStatus.filter(({ shouldSkip }) => shouldSkip);

    // Mark skipped steps
    for (const { step, failedDeps, skippedDeps } of stepsToSkip) {
      skippedSteps.push(step.id);
      results.set(step.id, {
        stepId: step.id,
        success: false,
        error: `Skipped due to failed dependencies: ${[...failedDeps, ...skippedDeps].join(', ')}`,
        durationMs: 0,
      });
      onProgress?.(step.id, 'failed', results.get(step.id));
    }

    // Execute steps in parallel with fault-tolerance
    const levelResults = await executeStepsParallelSafe(
      executableSteps,
      results,
      context,
      config,
      traceId,
      maxParallel,
      onProgress
    );

    // Process results
    for (const [stepId, result] of levelResults) {
      results.set(stepId, result);
      if (result.success) {
        successfulSteps.push(stepId);
      } else {
        failedSteps.push(stepId);
        if (!continueOnError) {
          // Mark remaining steps as skipped
          for (let i = level + 1; i < stepGroups.length; i++) {
            const remainingGroup = stepGroups[i];
            if (!remainingGroup) {
              continue;
            }
            for (const step of remainingGroup) {
              if (!results.has(step.id)) {
                skippedSteps.push(step.id);
                results.set(step.id, {
                  stepId: step.id,
                  success: false,
                  error: 'Skipped due to earlier failure',
                  durationMs: 0,
                });
              }
            }
          }
          break;
        }
      }
    }

    // Stop if we hit a failure and continueOnError is false
    if (!continueOnError && failedSteps.length > 0) {
      break;
    }
  }

  const totalDurationMs = Date.now() - startTime;

  AgentMixin.log('Executor', 'Plan execution completed', {
    traceId,
    taskId: plan.taskId,
    totalDurationMs,
    successCount: successfulSteps.length,
    failureCount: failedSteps.length,
    skippedCount: skippedSteps.length,
  });

  return {
    results,
    successfulSteps,
    failedSteps,
    skippedSteps,
    totalDurationMs,
    allSucceeded: failedSteps.length === 0 && skippedSteps.length === 0,
  };
}

/**
 * Execute steps in parallel with concurrency limit and fault tolerance
 * Uses Promise.allSettled for true parallelism - one step failure doesn't block others
 */
async function executeStepsParallelSafe(
  steps: PlanStep[],
  previousResults: Map<string, WorkerResult>,
  context: AgentContext,
  config: ExecutorConfig,
  traceId: string,
  maxParallel: number,
  onProgress?: ExecutionProgressCallback
): Promise<Map<string, WorkerResult>> {
  const results = new Map<string, WorkerResult>();

  // Process in batches with allSettled for fault tolerance
  for (let i = 0; i < steps.length; i += maxParallel) {
    const batch = steps.slice(i, i + maxParallel);

    const batchPromises = batch.map((step) =>
      executeStep(step, previousResults, results, context, config, traceId, onProgress)
    );

    // Use allSettled instead of all - one failure doesn't block parallel execution
    const batchSettled = await Promise.allSettled(batchPromises);

    for (const settled of batchSettled) {
      if (settled.status === 'fulfilled') {
        const result = settled.value;
        results.set(result.stepId, result);
      } else {
        // Handle rejected promises as execution failures
        AgentMixin.logError('Executor', 'Step execution rejected', settled.reason, {
          traceId,
        });
      }
    }
  }

  return results;
}

/**
 * Execute a single step
 */
async function executeStep(
  step: PlanStep,
  previousResults: Map<string, WorkerResult>,
  currentResults: Map<string, WorkerResult>,
  context: AgentContext,
  config: ExecutorConfig,
  traceId: string,
  onProgress?: ExecutionProgressCallback
): Promise<WorkerResult> {
  const startTime = Date.now();

  onProgress?.(step.id, 'started');

  AgentMixin.log('Executor', 'Executing step', {
    traceId,
    stepId: step.id,
    workerType: step.workerType,
  });

  try {
    // Gather dependency results
    const dependencyResults = new Map<string, WorkerResult>();
    for (const depId of step.dependsOn) {
      const depResult = previousResults.get(depId) || currentResults.get(depId);
      if (depResult) {
        dependencyResults.set(depId, depResult);
      }
    }

    // Build worker input
    const input: WorkerInput = {
      step,
      dependencyResults,
      context,
      traceId,
    };

    // Dispatch to worker with timeout
    const timeoutMs = config.stepTimeoutMs ?? 60000;
    const result = await withTimeout(
      config.dispatcher(step.workerType as WorkerType, input),
      timeoutMs,
      `Step ${step.id} timed out after ${timeoutMs}ms`
    );

    const durationMs = Date.now() - startTime;

    const finalResult: WorkerResult = {
      ...result,
      durationMs,
    };

    onProgress?.(step.id, result.success ? 'completed' : 'failed', finalResult);

    AgentMixin.log('Executor', 'Step completed', {
      traceId,
      stepId: step.id,
      success: result.success,
      durationMs,
    });

    return finalResult;
  } catch (error) {
    const durationMs = Date.now() - startTime;

    const errorResult: WorkerResult = {
      stepId: step.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    };

    onProgress?.(step.id, 'failed', errorResult);

    AgentMixin.logError('Executor', 'Step failed', error, {
      traceId,
      stepId: step.id,
      durationMs,
    });

    return errorResult;
  }
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Create a simple in-memory dispatcher for testing
 */
export function createMockDispatcher(responses: Map<string, WorkerResult>): WorkerDispatcher {
  return async (workerType, input) => {
    const response = responses.get(input.step.id);
    if (response) {
      return response;
    }

    // Default success response
    return {
      stepId: input.step.id,
      success: true,
      data: `Mock result for ${workerType} worker`,
      durationMs: 10,
    };
  };
}

/**
 * Create a dispatcher that delegates to actual workers
 */
export function createWorkerDispatcher(
  workers: Map<WorkerType, { run: (input: WorkerInput) => Promise<WorkerResult> }>
): WorkerDispatcher {
  return async (workerType, input) => {
    const worker = workers.get(workerType);
    if (!worker) {
      return {
        stepId: input.step.id,
        success: false,
        error: `No worker available for type: ${workerType}`,
        durationMs: 0,
      };
    }

    return worker.run(input);
  };
}
