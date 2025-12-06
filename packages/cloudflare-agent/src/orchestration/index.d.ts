/**
 * Orchestration Module
 *
 * Task planning, execution, and result aggregation for the orchestrator pattern.
 */
export {
  type AggregationResult,
  type AggregatorConfig,
  aggregateResults,
  extractKeyFindings,
  quickAggregate,
} from './aggregator.js';
export {
  createMockDispatcher,
  createWorkerDispatcher,
  type ExecutionProgressCallback,
  type ExecutionResult,
  type ExecutorConfig,
  executePlan,
  type WorkerDispatcher,
} from './executor.js';
export {
  createPlan,
  groupStepsByLevel,
  optimizePlan,
  type PlannerConfig,
  type PlanningContext,
  validatePlanDependencies,
} from './planner.js';
//# sourceMappingURL=index.d.ts.map
