/**
 * GitHub Worker
 *
 * Specialized worker for GitHub-related tasks:
 * - PR review and management
 * - Issue triage and analysis
 * - Repository analysis
 * - Code diff analysis
 */
import type { AgentContext } from '../agents/base-agent.js';
import type { PlanStep } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';
import { type BaseWorkerEnv, type WorkerClass } from './base-worker.js';
export type { PlanStep };
/**
 * GitHub task types that this worker handles
 */
export type GitHubTaskType =
  | 'pr_review'
  | 'pr_create'
  | 'issue_triage'
  | 'issue_create'
  | 'diff_analyze'
  | 'repo_analyze'
  | 'comment';
/**
 * Extended environment for GitHub worker
 */
export interface GitHubWorkerEnv extends BaseWorkerEnv {
  /** GitHub API token */
  GITHUB_TOKEN?: string;
  /** GitHub App ID */
  GITHUB_APP_ID?: string;
  /** GitHub App Private Key */
  GITHUB_APP_PRIVATE_KEY?: string;
}
/**
 * Configuration for GitHub worker
 */
export interface GitHubWorkerConfig<TEnv extends GitHubWorkerEnv> {
  /** Function to create LLM provider from env, optionally with context for credentials */
  createProvider: (env: TEnv, context?: AgentContext) => LLMProvider;
  /** Default repository owner */
  defaultOwner?: string;
  /** Default repository name */
  defaultRepo?: string;
  /** Enable detailed logging */
  debug?: boolean;
}
/**
 * Detect the GitHub task type from the task description
 */
export declare function detectGitHubTaskType(task: string): GitHubTaskType;
/**
 * Create a GitHub Worker class
 *
 * @example
 * ```typescript
 * export const GitHubWorker = createGitHubWorker({
 *   createProvider: (env) => createAIGatewayProvider(env),
 *   defaultOwner: 'myorg',
 *   defaultRepo: 'myrepo',
 * });
 * ```
 */
export declare function createGitHubWorker<TEnv extends GitHubWorkerEnv>(
  config: GitHubWorkerConfig<TEnv>
): WorkerClass<TEnv>;
//# sourceMappingURL=github-worker.d.ts.map
