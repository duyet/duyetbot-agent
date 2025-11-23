/**
 * Telegram Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern.
 */

import {
  type CloudflareAgentState,
  createCloudflareChatAgent,
} from "@duyetbot/chat-agent";
import {
  TELEGRAM_HELP_MESSAGE,
  TELEGRAM_SYSTEM_PROMPT,
  TELEGRAM_WELCOME_MESSAGE,
} from "@duyetbot/prompts";
import type { Agent, AgentNamespace } from "agents";
import { type ProviderEnv, createAIGatewayProvider } from "./provider.js";

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

  // Memory MCP (optional - auto-configured with defaults)
  MEMORY_MCP_TOKEN?: string;
}

/**
 * Agent class interface for type safety
 */
interface TelegramAgentClass {
  new (...args: unknown[]): Agent<BaseEnv, CloudflareAgentState> & {
    init(userId?: string | number, chatId?: string | number): Promise<void>;
    chat(userMessage: string): Promise<string>;
    clearHistory(): Promise<string>;
    getWelcome(): string;
    getHelp(): string;
    getMessageCount(): number;
    setMetadata(metadata: Record<string, unknown>): void;
    getMetadata(): Record<string, unknown> | undefined;
  };
}

/**
 * Telegram Agent - Cloudflare Durable Object with ChatAgent
 *
 * Memory is auto-configured with default MCP URL.
 * Sessions are identified by telegram:{chatId}.
 */
export const TelegramAgent = createCloudflareChatAgent<BaseEnv>({
  createProvider: (env) => createAIGatewayProvider(env),
  systemPrompt: TELEGRAM_SYSTEM_PROMPT,
  welcomeMessage: TELEGRAM_WELCOME_MESSAGE,
  helpMessage: TELEGRAM_HELP_MESSAGE,
  maxHistory: 20,
  // Session ID for memory persistence
  getSessionId: (userId, chatId) => `telegram:${chatId || userId}`,
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
