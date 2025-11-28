/**
 * LLM Provider for Shared Agents
 *
 * Unified provider configuration used by all shared Durable Objects.
 * Supports two provider modes:
 * - 'cloudflare' (default): Uses native Cloudflare AI binding (env.AI.gateway)
 * - 'openai': Uses OpenAI SDK with AI Gateway OpenRouter endpoint
 *
 * Set AI_GATEWAY_SDK='openai' to use OpenAI SDK mode.
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  type AIGatewayEnv,
  type AIGatewayProviderOptions,
  type CloudflareAIBinding,
  type OpenAIGatewayProviderOptions,
  createAIGatewayProvider as createCloudfareProvider,
  createOpenAIGatewayProvider,
} from '@duyetbot/providers';

/**
 * Environment for provider selection
 *
 * Supports both Cloudflare native and OpenAI SDK modes.
 * All required fields from AIGatewayEnv plus optional OpenAI-specific fields.
 */
export interface ProviderEnv extends AIGatewayEnv {
  /** Provider SDK mode: 'cloudflare' (default) | 'openai' */
  AI_GATEWAY_SDK?: 'cloudflare' | 'openai';
  /** Cloudflare account ID (required for OpenAI SDK mode) */
  AI_GATEWAY_ACCOUNT_ID?: string;
  /** OpenRouter API key (required for OpenAI SDK mode) */
  OPENROUTER_API_KEY?: string;
}

/**
 * Create an LLM provider using Cloudflare AI Gateway
 *
 * Unified provider for all shared agents/workers.
 *
 * Provider selection:
 * - AI_GATEWAY_SDK='cloudflare' or unset: Use native Cloudflare AI binding
 * - AI_GATEWAY_SDK='openai': Use OpenAI SDK (requires AI_GATEWAY_ACCOUNT_ID, OPENROUTER_API_KEY)
 *
 * OpenAI SDK mode enables:
 * - runTools() for automatic tool calling loop
 * - Better TypeScript support from OpenAI SDK
 *
 * @example
 * ```typescript
 * // Cloudflare mode (default)
 * const provider = createProvider(env);
 *
 * // OpenAI SDK mode
 * const provider = createProvider({
 *   ...env,
 *   AI_GATEWAY_SDK: 'openai',
 *   AI_GATEWAY_ACCOUNT_ID: 'abc123',
 *   OPENROUTER_API_KEY: 'sk-or-xxx',
 * });
 * ```
 */
export function createProvider(
  env: ProviderEnv,
  options?: Partial<AIGatewayProviderOptions & OpenAIGatewayProviderOptions>
): LLMProvider {
  // Use OpenAI SDK mode if explicitly requested
  if (env.AI_GATEWAY_SDK === 'openai') {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenAI SDK mode requires OPENROUTER_API_KEY');
    }

    logger.info('Using OpenAI SDK provider mode', {
      gateway: env.AI_GATEWAY_NAME,
      model: env.MODEL,
    });

    return createOpenAIGatewayProvider(
      {
        AI: env.AI as CloudflareAIBinding,
        AI_GATEWAY_NAME: env.AI_GATEWAY_NAME,
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        ...(env.MODEL && { MODEL: env.MODEL }),
      },
      {
        maxTokens: 1024,
        requestTimeout: 25000,
        logger,
        ...options,
      }
    );
  }

  // Default: Cloudflare native mode
  return createCloudfareProvider(env, {
    maxTokens: 1024,
    requestTimeout: 25000,
    logger,
    ...options,
  });
}
