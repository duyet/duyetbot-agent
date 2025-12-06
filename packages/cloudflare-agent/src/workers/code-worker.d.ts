/**
 * Code Worker
 *
 * Specialized worker for code-related tasks:
 * - Code review and analysis
 * - Code generation and refactoring
 * - Bug detection and fixes
 * - Documentation generation
 */
import type { AgentContext } from '../agents/base-agent.js';
import type { LLMProvider } from '../types.js';
import { type BaseWorkerEnv, type WorkerClass } from './base-worker.js';
/**
 * Code task types that this worker handles
 */
export type CodeTaskType =
  | 'review'
  | 'generate'
  | 'refactor'
  | 'analyze'
  | 'document'
  | 'fix'
  | 'test'
  | 'explain';
/**
 * Extended environment for code worker
 */
export interface CodeWorkerEnv extends BaseWorkerEnv {
  /** Optional: Default programming language */
  DEFAULT_LANGUAGE?: string;
}
/**
 * Configuration for code worker
 */
export interface CodeWorkerConfig<TEnv extends CodeWorkerEnv> {
  /** Function to create LLM provider from env, optionally with context for credentials */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Default programming language */
  defaultLanguage?: string;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Detect the code task type from the task description
 */
export declare function detectCodeTaskType(task: string): CodeTaskType;
/**
 * Create a Code Worker class
 *
 * @example
 * ```typescript
 * export const CodeWorker = createCodeWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   defaultLanguage: 'typescript',
 * });
 * ```
 */
export declare function createCodeWorker<TEnv extends CodeWorkerEnv>(
  config: CodeWorkerConfig<TEnv>
): WorkerClass<TEnv>;
//# sourceMappingURL=code-worker.d.ts.map
