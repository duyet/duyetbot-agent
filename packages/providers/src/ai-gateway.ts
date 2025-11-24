/**
 * Cloudflare AI Gateway Provider
 *
 * Unified LLM provider for Cloudflare Workers using AI Gateway.
 * Supports retry/backoff, caching, timeout configuration.
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 */

import type { LLMMessage, LLMProvider, LLMResponse, OpenAITool } from '@duyetbot/chat-agent';

/**
 * Environment bindings required for AI Gateway
 */
export interface AIGatewayEnv {
  /** Cloudflare AI binding */
  AI: Ai;
  /** Gateway name configured in Cloudflare dashboard */
  AI_GATEWAY_NAME: string;
  /** Provider name (e.g., 'openrouter', 'anthropic', 'openai') */
  AI_GATEWAY_PROVIDER?: string;
  /** API key for the provider (passed via cf-aig-authorization) */
  AI_GATEWAY_API_KEY?: string;
  /** Model to use (e.g., 'x-ai/grok-4.1-fast', 'claude-3-5-sonnet-20241022') */
  MODEL?: string;
}

/**
 * Retry configuration for AI Gateway requests
 */
export interface AIGatewayRetryConfig {
  /** Maximum number of retry attempts (max: 5) */
  maxAttempts?: number;
  /** Delay between retries in milliseconds (max: 5000) */
  retryDelay?: number;
  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential';
}

/**
 * Configuration options for AI Gateway provider
 */
export interface AIGatewayProviderOptions {
  /** Default model if not specified in env */
  defaultModel?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 25000) */
  requestTimeout?: number;
  /** Cache TTL in seconds (0 to disable) */
  cacheTtl?: number;
  /** Custom cache key */
  cacheKey?: string;
  /** Retry configuration */
  retry?: AIGatewayRetryConfig;
  /** Custom logger (defaults to console) */
  logger?: {
    info: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug?: (message: string, data?: Record<string, unknown>) => void;
  };
}

/**
 * OpenAI-compatible response format
 */
interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

/**
 * Create an LLM provider using Cloudflare AI Gateway
 *
 * @example
 * ```typescript
 * import { createAIGatewayProvider } from '@duyetbot/providers';
 *
 * const provider = createAIGatewayProvider(env, {
 *   maxTokens: 1024,
 *   requestTimeout: 30000,
 *   cacheTtl: 3600,
 *   retry: {
 *     maxAttempts: 3,
 *     retryDelay: 1000,
 *     backoff: 'exponential',
 *   },
 * });
 *
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createAIGatewayProvider(
  env: AIGatewayEnv,
  options: AIGatewayProviderOptions = {}
): LLMProvider {
  const {
    defaultModel = 'x-ai/grok-4.1-fast',
    maxTokens = 1024,
    requestTimeout = 25000,
    cacheTtl,
    cacheKey,
    retry,
    logger = console,
  } = options;

  return {
    async chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse> {
      const gateway = env.AI.gateway(env.AI_GATEWAY_NAME);
      const model = env.MODEL || defaultModel;
      const provider = env.AI_GATEWAY_PROVIDER || 'openrouter';

      // Build headers with AI Gateway specific options
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'cf-aig-request-timeout': String(requestTimeout),
      };

      // Add API key authorization
      if (env.AI_GATEWAY_API_KEY) {
        headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_API_KEY}`;
      }

      // Add caching headers
      if (cacheTtl !== undefined) {
        headers['cf-aig-cache-ttl'] = String(cacheTtl);
      }
      if (cacheKey) {
        headers['cf-aig-cache-key'] = cacheKey;
      }

      // Add retry headers
      if (retry) {
        if (retry.maxAttempts !== undefined) {
          headers['cf-aig-max-attempts'] = String(Math.min(retry.maxAttempts, 5));
        }
        if (retry.retryDelay !== undefined) {
          headers['cf-aig-retry-delay'] = String(Math.min(retry.retryDelay, 5000));
        }
        if (retry.backoff) {
          headers['cf-aig-backoff'] = retry.backoff;
        }
      }

      // Build query payload
      const query: Record<string, unknown> = {
        model,
        max_tokens: maxTokens,
        messages,
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        query.tools = tools;
        query.tool_choice = 'auto';
      }

      logger.info('AI Gateway request started', {
        model,
        provider,
        gateway: env.AI_GATEWAY_NAME,
        messageCount: messages.length,
        hasTools: tools && tools.length > 0,
        toolCount: tools?.length || 0,
        maxTokens,
        requestTimeout,
        cacheTtl,
        retry,
      });

      const startTime = Date.now();

      let response: Response;
      try {
        response = await gateway.run({
          provider,
          endpoint: 'chat/completions',
          headers,
          query,
        });
      } catch (gatewayError) {
        const errorMessage =
          gatewayError instanceof Error ? gatewayError.message : String(gatewayError);
        logger.error('AI Gateway run error', {
          model,
          provider,
          gateway: env.AI_GATEWAY_NAME,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`AI Gateway run failed: ${errorMessage}`);
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('AI Gateway error response', {
          model,
          provider,
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
      }

      let data: OpenAIResponse;
      try {
        data = (await response.json()) as OpenAIResponse;
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error('AI Gateway response parse error', {
          model,
          provider,
          error: errorMsg,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`Failed to parse AI Gateway response: ${errorMsg}`);
      }

      const choice = data.choices?.[0]?.message;

      // Extract tool calls if present
      const toolCalls = choice?.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      const durationMs = Date.now() - startTime;

      logger.info('AI Gateway request completed', {
        model,
        provider,
        durationMs,
        hasContent: !!choice?.content,
        contentLength: choice?.content?.length || 0,
        toolCallCount: toolCalls?.length || 0,
      });

      return {
        content: choice?.content || '',
        ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
      };
    },
  };
}
