/**
 * Workers Module
 *
 * Specialized workers for the orchestration system.
 * Workers are lightweight executors that handle specific task domains.
 *
 * @see sub-agent-protocol.ts for multi-model orchestration patterns
 */

// Context types for workers
export type { GlobalContext, SpanContext } from '../context/index.js';
// Base worker
export {
  type BaseWorkerConfig,
  type BaseWorkerEnv,
  type BaseWorkerState,
  createBaseWorker,
  formatDependencyContext,
  isSuccessfulResult,
  type ProviderContext,
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
// Sub-agent protocol (multi-model orchestration)
export {
  createContextGatheringStep,
  createSubAgentWorkerAdapter,
  defaultWorkerRegistry,
  type HealthCheckResult,
  type SubAgentCapability,
  type SubAgentMetadata,
  type SubAgentWorker,
  type SubAgentWorkerResult,
  validateReplanningRequest,
  WorkerRegistry,
  type WorkerRegistryEntry,
} from './sub-agent-protocol.js';
