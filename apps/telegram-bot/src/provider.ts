/**
 * LLM Provider for Telegram Bot
 *
 * Re-exports the shared AI Gateway provider from @duyetbot/providers
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  type AIGatewayEnv,
  type AIGatewayProviderOptions,
  createAIGatewayProvider as createSharedProvider,
} from '@duyetbot/providers';

// Re-export the env type for backward compatibility
export type ProviderEnv = AIGatewayEnv;

/**
 * Create an LLM provider using Cloudflare AI Gateway
 *
 * @example
 * ```typescript
 * const provider = createAIGatewayProvider(env);
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createAIGatewayProvider(
  env: ProviderEnv,
  options?: Partial<AIGatewayProviderOptions>
): LLMProvider {
  return createSharedProvider(env, {
    maxTokens: 512,
    requestTimeout: 25000, // 25s timeout to prevent DO blockConcurrencyWhile timeout
    logger,
    ...options,
  });
}
