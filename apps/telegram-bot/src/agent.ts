/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 */

import {
  type CloudflareAgentState,
  type MCPServerConnection,
  createCloudflareChatAgent,
} from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  TELEGRAM_HELP_MESSAGE,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
} from '@duyetbot/prompts';
import type { Agent, AgentNamespace } from 'agents';
import { type ProviderEnv, createAIGatewayProvider } from './provider.js';
import { type TelegramContext, telegramTransport } from './transport.js';

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
 * Agent class interface for type safety
 */
interface TelegramAgentClass {
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
    handle(ctx: TelegramContext): Promise<void>;
  };
}

/**
 * Telegram Agent - Cloudflare Durable Object with ChatAgent
 *
 * Simplified: No MCP memory, no tools - just LLM chat with DO state persistence.
 * Sessions are identified by telegram:{chatId}.
 */
export const TelegramAgent = createCloudflareChatAgent<BaseEnv, TelegramContext>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: TELEGRAM_SYSTEM_PROMPT,
  welcomeMessage: TELEGRAM_WELCOME_MESSAGE,
  helpMessage: TELEGRAM_HELP_MESSAGE,
  transport: telegramTransport,
  mcpServers: [githubMcpServer],
  hooks: {
    onError: async (ctx, error) => {
      logger.error('[AGENT] Error in handle()', {
        userId: ctx.userId,
        chatId: ctx.chatId,
        error: error.message,
      });

      // Send error message to user
      const isAdmin = ctx.adminUsername && ctx.username === ctx.adminUsername;
      const errorMessage = isAdmin
        ? `❌ Error: ${error.message}`
        : '❌ Sorry, an error occurred. Please try again later.';

      await telegramTransport.send(ctx, errorMessage);
    },
  },
}) as unknown as TelegramAgentClass;

/**
 * Type for agent instance
 */
export type TelegramAgentInstance = InstanceType<typeof TelegramAgent>;

/**
 * Full environment with agent binding
 */
export interface Env extends BaseEnv {
  TelegramAgent: AgentNamespace<TelegramAgentInstance>;
}
