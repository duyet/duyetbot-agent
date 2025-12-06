/**
 * OpenRouter Provider (Raw Fetch)
 *
 * Unified LLM provider using raw fetch via Cloudflare AI Gateway.
 * Avoids OpenRouter SDK's strict Zod validation which can fail when
 * AI Gateway transforms response fields.
 *
 * Supports web search via OpenRouter plugins (native for xAI models).
 *
 * @see https://openrouter.ai/docs/api-reference/overview
 * @see https://openrouter.ai/docs/guides/features/web-search.md
 * @see https://developers.cloudflare.com/ai-gateway/
 * @see https://developers.cloudflare.com/ai-gateway/configuration/authentication/
 */
import type { LLMProvider } from '@duyetbot/cloudflare-agent';
/**
 * Cloudflare AI binding interface for AI Gateway URL generation
 */
export interface CloudflareAIBinding {
  gateway: (gatewayId: string) => {
    getUrl: (provider: string) => Promise<string>;
  };
}
/**
 * Environment bindings required for OpenRouter provider
 */
export interface OpenRouterProviderEnv {
  /** Cloudflare AI binding for gateway URL construction */
  AI: CloudflareAIBinding;
  /** Gateway name configured in Cloudflare dashboard */
  AI_GATEWAY_NAME: string;
  /** AI Gateway API key for BYOK authentication */
  AI_GATEWAY_API_KEY: string;
  /** Model to use (e.g., 'x-ai/grok-4.1-fast', 'anthropic/claude-3.5-sonnet') */
  MODEL?: string;
}
/**
 * OpenRouter web search plugin configuration
 * @see https://openrouter.ai/docs/guides/features/web-search.md
 */
export interface WebSearchPlugin {
  id: 'web';
  /** Search engine: 'native' uses provider's built-in (xAI, OpenAI, Anthropic), 'exa' uses Exa */
  engine?: 'native' | 'exa';
  /** Maximum search results (default: 5) */
  max_results?: number;
  /** Custom prompt for search results */
  search_prompt?: string;
}
/**
 * Configuration options for OpenRouter provider
 */
export interface OpenRouterProviderOptions {
  /** Default model if not specified in env (default: 'x-ai/grok-4.1-fast') */
  defaultModel?: string;
  /** Maximum tokens for response (default: 1024) */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 60000) */
  requestTimeout?: number;
  /** Enable web search by default (default: false) */
  enableWebSearch?: boolean;
  /** Web search plugin configuration */
  webSearchConfig?: Omit<WebSearchPlugin, 'id'>;
  /** Custom logger (defaults to console) */
  logger?: {
    info: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug?: (message: string, data?: Record<string, unknown>) => void;
  };
}
/**
 * Create an LLM provider using raw fetch via Cloudflare AI Gateway
 *
 * This implementation uses raw fetch instead of the OpenRouter SDK to avoid
 * strict Zod schema validation that can fail when AI Gateway transforms
 * response fields (e.g., missing `object: "chat.completion"`).
 *
 * Web search is enabled via the OpenRouter plugins parameter. For xAI models,
 * native web search is used automatically (which uses xAI's built-in web_search).
 *
 * @see https://openrouter.ai/docs/guides/features/web-search.md
 *
 * @example
 * ```typescript
 * import { createOpenRouterProvider } from '@duyetbot/providers';
 *
 * const provider = createOpenRouterProvider(env, {
 *   maxTokens: 512,
 *   enableWebSearch: true,  // Enable web search by default
 * });
 *
 * // Or enable per-request
 * const response = await provider.chat(
 *   [{ role: 'user', content: 'What is trending on X today?' }],
 *   undefined,
 *   { webSearch: true }
 * );
 * ```
 */
export declare function createOpenRouterProvider(
  env: OpenRouterProviderEnv,
  options?: OpenRouterProviderOptions
): LLMProvider;
//# sourceMappingURL=openrouter.d.ts.map
