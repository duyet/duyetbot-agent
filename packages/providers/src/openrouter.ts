/**
 * OpenRouter Provider
 *
 * Unified API for multiple LLM providers through OpenRouter
 * Supports Claude, GPT, Gemini, Llama, and more
 */

import type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  ProviderConfig,
  QueryOptions,
  StopReason,
  TokenUsage,
} from '@duyetbot/types';
import { LLMProviderError } from '@duyetbot/types';

// Default configuration
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT = 60000; // 60 seconds
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * OpenRouter API response chunk (SSE format)
 */
interface OpenRouterChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string | null;
    index: number;
  }>;
  created: number;
  model: string;
  object: string;
}

/**
 * OpenRouter provider implementation
 */
export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  private config?: ProviderConfig;

  /**
   * Configure the provider
   */
  configure(config: ProviderConfig): void {
    this.config = {
      ...config,
      temperature: config.temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
      timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ProviderConfig | undefined {
    return this.config;
  }

  /**
   * Validate configuration
   */
  validateConfig(config: ProviderConfig): boolean {
    if (!config.apiKey || config.apiKey.length === 0) {
      return false;
    }

    if (!config.model || config.model.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Query OpenRouter with streaming responses
   */
  async *query(
    messages: LLMMessage[],
    options?: QueryOptions
  ): AsyncGenerator<LLMResponse, void, unknown> {
    if (!this.config) {
      throw new LLMProviderError(
        'Provider not configured. Call configure() first.',
        'openrouter',
        'NOT_CONFIGURED'
      );
    }

    if (messages.length === 0) {
      throw new LLMProviderError('Messages array cannot be empty', 'openrouter', 'INVALID_INPUT');
    }

    try {
      // Convert messages to OpenRouter format (OpenAI-compatible)
      const openrouterMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Merge options with config
      const model = options?.model || this.config.model;
      const temperature = options?.temperature ?? this.config.temperature ?? DEFAULT_TEMPERATURE;
      const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

      // Build request body
      const requestBody = {
        model,
        messages: openrouterMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        ...(options?.stopSequences && { stop: options.stopSequences }),
      };

      // Make streaming request
      const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://github.com/duyet/duyetbot-agent',
          'X-Title': 'duyetbot-agent',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout ?? DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new LLMProviderError(
          `OpenRouter API error: ${errorText}`,
          'openrouter',
          'API_ERROR',
          response.status
        );
      }

      if (!response.body) {
        throw new LLMProviderError('No response body from OpenRouter', 'openrouter', 'API_ERROR');
      }

      // Parse SSE stream
      let accumulatedContent = '';
      const inputTokens = 0;
      let outputTokens = 0;
      let stopReason: StopReason | undefined;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || line.trim() === 'data: [DONE]') {
              continue;
            }

            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as OpenRouterChunk;

                for (const choice of data.choices) {
                  if (choice.delta.content) {
                    const content = choice.delta.content;
                    accumulatedContent += content;
                    outputTokens += 1; // Approximate

                    const usage: TokenUsage = {
                      inputTokens,
                      outputTokens,
                      totalTokens: inputTokens + outputTokens,
                    };

                    yield {
                      content,
                      model,
                      provider: this.name,
                      usage,
                      metadata: {
                        accumulated: accumulatedContent,
                        streaming: true,
                      },
                    };
                  }

                  if (choice.finish_reason) {
                    stopReason = this.mapFinishReason(choice.finish_reason);
                  }
                }
              } catch (parseError) {
                // Skip malformed chunks
                console.warn('Failed to parse SSE chunk:', parseError);
              }
            }
          }
        }

        // Yield final response
        const usage: TokenUsage = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        };

        const finalResponse: LLMResponse = {
          content: '',
          model,
          provider: this.name,
          usage,
          metadata: {
            final: true,
            fullContent: accumulatedContent,
          },
        };

        if (stopReason) {
          finalResponse.stopReason = stopReason;
        }

        yield finalResponse;
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof LLMProviderError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMProviderError('Request timeout', 'openrouter', 'TIMEOUT', undefined, error);
      }

      throw new LLMProviderError(
        error instanceof Error ? error.message : 'Unknown error',
        'openrouter',
        'UNKNOWN_ERROR',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Map OpenRouter finish reason to our format
   */
  private mapFinishReason(reason: string): StopReason {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'length':
        return 'max_tokens';
      case 'content_filter':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}

/**
 * Create and export singleton instance
 */
export const openRouterProvider = new OpenRouterProvider();
