/**
 * LLM Provider for Shared Agents
 *
 * Unified provider configuration used by all shared Durable Objects.
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
 * Environment for shared agents provider
 * Extends OpenRouterProviderEnv for type safety
 */
export type ProviderEnv = OpenRouterProviderEnv;

/**
 * Create an LLM provider for shared agents
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
  return createOpenRouterProvider(env as OpenRouterProviderEnv, {
    maxTokens: 1024,
    requestTimeout: 30000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}
