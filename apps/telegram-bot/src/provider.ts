/**
 * LLM Provider for Telegram Bot
 *
 * Uses OpenRouter SDK via Cloudflare AI Gateway.
 * Supports xAI Grok native tools (web_search, x_search).
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
  createOpenRouterProvider,
} from '@duyetbot/providers';

/**
 * Environment for Telegram bot provider
 * Extends OpenRouterProviderEnv for type safety
 */
export type ProviderEnv = OpenRouterProviderEnv;

/**
 * Create an LLM provider for Telegram bot
 *
 * @example
 * ```typescript
 * const provider = createProvider(env);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createProvider(
  env: ProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): LLMProvider {
  logger.info('Telegram bot creating provider', {
    gateway: env.AI_GATEWAY_NAME,
    model: env.MODEL || 'x-ai/grok-4.1-fast',
  });

  return createOpenRouterProvider(env as OpenRouterProviderEnv, {
    maxTokens: 512,
    requestTimeout: 25000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}

// Re-export for backwards compatibility
export { createProvider as createAIGatewayProvider };
