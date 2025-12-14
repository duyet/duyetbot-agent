/**
 * GitHub Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/cloudflare-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern with Durable Object state.
 *
 * This file only exports GitHubAgent (local DO).
 * Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from
 * duyetbot-shared-agents worker via script_name in wrangler.toml.
 */

import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  createCloudflareChatAgent,
  type GitHubPlatformConfig,
  type MCPServerConnection,
  type RouterAgentEnv,
} from '@duyetbot/cloudflare-agent';
import { getGitHubBotPrompt } from '@duyetbot/prompts';
import { getPlatformTools } from '@duyetbot/tools';
import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';
import { createOpenRouterProvider, type ProviderEnv } from './provider.js';
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
  // Common config (from wrangler.toml [vars])
  ENVIRONMENT?: string;
  // GitHub-specific
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
  GITHUB_ADMIN?: string;
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
    createProvider: (env: BaseEnv) => createOpenRouterProvider(env),
    systemPrompt: getGitHubBotPrompt(),
    welcomeMessage: "Hello! I'm @duyetbot. How can I help with this issue/PR?",
    helpMessage: 'Mention me with @duyetbot followed by your question or request.',
    transport: githubTransport,
    mcpServers: [githubMcpServer],
    tools: getPlatformTools('github'),
    // Reduce history to minimize token usage and subrequests
    maxHistory: 10,
    // Thinking rotation interval to match Telegram (keeps connection alive)
    thinkingRotationInterval: 5000,
    // Limit tool call iterations to prevent gateway timeouts
    maxToolIterations: 10,
    // Limit number of tools to reduce token overhead
    maxTools: 5,
    // Extract platform config for shared DOs (includes AI Gateway credentials)
    extractPlatformConfig: (env: BaseEnv): GitHubPlatformConfig => ({
      platform: 'github',
      // Common config - only include defined values
      ...(env.ENVIRONMENT && { environment: env.ENVIRONMENT }),
      ...(env.MODEL && { model: env.MODEL }),
      ...(env.AI_GATEWAY_NAME && { aiGatewayName: env.AI_GATEWAY_NAME }),
      ...(env.AI_GATEWAY_API_KEY && {
        aiGatewayApiKey: env.AI_GATEWAY_API_KEY,
      }),
      // GitHub-specific
      ...(env.BOT_USERNAME && { botUsername: env.BOT_USERNAME }),
      ...(env.GITHUB_ADMIN && { adminUsername: env.GITHUB_ADMIN }),
    }),
    // Shorter batch window for GitHub (200ms vs 500ms for Telegram)
    // GitHub comments are typically complete when sent, not rapid-fire like chat
    batchConfig: {
      windowMs: 200,
      maxWindowMs: 3000,
      maxMessages: 5,
    },
    hooks: {
      beforeHandle: async (ctx: GitHubContext) => {
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
      onError: async (ctx: GitHubContext, error: any) => {
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
  } as any) as unknown as CloudflareChatAgentClass<BaseEnv, GitHubContext>;

/**
 * Type for agent instance
 */
export type GitHubAgentInstance = InstanceType<typeof GitHubAgent>;

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  GitHubAgent: CloudflareChatAgentNamespace<BaseEnv, GitHubContext>;
}
