/**
 * Scheduler Module
 *
 * Agentic scheduling system with hybrid energy budget.
 *
 * Exports:
 * - Types: Scheduler state, tasks, energy budget
 * - Energy: Budget management and regeneration
 * - Queue: Priority queue with deadline-based urgency
 * - SchedulerDO: The main Durable Object for scheduling
 */
export {
  cancelTask,
  getSchedulerStatus,
  getSchedulerStub,
  type SchedulerStatus,
  type ScheduleTaskOptions,
  scheduleMaintenance,
  scheduleNotification,
  scheduleResearch,
  scheduleTask,
  triggerSchedulerTick,
} from './client.js';
export {
  calculateEffectiveEnergyCost,
  canAffordTask,
  deductEnergy,
  ENERGY_CONSTANTS,
  getEnergyBreakdown,
  getEnergyPercentage,
  regenerateEnergy,
} from './energy.js';
export {
  calculateRelevance,
  DEFAULT_RESEARCH_SOURCES,
  DEFAULT_TASTE_FILTER,
  executeResearchTask,
  fetchHackerNewsStories,
  formatResearchDigest,
  processHackerNewsStories,
  type ResearchFinding,
  type ResearchResult,
  type ResearchSource,
  type ResearchTaskPayload,
  scheduleResearchTask,
  type TasteFilter,
} from './proactive-research.js';
export {
  addTask,
  calculateUrgency,
  cleanupStaleTasks,
  findTasksByType,
  getQueueStats,
  getReadyTasks,
  QUEUE_CONSTANTS,
  removeTask,
} from './queue.js';
export {
  SchedulerDO,
  type SchedulerDOContext,
  type SchedulerDOEnv,
  type WakeUpDecision,
} from './scheduler-do.js';
export * from './types.js';
//# sourceMappingURL=index.d.ts.map
