/**
 * Workers Module
 *
 * Specialized workers for the orchestration system.
 * Workers are lightweight executors that handle specific task domains.
 */

// Base worker
export {
  type BaseWorkerConfig,
  type BaseWorkerEnv,
  type BaseWorkerState,
  createBaseWorker,
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
  type WorkerClass,
  type WorkerInput,
  type WorkerMethods,
  type WorkerType,
} from './base-worker.js';

// Code worker
export {
  type CodeTaskType,
  type CodeWorkerConfig,
  type CodeWorkerEnv,
  createCodeWorker,
  detectCodeTaskType,
} from './code-worker.js';
// GitHub worker
export {
  createGitHubWorker,
  detectGitHubTaskType,
  type GitHubTaskType,
  type GitHubWorkerConfig,
  type GitHubWorkerEnv,
} from './github-worker.js';
// Research worker
export {
  createResearchWorker,
  detectResearchTaskType,
  type ResearchTaskType,
  type ResearchWorkerConfig,
  type ResearchWorkerEnv,
} from './research-worker.js';
