/**
 * LLM Provider for Telegram Bot
 *
 * Creates an LLM provider using OpenRouter SDK via Cloudflare AI Gateway.
 * Supports xAI Grok native tools (web_search, x_search).
 */

import type { LLMProvider } from '@duyetbot/cloudflare-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  createOpenRouterProvider,
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
} from '@duyetbot/providers';

/**
 * Create an LLM provider for Telegram bot
 *
 * @param env - Environment with OpenRouter configuration
 * @param options - Optional provider options
 * @returns LLM provider for chat operations
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
  env: OpenRouterProviderEnv,
  options?: Partial<OpenRouterProviderOptions>
): LLMProvider {
  logger.info('Telegram bot creating LLM provider', {
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

// Alias for backwards compatibility
export { createProvider as createAIGatewayProvider };

// Re-export provider env type
export type ProviderEnv = OpenRouterProviderEnv;
