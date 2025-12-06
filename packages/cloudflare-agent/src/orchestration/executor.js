/**
 * Plan Executor
 *
 * Executes plan steps with parallel execution support.
 * Manages worker dispatch and dependency resolution.
 *
 * Based on Cloudflare's Orchestrator-Workers pattern:
 * https://developers.cloudflare.com/agents/patterns/orchestrator-workers/
 */
import { AgentMixin } from '../agents/base-agent.js';
import { createPlan, groupStepsByLevel } from './planner.js';
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
export async function executePlan(plan, context, config, onProgress) {
  const startTime = Date.now();
  const traceId = context.traceId || AgentMixin.generateId('trace');
  const maxRePlanIterations = config.maxRePlanIterations ?? 2;
  let currentPlan = plan;
  let rePlanIterations = 0;
  const originalPlan = plan;
  AgentMixin.log('Executor', 'Starting plan execution with re-planning support', {
    traceId,
    taskId: plan.taskId,
    stepCount: plan.steps.length,
    maxRePlanIterations,
  });
  // Main execution loop with re-planning support
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const results = new Map();
    const successfulSteps = [];
    const failedSteps = [];
    const skippedSteps = [];
    const maxParallel = config.maxParallel ?? 5;
    const continueOnError = config.continueOnError ?? true;
    // Track if re-planning is needed
    let replanNeeded = false;
    let replanContext = '';
    AgentMixin.log('Executor', `Executing plan iteration ${rePlanIterations}`, {
      traceId,
      taskId: currentPlan.taskId,
      stepCount: currentPlan.steps.length,
      rePlanIterations,
    });
    // Group steps by dependency level for parallel execution
    const stepGroups = groupStepsByLevel(currentPlan.steps);
    AgentMixin.log('Executor', 'Grouped steps by level', {
      traceId,
      groupCount: stepGroups.length,
      groupSizes: stepGroups.map((g) => g.length),
    });
    // Execute each level sequentially, steps within a level in parallel
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
      // Process results and check for needsMoreContext
      for (const [stepId, result] of levelResults) {
        results.set(stepId, result);
        // Check if this step needs more context (triggers re-planning)
        if (result.needsMoreContext && !replanNeeded) {
          replanNeeded = true;
          replanContext = result.contextSuggestion || '';
          AgentMixin.log('Executor', 'Step needs more context - triggering re-plan', {
            traceId,
            stepId,
            rePlanIterations: rePlanIterations + 1,
            contextSuggestion: replanContext.slice(0, 100),
          });
          // Mark as partial success - the worker did work but needs more context
          if (result.success) {
            successfulSteps.push(stepId);
          } else {
            failedSteps.push(stepId);
          }
          continue;
        }
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
      // If re-planning is needed, pause execution and handle it
      if (replanNeeded) {
        AgentMixin.log('Executor', 'Pausing execution for re-planning', {
          traceId,
          completedSteps: successfulSteps.length,
          failedSteps: failedSteps.length,
          rePlanIterations: rePlanIterations + 1,
        });
        break; // Break from level loop to handle re-planning
      }
      // Stop if we hit a failure and continueOnError is false
      if (!continueOnError && failedSteps.length > 0) {
        break;
      }
    }
    // Handle re-planning if needed
    if (replanNeeded && rePlanIterations < maxRePlanIterations) {
      rePlanIterations += 1;
      // Build re-planning context from results
      const completedResults = Array.from(results.values())
        .filter((r) => r.success)
        .map((r) => `- ${r.stepId}: ${r.data ? String(r.data).slice(0, 200) : 'completed'}`)
        .join('\n');
      const replanningPrompt = buildReplanningPrompt(
        currentPlan,
        successfulSteps,
        failedSteps,
        completedResults,
        replanContext
      );
      try {
        // Re-plan with the planner if available
        if (config.plannerConfig) {
          AgentMixin.log('Executor', 'Calling planner for re-planning', {
            traceId,
            rePlanIterations,
            maxRePlanIterations,
          });
          const newPlan = await createPlan(replanningPrompt, config.plannerConfig, {
            customInstructions: `Previous steps completed: ${successfulSteps.join(', ')}. New steps should build on this context.`,
          });
          // Merge the new steps into the plan
          currentPlan = mergeRePlanedSteps(currentPlan, newPlan, successfulSteps);
          AgentMixin.log('Executor', 'Plan updated with new steps from re-planning', {
            traceId,
            newStepCount: currentPlan.steps.length,
            addedSteps: newPlan.steps.length,
            rePlanIterations,
          });
        } else {
          AgentMixin.log('Executor', 'Re-planning requested but no planner config provided', {
            traceId,
            rePlanIterations,
          });
          break; // Exit if no planner config is available
        }
      } catch (error) {
        AgentMixin.logError('Executor', 'Failed during re-planning', error, {
          traceId,
          rePlanIterations,
        });
        // Continue execution with current results if re-planning fails
        break;
      }
    } else if (replanNeeded && rePlanIterations >= maxRePlanIterations) {
      AgentMixin.log('Executor', 'Max re-plan iterations reached', {
        traceId,
        rePlanIterations,
        maxRePlanIterations,
      });
      // Exit loop - max iterations reached
      break;
    } else {
      // No re-planning needed or all iterations complete
      AgentMixin.log('Executor', 'Plan execution completed', {
        traceId,
        taskId: currentPlan.taskId,
        successCount: successfulSteps.length,
        failureCount: failedSteps.length,
        skippedCount: skippedSteps.length,
        rePlanIterations,
      });
      const totalDurationMs = Date.now() - startTime;
      return {
        results,
        successfulSteps,
        failedSteps,
        skippedSteps,
        totalDurationMs,
        allSucceeded: failedSteps.length === 0 && skippedSteps.length === 0,
        rePlanIterations,
        originalPlan,
        finalPlan: currentPlan,
      };
    }
  }
  // Fallback return (should not reach here in normal flow)
  const totalDurationMs = Date.now() - startTime;
  return {
    results: new Map(),
    successfulSteps: [],
    failedSteps: [],
    skippedSteps: [],
    totalDurationMs,
    allSucceeded: false,
    rePlanIterations,
    originalPlan,
    finalPlan: currentPlan,
  };
}
/**
 * Execute steps in parallel with concurrency limit and fault tolerance
 * Uses Promise.allSettled for true parallelism - one step failure doesn't block others
 */
