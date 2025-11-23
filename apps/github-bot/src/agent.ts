/**
 * GitHub Agent using Cloudflare Agents SDK
 *
 * Uses @duyetbot/chat-agent's createCloudflareChatAgent for
 * a clean, reusable agent pattern with Durable Object state.
 */

import { type CloudflareAgentState, createCloudflareChatAgent } from '@duyetbot/chat-agent';
import { GITHUB_SYSTEM_PROMPT } from '@duyetbot/prompts';
import type { Agent, AgentNamespace } from 'agents';
import { type ProviderEnv, createOpenRouterProvider } from './provider.js';
import { githubTools } from './tools/index.js';

/**
 * Base environment without self-reference
 */
interface BaseEnv extends ProviderEnv {
  // GitHub Configuration
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;

  // Memory MCP (optional - auto-configured with defaults)
  MEMORY_MCP_TOKEN?: string;
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
  };
}

/**
 * GitHub Agent - Cloudflare Durable Object with ChatAgent
 *
 * Memory is auto-configured with default MCP URL.
 * Sessions are identified by github:{context}.
 */
export const GitHubAgent = createCloudflareChatAgent<BaseEnv>({
  createProvider: (env) => createOpenRouterProvider(env),
  systemPrompt: GITHUB_SYSTEM_PROMPT,
  maxHistory: 30, // More history for complex GitHub conversations
  tools: githubTools,
  // Note: onToolCall is set dynamically per request with context
  // Session ID for memory persistence
  getSessionId: (userId, chatId) => {
    // userId is typically the GitHub context like "owner/repo:issue:123"
    if (userId) {
      return `github:${userId}`;
    }
    if (chatId) {
      return `github:${chatId}`;
    }
    return undefined;
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
