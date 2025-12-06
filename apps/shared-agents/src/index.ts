/**
 * Shared Agents Worker
 *
 * Hosts all shared Durable Objects that are used across multiple bots.
 * Other workers (telegram-bot, github-bot) reference these via script_name.
 *
 * Exported DOs:
 * - RouterAgent: Query classification and routing
 * - SimpleAgent: Quick responses without tools
 * - HITLAgent: Human-in-the-loop for sensitive operations
 * - OrchestratorAgent: Complex task decomposition
 * - CodeWorker: Code analysis and generation
 * - ResearchWorker: Web research and documentation
 * - GitHubWorker: GitHub operations
 * - DuyetInfoAgent: Duyet's blog and personal info
 */

import {
  type CodeWorkerEnv,
  createCodeWorker,
  createDuyetInfoAgent,
  createGitHubWorker,
  createHITLAgent,
  createOrchestratorAgent,
  createResearchWorker,
  createRouterAgent,
  createSimpleAgent,
  type DuyetInfoAgentClass,
  type GitHubWorkerEnv,
  type HITLAgentClass,
  type OrchestratorAgentClass,
  type OrchestratorEnv,
  type ResearchWorkerEnv,
  type RouterAgentClass,
  type RouterAgentEnv,
  type SimpleAgentClass,
  StateDO as StateDOClass,
  type WorkerClass,
} from '@duyetbot/cloudflare-agent';
import { getSimpleAgentPrompt } from '@duyetbot/prompts';
import { createLLMProvider, createProvider, type ProviderEnv } from './provider.js';

/**
 * Environment for shared agents
 * Extends all agent/worker env interfaces for type compatibility
 */
interface SharedEnv
  extends ProviderEnv,
    RouterAgentEnv,
    OrchestratorEnv,
    CodeWorkerEnv,
    ResearchWorkerEnv,
    GitHubWorkerEnv {}

/**
 * RouterAgent for query classification
 *
 * Note: createProvider is called with just env during migration.
 * Platform-specific config will be passed via ExecutionContext in the future.
 */
export const RouterAgent: RouterAgentClass<SharedEnv> = createRouterAgent<SharedEnv>({
  createProvider: (env) => createProvider(env),
  debug: false,
});

/**
 * SimpleAgent for quick responses without tools
 *
 * Web search is enabled via OpenRouter's native plugin, allowing the model
 * to access real-time web information when needed.
 */
export const SimpleAgent: SimpleAgentClass<SharedEnv> = createSimpleAgent<SharedEnv>({
  createProvider: (env) => createProvider(env),
  systemPrompt: getSimpleAgentPrompt(),
  maxHistory: 20,
  webSearch: true,
});

/**
 * HITLAgent for human-in-the-loop confirmations
 */
export const HITLAgent: HITLAgentClass<SharedEnv> = createHITLAgent<SharedEnv>({
  createProvider: (env) => createProvider(env),
  systemPrompt: getSimpleAgentPrompt(),
  confirmationThreshold: 'high',
});

/**
 * OrchestratorAgent for complex task decomposition
 */
export const OrchestratorAgent: OrchestratorAgentClass<SharedEnv> =
  createOrchestratorAgent<SharedEnv>({
    createProvider: (env) => createProvider(env),
    maxSteps: 10,
    maxParallel: 3,
    continueOnError: true,
  });

/**
 * CodeWorker for code analysis and generation
 * Workers use createLLMProvider() since they extend Agent directly
 */
export const CodeWorker: WorkerClass<SharedEnv> = createCodeWorker<SharedEnv>({
  createProvider: (env) => createLLMProvider(env),
  defaultLanguage: 'typescript',
});

/**
 * ResearchWorker for web research and documentation
 * Workers use createLLMProvider() since they extend Agent directly
 */
export const ResearchWorker: WorkerClass<SharedEnv> = createResearchWorker<SharedEnv>({
  createProvider: (env) => createLLMProvider(env),
});

/**
 * GitHubWorker for GitHub operations
 * Workers use createLLMProvider() since they extend Agent directly
 */
export const GitHubWorker: WorkerClass<SharedEnv> = createGitHubWorker<SharedEnv>({
  createProvider: (env) => createLLMProvider(env),
});

/**
 * DuyetInfoAgent for Duyet's blog and personal info queries
 */
export const DuyetInfoAgent: DuyetInfoAgentClass<SharedEnv> = createDuyetInfoAgent<SharedEnv>({
  createProvider: (env) => createProvider(env),
  debug: true, // Enable detailed logging for observability
});

/**
 * StateDO for centralized observability and watchdog recovery
 *
 * Tracks:
 * - Active sessions across all chat agents
 * - Execution traces for debugging
 * - Stuck batch detection and recovery
 * - Aggregated metrics
 */
export const StateDO = StateDOClass;

/**
 * SchedulerObject for agentic task scheduling
 *
 * Implements the "Wake Up" pattern from Software 2.0 design:
 * - Priority queue with deadline-based urgency scoring
 * - Hybrid energy budget (tokens + compute time)
 * - Quiet hours for background work
 * - Critical task bypass
 *
 * Used for:
 * - ProactiveResearcher (HN scanning, ArXiv)
 * - Scheduled maintenance tasks
 * - Deferred work from main agents
 */
export { SchedulerObject } from './scheduler-object.js';

/**
 * Worker fetch handler (minimal - DOs handle all logic)
 */
export default {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({
        name: 'duyetbot-shared-agents',
        status: 'ok',
        description: 'Shared Durable Objects for duyetbot',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
