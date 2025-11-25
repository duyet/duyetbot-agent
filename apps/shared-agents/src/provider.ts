/**
 * LLM Provider for Shared Agents
 *
 * Unified provider configuration used by all shared Durable Objects.
 * Uses Cloudflare AI Gateway with OpenRouter.
 */

import type { LLMProvider } from '@duyetbot/chat-agent';
import { logger } from '@duyetbot/hono-middleware';
import {
  type AIGatewayEnv,
  type AIGatewayProviderOptions,
  createAIGatewayProvider as createSharedProvider,
} from '@duyetbot/providers';

export type ProviderEnv = AIGatewayEnv;

/**
 * Create an LLM provider using Cloudflare AI Gateway
 *
 * Unified provider for all shared agents/workers.
 * Uses moderate maxTokens to balance both Telegram (short) and GitHub (longer) responses.
 */
export function createProvider(
  env: ProviderEnv,
  options?: Partial<AIGatewayProviderOptions>
): LLMProvider {
  return createSharedProvider(env, {
    maxTokens: 1024,
    requestTimeout: 25000,
    logger,
    ...options,
  });
}
