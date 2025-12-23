/**
 * Chat Web Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/cloudflare-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern for web-based chat.
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
import { getPlatformTools } from '@duyetbot/tools';
import { createAIGatewayProvider, type ProviderEnv } from './provider.js';
import { type WebContext, webTransport } from './transport.js';

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv {
  // Common config (from wrangler.toml [vars])
  ENVIRONMENT?: string;
  // Database for message persistence
  DB: D1Database;
  // Model configuration
  MODEL?: string;
  // Rate limiting configuration
  RATE_LIMIT_MAX?: number;
  RATE_LIMIT_WINDOW?: number;
}

/**
 * Chat Web Agent - Cloudflare Durable Object with ChatAgent
 *
 * Sessions are identified by web:{sessionId}.
 */
export const ChatAgent: CloudflareChatAgentClass<BaseEnv, WebContext> = createCloudflareChatAgent<
  BaseEnv,
  WebContext
>({
  createProvider: (env) => createAIGatewayProvider(env),
  // Use Telegram prompt with markdown format for web
  systemPrompt: (_env) =>
    getTelegramPrompt({
      outputFormat: 'telegram-markdown',
    }),
  welcomeMessage: getTelegramWelcomeMessage(),
  helpMessage: getTelegramHelpMessage(),
  transport: webTransport,
  // MCP servers disabled - SSE connections cause connection pool exhaustion
  mcpServers: [],
  tools: getPlatformTools('telegram'),
  // Increase history for web sessions (more context than mobile)
  maxHistory: 50,
  // Increase rotation interval for web (slower updates acceptable)
  thinkingRotationInterval: 3000,
  // Limit tool call iterations to prevent gateway timeouts
  maxToolIterations: 10,
  // Limit number of tools to reduce token overhead
  maxTools: 10,
  hooks: {
    onError: async (ctx, error, messageRef) => {
      // Log the error for monitoring
      logger.error('[AGENT] Error in handle()', {
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        error: error.message,
        messageRef,
      });

      // Framework automatically edits the thinking message to show error
      // For web, we could send additional error via SSE
      if (ctx.sseConnection) {
        const encoder = new TextEncoder();
        const errorMessage = JSON.stringify({
          type: 'error',
          message: error.message,
          messageRef,
        });
        await ctx.sseConnection.write(encoder.encode(`data: ${errorMessage}\n\n`));
      }
    },
  },
}) as unknown as CloudflareChatAgentClass<BaseEnv, WebContext>;

/**
 * Type for agent instance
 */
export type ChatAgentInstance = InstanceType<typeof ChatAgent>;

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  ChatAgent: CloudflareChatAgentNamespace<BaseEnv, WebContext>;
}
