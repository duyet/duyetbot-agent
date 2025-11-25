/**
 * GitHub Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern with Durable Object state.
 *
 * Full multi-agent system with:
 * - RouterAgent: Query classification and routing
 * - SimpleAgent: Quick responses without tools
 * - HITLAgent: Human-in-the-loop for sensitive operations
 * - OrchestratorAgent: Complex task decomposition
 * - Workers: CodeWorker, ResearchWorker, GitHubWorker
 */

import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  type HITLAgentClass,
  type MCPServerConnection,
  type OrchestratorAgentClass,
  type RouterAgentClass,
  type RouterAgentEnv,
  type SimpleAgentClass,
  type WorkerClass,
  createCloudflareChatAgent,
  createCodeWorker,
  createGitHubWorker,
  createHITLAgent,
  createOrchestratorAgent,
  createResearchWorker,
  createRouterAgent,
  createSimpleAgent,
} from '@duyetbot/chat-agent';
import { GITHUB_SYSTEM_PROMPT } from '@duyetbot/prompts';
import { getPlatformTools } from '@duyetbot/tools';
import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';
import { type ProviderEnv, createOpenRouterProvider } from './provider.js';
import { type GitHubContext, githubTransport } from './transport.js';

/**
 * GitHub MCP server configuration
 */
const githubMcpServer: MCPServerConnection = {
  name: 'github-mcp',
  url: 'https://api.githubcopilot.com/mcp/sse',
  getAuthHeader: (env) => {
    const token = env.GITHUB_TOKEN as string | undefined;
    return token ? `Bearer ${token}` : undefined;
  },
};

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv, RouterAgentEnv {
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
  ROUTER_DEBUG?: string;
}

/**
 * GitHub Agent - Cloudflare Durable Object with ChatAgent
 *
 * Simplified: No MCP memory, no tools - just LLM chat with DO state persistence.
 * Sessions are identified by github:{context}.
 */
export const GitHubAgent: CloudflareChatAgentClass<BaseEnv, GitHubContext> =
  createCloudflareChatAgent<BaseEnv, GitHubContext>({
    createProvider: (env) => createOpenRouterProvider(env),
    systemPrompt: GITHUB_SYSTEM_PROMPT,
    welcomeMessage: "Hello! I'm @duyetbot. How can I help with this issue/PR?",
    helpMessage: 'Mention me with @duyetbot followed by your question or request.',
    maxHistory: 10,
    transport: githubTransport,
    mcpServers: [githubMcpServer],
    tools: getPlatformTools('github'),
    router: {
      platform: 'github',
      debug: false,
    },
    hooks: {
      beforeHandle: async (ctx) => {
        // Add "eyes" reaction to acknowledge we're processing
        if (ctx.commentId) {
          try {
            const octokit = new Octokit({ auth: ctx.githubToken });
            await octokit.reactions.createForIssueComment({
              owner: ctx.owner,
              repo: ctx.repo,
              comment_id: ctx.commentId,
              content: 'eyes',
            });
          } catch (error) {
            logger.warn('[AGENT] Failed to add reaction', {
              owner: ctx.owner,
              repo: ctx.repo,
              commentId: ctx.commentId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      },
      onError: async (ctx, error) => {
        logger.error('[AGENT] Error in handle()', {
          owner: ctx.owner,
          repo: ctx.repo,
          issueNumber: ctx.issueNumber,
          error: error.message,
        });

        // Send error message as comment
        const octokit = new Octokit({ auth: ctx.githubToken });
        await octokit.issues.createComment({
          owner: ctx.owner,
          repo: ctx.repo,
          issue_number: ctx.issueNumber,
          body: 'Sorry, I encountered an error processing your request. Please try again.',
        });
      },
    },
  });

/**
 * Type for agent instance
 */
export type GitHubAgentInstance = InstanceType<typeof GitHubAgent>;

/**
 * RouterAgent for query classification
 */
export const RouterAgent: RouterAgentClass<BaseEnv> = createRouterAgent<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  debug: false,
});

/**
 * SimpleAgent for quick responses without tools
 */
export const SimpleAgent: SimpleAgentClass<BaseEnv> = createSimpleAgent<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  systemPrompt: GITHUB_SYSTEM_PROMPT,
  maxHistory: 10,
});

/**
 * HITLAgent for human-in-the-loop confirmations
 */
export const HITLAgent: HITLAgentClass<BaseEnv> = createHITLAgent<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  systemPrompt: GITHUB_SYSTEM_PROMPT,
  confirmationThreshold: 'high',
});

/**
 * OrchestratorAgent for complex task decomposition
 */
export const OrchestratorAgent: OrchestratorAgentClass<BaseEnv> = createOrchestratorAgent<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  maxSteps: 10,
  maxParallel: 3,
  continueOnError: true,
});

/**
 * CodeWorker for code analysis and generation
 */
export const CodeWorker: WorkerClass<BaseEnv> = createCodeWorker<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  defaultLanguage: 'typescript',
});

/**
 * ResearchWorker for web research and documentation
 */
export const ResearchWorker: WorkerClass<BaseEnv> = createResearchWorker<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
});

/**
 * GitHubWorker for GitHub operations
 */
export const GitHubWorker: WorkerClass<BaseEnv> = createGitHubWorker<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
});

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  GitHubAgent: CloudflareChatAgentNamespace<BaseEnv, GitHubContext>;
}
