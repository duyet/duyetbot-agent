/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 *
 * This file only exports TelegramAgent (local DO).
 * Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from
 * duyetbot-agents worker via script_name in wrangler.toml.
 */

import type { RouterAgentEnv } from '@duyetbot/chat-agent';
import {
  type CloudflareChatAgentClass,
  type CloudflareChatAgentNamespace,
  createCloudflareChatAgent,
} from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from '@duyetbot/prompts';
import { getPlatformTools } from '@duyetbot/tools';
import { isAdminUser } from './debug-footer.js';
import { type ProviderEnv, createAIGatewayProvider } from './provider.js';
import { type TelegramContext, telegramTransport } from './transport.js';

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
    systemPrompt: getTelegramPrompt(),
    welcomeMessage: getTelegramWelcomeMessage(),
    helpMessage: getTelegramHelpMessage(),
    transport: telegramTransport,
    // MCP servers disabled - SSE connections cause connection pool exhaustion
    // TODO: Re-enable when MCP client supports AbortController timeouts
    mcpServers: [],
    tools: getPlatformTools('telegram'),
    // Reduce history to minimize token usage and subrequests
    // Cloudflare Workers limit: 50 subrequests per invocation
    maxHistory: 20,
    // Increase rotation interval to reduce edit subrequests
    thinkingRotationInterval: 5000,
    // Limit tool call iterations to prevent gateway timeouts
    maxToolIterations: 10,
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
        if (isAdminUser(ctx)) {
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
