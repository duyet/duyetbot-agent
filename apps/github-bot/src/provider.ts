/**
 * LLM Provider for GitHub Bot
 *
 * Re-exports the shared AI Gateway provider from @duyetbot/providers
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import {
  type AIGatewayEnv,
  type AIGatewayProviderOptions,
  createAIGatewayProvider as createSharedProvider,
} from '@duyetbot/providers';
import { logger } from './logger.js';

// Re-export the env type for backward compatibility
export type ProviderEnv = AIGatewayEnv;

/**
 * Create an LLM provider using Cloudflare AI Gateway
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
  options?: Partial<AIGatewayProviderOptions>
): LLMProvider {
  return createSharedProvider(env, {
    maxTokens: 2048,
    logger,
    ...options,
  });
}
