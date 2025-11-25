/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 *
 * Full multi-agent system with:
 * - RouterAgent: Query classification and routing
 * - SimpleAgent: Quick responses without tools
 * - HITLAgent: Human-in-the-loop for sensitive operations
 * - OrchestratorAgent: Complex task decomposition
 * - Workers: CodeWorker, ResearchWorker, GitHubWorker
 */

import type { MCPServerConnection } from '@duyetbot/chat-agent';
import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  type HITLAgentClass,
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
import { logger } from '@duyetbot/hono-middleware';
import {
  TELEGRAM_HELP_MESSAGE,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
} from '@duyetbot/prompts';
import { getPlatformTools } from '@duyetbot/tools';
import { type ProviderEnv, createAIGatewayProvider } from './provider.js';
import { type TelegramContext, telegramTransport } from './transport.js';

/**
 * GitHub MCP server configuration
 */
const _githubMcpServer: MCPServerConnection = {
  name: 'github-mcp',
  url: 'https://api.githubcopilot.com/mcp/sse',
  getAuthHeader: (env) => {
    const token = env.GITHUB_TOKEN as string | undefined;
    return token ? `Bearer ${token}` : undefined;
  },
};

/**
 * Duyet MCP server configuration
 * Provides tools for: get_about_duyet, get_cv, get_blog_posts, get_github_activity
 *
 * Note: Temporarily disabled to investigate gateway timeouts
 */
// const duyetMcpServer: MCPServerConnection = {
//   name: 'duyet-mcp',
//   url: 'https://mcp.duyet.net/sse',
// };

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv, RouterAgentEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ALLOWED_USERS?: string;
  TELEGRAM_ADMIN?: string;
  WORKER_URL?: string;
  GITHUB_TOKEN?: string;
  ROUTER_DEBUG?: string;
}

/**
 * Telegram Agent - Cloudflare Durable Object with ChatAgent
 *
 * Sessions are identified by telegram:{chatId}.
 */
export const TelegramAgent: CloudflareChatAgentClass<BaseEnv, TelegramContext> =
  createCloudflareChatAgent<BaseEnv, TelegramContext>({
    createProvider: (env) => createAIGatewayProvider(env),
    systemPrompt: TELEGRAM_SYSTEM_PROMPT,
    welcomeMessage: TELEGRAM_WELCOME_MESSAGE,
    helpMessage: TELEGRAM_HELP_MESSAGE,
    transport: telegramTransport,
    // Note: GitHub MCP server disabled - causes connection pool exhaustion from hanging SSE
    // TODO: Re-enable when GitHub Copilot MCP is stable or add proper AbortController support
    // Note: duyet-mcp temporarily disabled to investigate gateway timeouts
    mcpServers: [],
    tools: getPlatformTools('telegram'),
    // Reduce history to minimize token usage and subrequests
    // Cloudflare Workers limit: 50 subrequests per invocation
    maxHistory: 20,
    // Increase rotation interval to reduce edit subrequests
    thinkingRotationInterval: 10000,
    // Limit tool call iterations to prevent gateway timeouts
    maxToolIterations: 3,
    // Limit number of tools to reduce token overhead and prevent timeouts
    // Priority: built-in tools first, then MCP tools
    maxTools: 5,
    router: {
      platform: 'telegram',
      debug: false,
    },
    hooks: {
      onError: async (ctx, error, messageRef) => {
        // Log the error for monitoring
        logger.error('[AGENT] Error in handle()', {
          userId: ctx.userId,
          chatId: ctx.chatId,
          error: error.message,
          messageRef,
        });

        // Framework automatically edits the thinking message to show error
        // For admins, send additional detailed error info
        const isAdmin = ctx.adminUsername && ctx.username === ctx.adminUsername;
        if (isAdmin) {
          await telegramTransport.send(ctx, `🔍 Debug: ${error.message}`);
        }
      },
    },
  });

/**
 * Type for agent instance
 */
export type TelegramAgentInstance = InstanceType<typeof TelegramAgent>;

/**
 * RouterAgent for query classification
 */
export const RouterAgent: RouterAgentClass<BaseEnv> = createRouterAgent<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  debug: false,
});

/**
 * SimpleAgent for quick responses without tools
 */
export const SimpleAgent: SimpleAgentClass<BaseEnv> = createSimpleAgent<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: TELEGRAM_SYSTEM_PROMPT,
  maxHistory: 20,
});

/**
 * HITLAgent for human-in-the-loop confirmations
 */
export const HITLAgent: HITLAgentClass<BaseEnv> = createHITLAgent<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: TELEGRAM_SYSTEM_PROMPT,
  confirmationThreshold: 'high',
});

/**
 * OrchestratorAgent for complex task decomposition
 */
export const OrchestratorAgent: OrchestratorAgentClass<BaseEnv> = createOrchestratorAgent<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  maxSteps: 10,
  maxParallel: 3,
  continueOnError: true,
});

/**
 * CodeWorker for code analysis and generation
 */
export const CodeWorker: WorkerClass<BaseEnv> = createCodeWorker<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  defaultLanguage: 'typescript',
});

/**
 * ResearchWorker for web research and documentation
 */
export const ResearchWorker: WorkerClass<BaseEnv> = createResearchWorker<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
});

/**
 * GitHubWorker for GitHub operations
 */
export const GitHubWorker: WorkerClass<BaseEnv> = createGitHubWorker<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
});

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  TelegramAgent: CloudflareChatAgentNamespace<BaseEnv, TelegramContext>;
}
