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
// Export client functions for scheduling tasks
export {
  cancelTask,
  getSchedulerStatus,
  getSchedulerStub,
  scheduleMaintenance,
  scheduleNotification,
  scheduleResearch,
  scheduleTask,
  triggerSchedulerTick,
} from './client.js';
// Export energy functions
export {
  calculateEffectiveEnergyCost,
  canAffordTask,
  deductEnergy,
  ENERGY_CONSTANTS,
  getEnergyBreakdown,
  getEnergyPercentage,
  regenerateEnergy,
} from './energy.js';
// Export proactive research
export {
  calculateRelevance,
  DEFAULT_RESEARCH_SOURCES,
  DEFAULT_TASTE_FILTER,
  executeResearchTask,
  fetchHackerNewsStories,
  formatResearchDigest,
  processHackerNewsStories,
  scheduleResearchTask,
} from './proactive-research.js';
// Export queue functions
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
// Export scheduler DO
export { SchedulerDO } from './scheduler-do.js';
// Re-export types from types.ts
export * from './types.js';
