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
/**
 * Convert LLMMessage to OpenRouter message format
 */
function toOpenRouterMessage(msg) {
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
export function createOpenRouterProvider(env, options = {}) {
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
  let gatewayUrlPromise = null;
  const getGatewayUrl = async () => {
    if (!gatewayUrlPromise) {
      gatewayUrlPromise = env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
    }
    return gatewayUrlPromise;
  };
  return {
    async chat(messages, tools, chatOptions) {
      const openRouterMessages = messages.map(toOpenRouterMessage);
      // Determine if web search should be enabled for this request
      const shouldEnableWebSearch =
        chatOptions?.webSearch !== undefined ? chatOptions.webSearch : enableWebSearch;
      // Build plugins array for web search
      // For xAI models, uses native search (xAI's built-in web_search)
      // @see https://openrouter.ai/docs/guides/features/web-search.md
      const plugins = shouldEnableWebSearch
        ? [
            {
              id: 'web',
              engine: 'native', // Use native for xAI (web_search), OpenAI, Anthropic, Perplexity
              ...webSearchConfig,
            },
          ]
        : [];
      logger.info('OpenRouter chat request', {
        model,
        messageCount: messages.length,
        hasTools: !!tools?.length,
        webSearch: shouldEnableWebSearch,
        plugins: plugins.length > 0 ? plugins : undefined,
      });
      const startTime = Date.now();
      try {
        // Get AI Gateway URL for OpenRouter
        const gatewayUrl = await getGatewayUrl();
        const url = `${gatewayUrl}/chat/completions`;
        logger.debug?.('OpenRouter request URL', {
          url,
          gateway: env.AI_GATEWAY_NAME,
        });
        // Build request body
        const body = {
          model,
          messages: openRouterMessages,
          max_tokens: maxTokens,
          // Add plugins for web search
          ...(plugins.length > 0 && { plugins }),
          // Pass standard function tools
          ...(tools?.length && {
            tools,
            tool_choice: 'auto',
          }),
        };
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
        try {
          // Using BYOK (Bring Your Own Keys) - API key is configured in Cloudflare dashboard
          // Only cf-aig-authorization header is needed, no Authorization header
          // @see https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
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
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error?.message) {
                errorMessage = errorJson.error.message;
              }
            } catch {
              // Use raw text if not JSON
              if (errorText) {
                errorMessage = errorText;
              }
            }
            throw new Error(errorMessage);
          }
          const data = await response.json();
          // Check for API-level error in response body
          if (data.error) {
            throw new Error(data.error.message || 'Unknown API error');
          }
          const choice = data.choices?.[0]?.message;
          // Extract tool calls if present (filter to function type only)
          // Generate fallback id for native tools that don't return one (e.g., xAI web_search)
          const toolCalls = choice?.tool_calls
            ?.filter((tc) => tc.type === 'function')
            .map((tc, index) => ({
              id: tc.id || `tool_call_${Date.now()}_${index}`,
              name: tc.function.name,
              arguments: tc.function.arguments,
            }));
          // Extract web search citations if present
          const citations = choice?.annotations?.filter((a) => a.type === 'url_citation');
          logger.info('OpenRouter chat completed', {
            model,
            provider: data.provider,
            durationMs: Date.now() - startTime,
            hasContent: !!choice?.content,
            toolCallCount: toolCalls?.length || 0,
            citationCount: citations?.length || 0,
            usage: data.usage
              ? {
                  input: data.usage.prompt_tokens,
                  output: data.usage.completion_tokens,
                  cached: data.usage.prompt_tokens_details?.cached_tokens,
                  reasoning: data.usage.completion_tokens_details?.reasoning_tokens,
                }
              : undefined,
          });
          return {
            content: choice?.content || '',
            ...(toolCalls?.length && { toolCalls }),
            // Include model from response (for observability tracking)
            ...(data.model && { model: data.model }),
            // Extract token usage from OpenAI-compatible response format
            ...(data.usage && {
              usage: {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
                totalTokens:
                  data.usage.total_tokens ??
                  data.usage.prompt_tokens + data.usage.completion_tokens,
                // Extended fields (model-specific)
                ...(data.usage.prompt_tokens_details?.cached_tokens && {
                  cachedTokens: data.usage.prompt_tokens_details.cached_tokens,
                }),
                ...(data.usage.completion_tokens_details?.reasoning_tokens && {
                  reasoningTokens: data.usage.completion_tokens_details.reasoning_tokens,
                }),
              },
            }),
          };
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('OpenRouter chat error', {
          model,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`OpenRouter error: ${errorMessage}`);
      }
    },
  };
}
