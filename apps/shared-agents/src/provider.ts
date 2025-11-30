/**
 * LLM Provider for Shared Agents
 *
 * Unified provider configuration used by all shared Durable Objects.
 * Uses OpenRouter SDK via Cloudflare AI Gateway.
 * Supports xAI Grok native tools (web_search, x_search).
 *
 * ## Credential Flow
 *
 * Cloudflare secrets don't cross Durable Object script boundaries automatically.
 * This provider receives credentials via AgentContext.platformConfig from parent workers.
 *
 * ```
 * telegram-bot                     shared-agents DO
 *     │                                  │
 *     ├─ extractPlatformConfig()         │
 *     │   └─ AI_GATEWAY_API_KEY ─────────┼──> context.platformConfig.aiGatewayApiKey
 *     │   └─ AI_GATEWAY_NAME ────────────┼──> context.platformConfig.aiGatewayName
 *     │                                  │
 *     └─ callAgent(RouterAgent) ─────────┼──> createProvider(env, context)
 *                                        │       └─ merges platformConfig with env
 *                                        │
 *                                        └──> OpenRouter via AI Gateway ✓
 * ```
 */

import type { CommonPlatformConfig, LLMProvider } from '@duyetbot/chat-agent';
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
 * Uses platformConfig from AgentContext to get AI Gateway credentials
 * that are passed from the parent worker (telegram-bot, github-bot).
 *
 * @param env - Worker environment bindings
 * @param options - Optional provider configuration
 * @param platformConfig - Platform config from parent (contains AI Gateway credentials)
 *
 * @example
 * ```typescript
 * const provider = createProvider(env, undefined, context.platformConfig);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createProvider(
  env: ProviderEnv,
  options?: Partial<OpenRouterProviderOptions>,
  platformConfig?: CommonPlatformConfig
): LLMProvider {
  // Merge platformConfig credentials with env
  // platformConfig takes precedence (comes from parent worker)
  const effectiveEnv: OpenRouterProviderEnv = {
    AI: env.AI,
    AI_GATEWAY_NAME: platformConfig?.aiGatewayName ?? env.AI_GATEWAY_NAME,
    AI_GATEWAY_API_KEY: platformConfig?.aiGatewayApiKey ?? env.AI_GATEWAY_API_KEY,
    MODEL: platformConfig?.model ?? env.MODEL,
  };

  return createOpenRouterProvider(effectiveEnv, {
    maxTokens: 1024,
    requestTimeout: 30000,
    enableWebSearch: true, // Enable native web search for xAI models
    logger,
    ...options,
  });
}
