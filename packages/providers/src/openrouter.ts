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

import type {
  ChatOptions,
  LLMMessage,
  LLMProvider,
  LLMResponse,
  OpenAITool,
  ToolCall,
} from '@duyetbot/cloudflare-agent';
import { estimateCost } from './pricing.js';

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
 * OpenRouter chat message format
 */
interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

/**
 * OpenRouter chat response format (relaxed for AI Gateway compatibility)
 */
interface OpenRouterChatResponse {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | null;
      annotations?: Array<{
        type: 'url_citation';
        url_citation: {
          url: string;
          title: string;
          content?: string;
          start_index: number;
          end_index: number;
        };
      }>;
      tool_calls?: Array<{
        id?: string; // May be undefined for native tools (e.g., xAI web_search)
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  provider?: string;
  /** Token usage statistics (OpenAI-compatible format) */
  usage?: {
    /** Number of tokens in the prompt */
    prompt_tokens: number;
    /** Number of tokens in the completion */
    completion_tokens: number;
    /** Total tokens (prompt + completion) */
    total_tokens?: number;
    /** Extended prompt token details (model-specific) */
    prompt_tokens_details?: {
      /** Cached tokens from prompt cache (Claude, GPT-4 Turbo) */
      cached_tokens?: number;
    };
    /** Extended completion token details (model-specific) */
    completion_tokens_details?: {
      /** Reasoning tokens for o1/o3 models */
      reasoning_tokens?: number;
    };
    /** Actual cost charged to account (when usage: {include: true} is set) */
    cost?: number;
    /** Detailed cost breakdown */
    cost_details?: {
      /** Upstream provider inference cost (for BYOK) */
      upstream_inference_cost?: number;
    };
  };
  error?: {
    message: string;
    type?: string;
    code?: string | number;
  };
}

/**
 * Convert LLMMessage to OpenRouter message format
 */
function toOpenRouterMessage(msg: LLMMessage): OpenRouterMessage {
  return {
    role: msg.role,
    content: msg.content,
    ...(msg.tool_call_id && { tool_call_id: msg.tool_call_id }),
    ...(msg.name && { name: msg.name }),
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
export function createOpenRouterProvider(
  env: OpenRouterProviderEnv,
  options: OpenRouterProviderOptions = {}
): LLMProvider {
  const {
    defaultModel = 'x-ai/grok-4.1-fast',
    maxTokens = 1024,
    requestTimeout = 60000,
    enableWebSearch = false,
    webSearchConfig,
    logger = console,
  } = options;

  const model = env.MODEL || defaultModel;

  // Lazy-initialized gateway URL - resolves on first use
  let gatewayUrlPromise: Promise<string> | null = null;

  const getGatewayUrl = async (): Promise<string> => {
    if (!gatewayUrlPromise) {
      gatewayUrlPromise = env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
    }
    return gatewayUrlPromise;
  };

  const processResponse = (data: OpenRouterChatResponse, startTime: number): LLMResponse => {
    if (data.error) {
      throw new Error(data.error.message || 'Unknown API error');
    }

    const choice = data.choices?.[0]?.message;

    // Extract tool calls if present
    const toolCalls = choice?.tool_calls
      ?.filter((tc) => tc.type === 'function')
      .map((tc, index) => ({
        id: tc.id || `tool_call_${Date.now()}_${index}`,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    // Extract web search citations if present
    const citations = choice?.annotations?.filter((a) => a.type === 'url_citation');

    const responseModel = data.model || model;
    const cachedTokens = data.usage?.prompt_tokens_details?.cached_tokens;
    const costEstimate = data.usage
      ? estimateCost(responseModel, {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          ...(cachedTokens !== undefined && { cachedTokens }),
        })
      : undefined;

    return {
      content: choice?.content || '',
      ...(toolCalls?.length && { toolCalls }),
      ...(data.model && { model: data.model }),
      ...(data.usage && {
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens:
            data.usage.total_tokens ?? data.usage.prompt_tokens + data.usage.completion_tokens,
          ...(data.usage.prompt_tokens_details?.cached_tokens && {
            cachedTokens: data.usage.prompt_tokens_details.cached_tokens,
          }),
          ...(data.usage.cost !== undefined && { actualCostUsd: data.usage.cost }),
          ...(costEstimate !== undefined && { estimatedCostUsd: costEstimate }),
        },
      }),
      ...(citations?.length && {
        citations: citations.map((c) => ({
          url: c.url_citation.url,
          title: c.url_citation.title,
          ...(c.url_citation.content && { content: c.url_citation.content }),
        })),
      }),
    };
  };

  return {
    async chat(
      messages: LLMMessage[],
      tools?: OpenAITool[],
      chatOptions?: ChatOptions
    ): Promise<LLMResponse> {
      const openRouterMessages = messages.map(toOpenRouterMessage);
      const shouldEnableWebSearch =
        chatOptions?.webSearch !== undefined ? chatOptions.webSearch : enableWebSearch;

      const plugins: WebSearchPlugin[] = shouldEnableWebSearch
        ? [
            {
              id: 'web',
              engine: 'native',
              ...webSearchConfig,
            },
          ]
        : [];

      logger.info('OpenRouter chat request', {
        model,
        messageCount: messages.length,
        hasTools: !!tools?.length,
        webSearch: shouldEnableWebSearch,
      });

      const startTime = Date.now();

      try {
        const gatewayUrl = await getGatewayUrl();
        const url = `${gatewayUrl}/chat/completions`;

        const body = {
          model,
          messages: openRouterMessages,
          max_tokens: maxTokens,
          usage: { include: true },
          ...(plugins.length > 0 && { plugins }),
          ...(tools?.length && {
            tools,
            tool_choice: 'auto',
          }),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }

          const data = (await response.json()) as OpenRouterChatResponse;
          return processResponse(data, startTime);
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('OpenRouter chat error', { model, error: errorMessage });
        throw new Error(`OpenRouter error: ${errorMessage}`);
      }
    },

    async *streamChat(
      messages: LLMMessage[],
      tools?: OpenAITool[],
      chatOptions?: ChatOptions
    ): AsyncIterable<LLMResponse> {
      const openRouterMessages = messages.map(toOpenRouterMessage);
      const shouldEnableWebSearch =
        chatOptions?.webSearch !== undefined ? chatOptions.webSearch : enableWebSearch;

      const plugins: WebSearchPlugin[] = shouldEnableWebSearch
        ? [
            {
              id: 'web',
              engine: 'native',
              ...webSearchConfig,
            },
          ]
        : [];

      const gatewayUrl = await getGatewayUrl();
      const url = `${gatewayUrl}/chat/completions`;

      const body = {
        model,
        messages: openRouterMessages,
        max_tokens: maxTokens,
        stream: true,
        usage: { include: true },
        ...(plugins.length > 0 && { plugins }),
        ...(tools?.length && {
          tools,
          tool_choice: 'auto',
        }),
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      let accumulatedContent = '';
      const toolCallsMap = new Map<string, { id: string; name: string; arguments: string }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }

          const dataStr = trimmedLine.slice(6);
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const data = JSON.parse(dataStr);
            const choice = data.choices?.[0];

            if (choice?.delta) {
              const delta = choice.delta;

              if (delta.content) {
                accumulatedContent += delta.content;
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const id = tc.id;
                  if (id) {
                    if (!toolCallsMap.has(id)) {
                      toolCallsMap.set(id, {
                        id,
                        name: tc.function?.name || '',
                        arguments: '',
                      });
                    }
                  }

                  const index = tc.index ?? 0;
                  const entries = Array.from(toolCallsMap.values());
                  const entry = id ? toolCallsMap.get(id) : entries[index];

                  if (entry) {
                    if (tc.function?.name) {
                      entry.name = tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      entry.arguments += tc.function.arguments;
                    }
                  }
                }
              }

              yield {
                content: accumulatedContent,
                ...(toolCallsMap.size > 0 && {
                  toolCalls: Array.from(toolCallsMap.values()) as ToolCall[],
                }),
                ...(data.model && { model: data.model }),
              };
            }

            if (data.usage) {
              yield {
                content: accumulatedContent,
                ...(toolCallsMap.size > 0 && {
                  toolCalls: Array.from(toolCallsMap.values()) as ToolCall[],
                }),
                ...(data.model && { model: data.model }),
                usage: {
                  inputTokens: data.usage.prompt_tokens,
                  outputTokens: data.usage.completion_tokens,
                  totalTokens:
                    data.usage.total_tokens ||
                    data.usage.prompt_tokens + data.usage.completion_tokens,
                },
              };
            }
          } catch (e) {
            logger.error('Error parsing streaming chunk', { error: String(e), dataStr });
          }
        }
      }
    },
  };
}
