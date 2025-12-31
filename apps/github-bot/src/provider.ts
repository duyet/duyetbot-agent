/**
 * LLM Provider for GitHub Bot
 *
 * Creates an LLM provider using OpenRouter SDK via Cloudflare AI Gateway.
 * Supports native web search for xAI models.
 */

import type { LLMProvider } from '@duyetbot/cloudflare-agent';
import {
  createOpenRouterProvider,
  type OpenRouterProviderEnv,
  type OpenRouterProviderOptions,
} from '@duyetbot/providers';
import { logger } from './logger.js';

/**
 * Environment for GitHub bot provider
 *
 * Combines OpenRouter provider config with GitHub platform requirements
 */
export interface GitHubEnv extends OpenRouterProviderEnv {
  // GitHub API
  GITHUB_TOKEN: string;
  GITHUB_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
  GITHUB_ADMIN?: string;

  // Common config
  ENVIRONMENT?: string;
  ROUTER_DEBUG?: string;
}

/**
 * Create an LLM provider for GitHub bot
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
  logger.info('GitHub bot creating LLM provider', {
    gateway: env.AI_GATEWAY_NAME,
    model: env.MODEL || 'x-ai/grok-4.1-fast',
  });

  return createOpenRouterProvider(env, {
    maxTokens: 2048,
    requestTimeout: 60000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}

// Re-export for backwards compatibility
export type ProviderEnv = OpenRouterProviderEnv;
export { createProvider as createOpenRouterProvider };
