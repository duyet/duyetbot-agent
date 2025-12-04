/**
 * Agent Provider for Shared Agents
 *
 * Unified provider configuration used by all shared Durable Objects.
 * Uses OpenRouter SDK via Cloudflare AI Gateway.
 * Supports xAI Grok native tools (web_search, x_search).
 *
 * ## Provider Types
 *
 * - `createProvider()` - Returns `AgentProvider` for agents (RouterAgent, SimpleAgent, etc.)
 *   that extend BaseAgent and need transport capabilities.
 * - `createLLMProvider()` - Returns `LLMProvider` for workers (CodeWorker, etc.)
 *   that extend Agent directly and only need LLM chat.
 *
 * ## Architecture Note
 *
 * Shared agents are called by parent workers (telegram-bot, github-bot).
 * Transport operations (send/edit/typing) are stubs here because:
 * - The parent worker owns the transport layer
 * - Sub-agents return AgentResult with response text
 * - Parent ChatAgent handles actual message delivery
 */

import type { AgentProvider, LLMProvider, ProviderExecutionContext } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  createOpenRouterProvider,
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
} from '@duyetbot/providers';

/**
 * Environment for shared agents provider
 * Extends OpenRouterProviderEnv for type safety
 */
export type ProviderEnv = OpenRouterProviderEnv;

/**
 * Create an LLM provider for workers (CodeWorker, ResearchWorker, etc.)
 *
 * Workers extend Agent directly and only need LLM chat capabilities.
 *
 * @param env - Worker environment bindings
 * @param options - Optional provider configuration
 */
export function createLLMProvider(
  env: ProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): LLMProvider {
  return createOpenRouterProvider(env, {
    maxTokens: 1024,
    requestTimeout: 30000,
    enableWebSearch: true,
    logger,
    ...options,
  });
}

/**
 * Create an AgentProvider for agents (RouterAgent, SimpleAgent, HITLAgent, etc.)
 *
 * Agents extend BaseAgent and need both LLM chat and transport capabilities.
 * Transport operations are stubs here - parent ChatAgent handles actual delivery.
 *
 * @param env - Worker environment bindings
 * @param options - Optional provider configuration
 */
export function createProvider(
  env: ProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): AgentProvider {
  const llmProvider = createOpenRouterProvider(env, {
    maxTokens: 1024,
    requestTimeout: 30000,
    enableWebSearch: true,
    logger,
    ...options,
  });

  // Wrap LLMProvider with transport stubs and adapted chat signature
  return {
    // Adapt chat signature: AgentProvider uses (messages, options?) format
    // while LLMProvider uses (messages, tools?, options?) format
    chat: async (messages, chatOptions) => {
      // Extract tools from options if present, pass to underlying provider
      const tools = chatOptions?.tools;
      return llmProvider.chat(messages, tools, chatOptions);
    },

    // Transport stubs - parent worker handles actual message delivery
    send: async (_ctx: ProviderExecutionContext, _content: string) => {
      logger.debug(
        '[SharedProvider] send() called - returning stub ref (parent handles transport)'
      );
      return 0; // Stub message ref
    },

    edit: async (_ctx: ProviderExecutionContext, _ref: string | number, _content: string) => {
      logger.debug('[SharedProvider] edit() called - no-op (parent handles transport)');
    },

    typing: async (_ctx: ProviderExecutionContext) => {
      logger.debug('[SharedProvider] typing() called - no-op (parent handles transport)');
    },

    createContext: (input) => ({
      text: input.text,
      userId: input.userId,
      chatId: input.chatId,
      ...(input.username && { username: input.username }),
      messageRef: input.messageRef,
    }),
  };
}