async function executeStepsParallelSafe(
  steps,
  previousResults,
  context,
  config,
  traceId,
  maxParallel,
  onProgress
) {
  const results = new Map();
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
  step,
  previousResults,
  currentResults,
  context,
  config,
  traceId,
  onProgress
) {
  const startTime = Date.now();
  onProgress?.(step.id, 'started');
  AgentMixin.log('Executor', 'Executing step', {
    traceId,
    stepId: step.id,
    workerType: step.workerType,
  });
  try {
    // Gather dependency results
    const dependencyResults = new Map();
    for (const depId of step.dependsOn) {
      const depResult = previousResults.get(depId) || currentResults.get(depId);
      if (depResult) {
        dependencyResults.set(depId, depResult);
      }
    }
    // Build worker input
    const input = {
      step,
      dependencyResults,
      context,
      traceId,
    };
    // Dispatch to worker with timeout
    const timeoutMs = config.stepTimeoutMs ?? 60000;
    const result = await withTimeout(
      config.dispatcher(step.workerType, input),
      timeoutMs,
      `Step ${step.id} timed out after ${timeoutMs}ms`
    );
    const durationMs = Date.now() - startTime;
    const finalResult = {
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
    const errorResult = {
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
async function withTimeout(promise, timeoutMs, errorMessage) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
/**
 * Build a prompt for re-planning based on current execution state
 */
function buildReplanningPrompt(
  currentPlan,
  completedSteps,
  failedSteps,
  completedResults,
  contextSuggestion
) {
  const plan = `Original plan: ${currentPlan.summary}
Steps completed: ${completedSteps.join(', ')}
Steps failed: ${failedSteps.length > 0 ? failedSteps.join(', ') : 'none'}

Completed results:
${completedResults}`;
  const suggestion = contextSuggestion
    ? `\nContext suggestion from worker: ${contextSuggestion}`
    : '';
  return `Continue execution based on previous progress. ${plan}${suggestion}

Generate additional steps to continue making progress on the task.`;
}
/**
 * Merge newly planned steps into the current plan
 *
 * Strategy:
 * 1. Keep successfully completed steps
 * 2. Remove or update failed steps that the new plan addresses
 * 3. Add new steps from the new plan
 * 4. Rebuild dependency graph
 */
function mergeRePlanedSteps(currentPlan, newPlan, completedSteps) {
  // Keep steps that completed successfully
  const keptSteps = currentPlan.steps.filter((step) => completedSteps.includes(step.id));
  // Add new steps from the re-plan
  // Prefix new step IDs with iteration marker to avoid conflicts
  const newSteps = newPlan.steps.map((step) => ({
    ...step,
    id: `${step.id}_rp`, // Add re-plan marker
    // Update dependencies to refer to completed steps and new steps
    dependsOn: step.dependsOn.map((depId) => {
      if (completedSteps.includes(depId)) {
        return depId; // Keep reference to completed step
      }
      // Check if this refers to an old step - if so, find the new equivalent
      const oldStep = currentPlan.steps.find((s) => s.id === depId);
      if (oldStep && !completedSteps.includes(depId)) {
        return `${depId}_rp`; // Point to re-planned version
      }
      return depId;
    }),
  }));
  // Combine and update summary
  const mergedPlan = {
    taskId: currentPlan.taskId,
    summary: `${currentPlan.summary} (continued after re-planning iteration)`,
    steps: [...keptSteps, ...newSteps],
    estimatedComplexity: currentPlan.estimatedComplexity,
    estimatedDurationSeconds: currentPlan.estimatedDurationSeconds
      ? currentPlan.estimatedDurationSeconds + (newPlan.estimatedDurationSeconds || 0)
      : undefined,
  };
  return mergedPlan;
}
/**
 * Create a simple in-memory dispatcher for testing
 */
export function createMockDispatcher(responses) {
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
export function createWorkerDispatcher(workers) {
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
