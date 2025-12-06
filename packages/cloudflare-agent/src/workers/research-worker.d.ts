/**
 * Research Worker
 *
 * Specialized worker for research-related tasks:
 * - Information gathering and synthesis
 * - Documentation lookup
 * - Web search and summarization
 * - Technical research and comparison
 */
import type { AgentContext } from '../agents/base-agent.js';
import type { LLMProvider } from '../types.js';
import { type BaseWorkerEnv, type WorkerClass } from './base-worker.js';
/**
 * Research task types that this worker handles
 */
export type ResearchTaskType =
  | 'search'
  | 'summarize'
  | 'compare'
  | 'explain'
  | 'lookup'
  | 'analyze';
/**
 * Extended environment for research worker
 */
export interface ResearchWorkerEnv extends BaseWorkerEnv {
  /** Optional: Web search API key */
  TAVILY_API_KEY?: string;
  /** Optional: Documentation service URL */
  DOCS_SERVICE_URL?: string;
}
/**
 * Configuration for research worker
 */
export interface ResearchWorkerConfig<TEnv extends ResearchWorkerEnv> {
  /** Function to create LLM provider from env, optionally with context for credentials */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Enable web search integration */
  enableWebSearch?: boolean;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Detect the research task type from the task description
 */
export declare function detectResearchTaskType(task: string): ResearchTaskType;
/**
 * Create a Research Worker class
 *
 * @example
 * ```typescript
 * export const ResearchWorker = createResearchWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   enableWebSearch: true,
 * });
 * ```
 */
export declare function createResearchWorker<TEnv extends ResearchWorkerEnv>(
  config: ResearchWorkerConfig<TEnv>
): WorkerClass<TEnv>;
//# sourceMappingURL=research-worker.d.ts.map
