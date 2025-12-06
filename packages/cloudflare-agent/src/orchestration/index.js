/**
 * Orchestration Module
 *
 * Task planning, execution, and result aggregation for the orchestrator pattern.
 */
// Aggregator
export { aggregateResults, extractKeyFindings, quickAggregate } from './aggregator.js';
// Executor
export { createMockDispatcher, createWorkerDispatcher, executePlan } from './executor.js';
// Planner
export {
  createPlan,
  groupStepsByLevel,
  optimizePlan,
  validatePlanDependencies,
} from './planner.js';
