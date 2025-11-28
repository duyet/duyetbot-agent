/**
 * LLM Provider for GitHub Bot
 *
 * Supports two provider modes:
 * - 'cloudflare' (default): Uses native Cloudflare AI binding
 * - 'openai': Uses OpenAI SDK with AI Gateway OpenRouter endpoint
 *
 * Set AI_GATEWAY_SDK='openai' to use OpenAI SDK mode.
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import {
  type AIGatewayEnv,
  type AIGatewayProviderOptions,
  type CloudflareAIBinding,
  type OpenAIGatewayProviderOptions,
  createAIGatewayProvider as createCloudflareProvider,
  createOpenAIGatewayProvider,
} from '@duyetbot/providers';
import { logger } from './logger.js';

/**
 * Environment for provider selection
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
 * Provider selection:
 * - AI_GATEWAY_SDK='cloudflare' or unset: Use native Cloudflare AI binding
 * - AI_GATEWAY_SDK='openai': Use OpenAI SDK with runTools() support
 *
 * @example
 * ```typescript
 * const provider = createOpenRouterProvider(env);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createOpenRouterProvider(
  env: ProviderEnv,
  options?: Partial<AIGatewayProviderOptions & OpenAIGatewayProviderOptions>
): LLMProvider {
  // Use OpenAI SDK mode if explicitly requested
  if (env.AI_GATEWAY_SDK === 'openai') {
    if (!env.OPENROUTER_API_KEY) {
      throw new Error('OpenAI SDK mode requires OPENROUTER_API_KEY');
    }

    logger.info('GitHub bot using OpenAI SDK provider', {
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
        maxTokens: 2048,
        logger,
        ...options,
      }
    );
  }

  // Default: Cloudflare native mode
  return createCloudflareProvider(env, {
    maxTokens: 2048,
    logger,
    ...options,
  });
}
