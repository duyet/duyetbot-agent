/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 */

import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  createCloudflareChatAgent,
} from '@duyetbot/chat-agent';
import type { MCPServerConnection } from '@duyetbot/chat-agent';
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
 */
const duyetMcpServer: MCPServerConnection = {
  name: 'duyet-mcp',
  url: 'https://mcp.duyet.net/sse',
};

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv {
  // Required
  TELEGRAM_BOT_TOKEN: string;

  // Optional
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ALLOWED_USERS?: string;
  TELEGRAM_ADMIN?: string; // Admin username for verbose error messages
  WORKER_URL?: string;
  GITHUB_TOKEN?: string;
}

/**
 * Telegram Agent - Cloudflare Durable Object with ChatAgent
 *
 * Simplified: No MCP memory, no tools - just LLM chat with DO state persistence.
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
    mcpServers: [duyetMcpServer],
    tools: getPlatformTools('telegram'),
    // Reduce history to minimize token usage and subrequests
    // Cloudflare Workers limit: 50 subrequests per invocation
    maxHistory: 20,
    // Increase rotation interval to reduce edit subrequests
    thinkingRotationInterval: 10000,
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
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  TelegramAgent: CloudflareChatAgentNamespace<BaseEnv, TelegramContext>;
}
