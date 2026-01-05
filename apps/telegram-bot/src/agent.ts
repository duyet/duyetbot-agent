/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/cloudflare-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 *
 * This file only exports TelegramAgent (local DO).
 * Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from
 * duyetbot-shared-agents worker via script_name in wrangler.toml.
 */

import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  createCloudflareChatAgent,
} from '@duyetbot/cloudflare-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from '@duyetbot/prompts';
import { getAllBuiltinTools, toolSearchTool } from '@duyetbot/tools';
import { createAIGatewayProvider, type ProviderEnv } from './provider.js';
import { type TelegramContext, telegramTransport } from './transport.js';

toolSearchTool.initialize(getAllBuiltinTools());

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv {
  // Common config (from wrangler.toml [vars])
  ENVIRONMENT?: string;
  // Telegram-specific
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_ALLOWED_USERS?: string;
  TELEGRAM_ADMIN?: string;
  TELEGRAM_PARSE_MODE?: 'HTML' | 'MarkdownV2';
  WORKER_URL?: string;
  GITHUB_TOKEN?: string;
  // Cloudflare deployment API (for /deploy command)
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  ROUTER_DEBUG?: string;
  // Internal forward endpoint (for web app integration)
  FORWARD_SECRET?: string;
  TELEGRAM_FORWARD_CHAT_ID?: string;
  // Admin chat ID for scheduled notifications
  TELEGRAM_ADMIN_CHAT_ID?: string;
}

/**
 * Telegram Agent - Cloudflare Durable Object with ChatAgent
 *
 * Sessions are identified by telegram:{chatId}.
 */
export const TelegramAgent: CloudflareChatAgentClass<BaseEnv, TelegramContext> =
  createCloudflareChatAgent<BaseEnv, TelegramContext>({
    createProvider: (env) => createAIGatewayProvider(env),
    // Dynamic system prompt based on TELEGRAM_PARSE_MODE env var
    // Default to MarkdownV2 (LLMs generate Markdown naturally)
    systemPrompt: (env) =>
      getTelegramPrompt({
        outputFormat: env.TELEGRAM_PARSE_MODE === 'HTML' ? 'telegram-html' : 'telegram-markdown',
      }),
    welcomeMessage: getTelegramWelcomeMessage(),
    helpMessage: getTelegramHelpMessage(),
    transport: telegramTransport,
    // MCP servers disabled - SSE connections cause connection pool exhaustion
    // TODO: Re-enable when MCP client supports AbortController timeouts
    mcpServers: [],
    // Initialize tool search with all available tools for on-demand discovery
    // Only expose tool_search initially (85% context savings)
    tools: [toolSearchTool],
    // Reduce history to minimize token usage and subrequests
    // Cloudflare Workers limit: 50 subrequests per invocation
    maxHistory: 20,
    // Increase rotation interval to reduce edit subrequests
    thinkingRotationInterval: 5000,
    // Tool iterations - allow complex multi-step tasks like Claude Code
    maxToolIterations: 25,
    // Limit number of tools to reduce token overhead and prevent timeouts
    maxTools: 5,
    // Extract platform config for shared DOs (includes AI Gateway credentials)
    hooks: {
      beforeHandle: async (_ctx) => {
        toolSearchTool.initialize(getAllBuiltinTools());
      },
      onError: async (ctx, error, messageRef) => {
        // Log the error for monitoring
        logger.error('[AGENT] Error in handle()', {
          userId: ctx.userId,
          chatId: ctx.chatId,
          error: error.message,
          messageRef,
          isAdmin: ctx.isAdmin,
        });

        // Framework automatically edits thinking message to show error
        // For admins, send additional detailed error info
        if (ctx.isAdmin) {
          await telegramTransport.send(ctx, `🔍 Debug: ${error.message}`);
        }
      },
    },
  }) as unknown as CloudflareChatAgentClass<BaseEnv, TelegramContext>;

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
