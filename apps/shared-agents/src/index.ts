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
  type DuyetInfoAgentClass,
  type GitHubWorkerEnv,
  type HITLAgentClass,
  type OrchestratorAgentClass,
  type ResearchWorkerEnv,
  type RouterAgentClass,
  type RouterAgentEnv,
  type SimpleAgentClass,
  StateDO as StateDOClass,
  type WorkerClass,
  createCodeWorker,
  createDuyetInfoAgent,
  createGitHubWorker,
  createHITLAgent,
  createOrchestratorAgent,
  createResearchWorker,
  createRouterAgent,
  createSimpleAgent,
} from '@duyetbot/chat-agent';
import { getSimpleAgentPrompt } from '@duyetbot/prompts';
import { type ProviderEnv, createProvider } from './provider.js';

/**
 * Environment for shared agents
 * Extends all agent/worker env interfaces for type compatibility
 */
interface SharedEnv
  extends ProviderEnv,
    RouterAgentEnv,
    CodeWorkerEnv,
    ResearchWorkerEnv,
    GitHubWorkerEnv {}

/**
 * RouterAgent for query classification
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
 */
export const CodeWorker: WorkerClass<SharedEnv> = createCodeWorker<SharedEnv>({
  createProvider: (env) => createProvider(env),
  defaultLanguage: 'typescript',
});

/**
 * ResearchWorker for web research and documentation
 */
export const ResearchWorker: WorkerClass<SharedEnv> = createResearchWorker<SharedEnv>({
  createProvider: (env) => createProvider(env),
});

/**
 * GitHubWorker for GitHub operations
 */
export const GitHubWorker: WorkerClass<SharedEnv> = createGitHubWorker<SharedEnv>({
  createProvider: (env) => createProvider(env),
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
 * Worker fetch handler (minimal - DOs handle all logic)
 */
export default {
  async fetch(): Promise<Response> {
    return new Response(
      JSON.stringify({
        name: 'duyetbot-agents',
        status: 'ok',
        description: 'Shared Durable Objects for duyetbot',
        exports: [
          'RouterAgent',
          'SimpleAgent',
          'HITLAgent',
          'OrchestratorAgent',
          'CodeWorker',
          'ResearchWorker',
          'GitHubWorker',
          'DuyetInfoAgent',
          'StateDO',
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
