/**
 * Workers Module
 *
 * Specialized workers for the orchestration system.
 * Workers are lightweight executors that handle specific task domains.
 *
 * @see sub-agent-protocol.ts for multi-model orchestration patterns
 */
// Base worker
export {
  createBaseWorker,
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
} from './base-worker.js';
// Code worker
export { createCodeWorker, detectCodeTaskType } from './code-worker.js';
// GitHub worker
export { createGitHubWorker, detectGitHubTaskType } from './github-worker.js';
// Research worker
export { createResearchWorker, detectResearchTaskType } from './research-worker.js';
// Sub-agent protocol (multi-model orchestration)
export {
  createContextGatheringStep,
  createSubAgentWorkerAdapter,
  defaultWorkerRegistry,
  validateReplanningRequest,
  WorkerRegistry,
} from './sub-agent-protocol.js';
