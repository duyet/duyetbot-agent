/**
 * GitHub Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern with Durable Object state.
 */

import {
  type CloudflareAgentState,
  type MCPServerConnection,
  createCloudflareChatAgent,
} from '@duyetbot/chat-agent';
import { GITHUB_SYSTEM_PROMPT } from '@duyetbot/prompts';
import { Octokit } from '@octokit/rest';
import type { Agent, AgentNamespace } from 'agents';
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
interface BaseEnv extends ProviderEnv {
  // GitHub Configuration
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
}

/**
 * Agent class interface for type safety
 */
interface GitHubAgentClass {
  new (
    ...args: unknown[]
  ): Agent<BaseEnv, CloudflareAgentState> & {
    init(userId?: string | number, chatId?: string | number): Promise<void>;
    chat(userMessage: string): Promise<string>;
    clearHistory(): Promise<string>;
    getWelcome(): string;
    getHelp(): string;
    getMessageCount(): number;
    setMetadata(metadata: Record<string, unknown>): void;
    getMetadata(): Record<string, unknown> | undefined;
    handleCommand(text: string): string;
    handle(ctx: GitHubContext): Promise<void>;
  };
}

/**
 * GitHub Agent - Cloudflare Durable Object with ChatAgent
 *
 * Simplified: No MCP memory, no tools - just LLM chat with DO state persistence.
 * Sessions are identified by github:{context}.
 */
export const GitHubAgent = createCloudflareChatAgent<BaseEnv, GitHubContext>({
  createProvider: (env) => createOpenRouterProvider(env),
  systemPrompt: GITHUB_SYSTEM_PROMPT,
  welcomeMessage: "Hello! I'm @duyetbot. How can I help with this issue/PR?",
  helpMessage: 'Mention me with @duyetbot followed by your question or request.',
  maxHistory: 10, // Reduced to minimize state size and prevent blockConcurrencyWhile timeout
  transport: githubTransport,
  mcpServers: [githubMcpServer],
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
}) as unknown as GitHubAgentClass;

/**
 * Type for agent instance
 */
export type GitHubAgentInstance = InstanceType<typeof GitHubAgent>;

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  GitHubAgent: AgentNamespace<GitHubAgentInstance>;
}
