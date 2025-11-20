/**
 * Claude Provider
 *
 * Anthropic Claude LLM provider implementation
 */

import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Claude provider implementation
 */
export class ClaudeProvider implements LLMProvider {
  name = 'claude';
  private config?: ProviderConfig;
  private client?: Anthropic;

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

    // Create Anthropic client with optional baseURL override
    const clientOptions: { apiKey: string; timeout?: number; baseURL?: string } = {
      apiKey: this.config.apiKey,
    };

    // Add timeout if provided
    if (this.config.timeout !== undefined) {
      clientOptions.timeout = this.config.timeout;
    }

    // Add baseURL if provided (for Z.AI or other Claude-compatible APIs)
    if (this.config.baseURL) {
      clientOptions.baseURL = this.config.baseURL;
    }

    this.client = new Anthropic(clientOptions);
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
   * Query Claude with streaming responses
   */
  async *query(
    messages: LLMMessage[],
    options?: QueryOptions
  ): AsyncGenerator<LLMResponse, void, unknown> {
    if (!this.client || !this.config) {
      throw new LLMProviderError(
        'Provider not configured. Call configure() first.',
        'claude',
        'NOT_CONFIGURED'
      );
    }

    if (messages.length === 0) {
      throw new LLMProviderError('Messages array cannot be empty', 'claude', 'INVALID_INPUT');
    }

    try {
      // Separate system messages from conversation messages
      const systemMessages = messages.filter((m) => m.role === 'system');
      const conversationMessages = messages.filter((m) => m.role !== 'system');

      // Build system prompt from system messages
      const systemPrompt =
        systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n\n') : undefined;

      // Convert to Anthropic message format
      const anthropicMessages = conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

      // Merge options with config
      const model = options?.model || this.config.model;
      const temperature = options?.temperature ?? this.config.temperature ?? DEFAULT_TEMPERATURE;
      const maxTokens = options?.maxTokens ?? this.config.maxTokens ?? DEFAULT_MAX_TOKENS;

      // Create streaming request
      const stream = await this.client.messages.stream({
        model,
        messages: anthropicMessages,
        max_tokens: maxTokens,
        temperature,
        ...(systemPrompt && { system: systemPrompt }),
        ...(options?.stopSequences && { stop_sequences: options.stopSequences }),
      });

      let accumulatedContent = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: StopReason | undefined;

      // Stream response chunks
      for await (const event of stream) {
        if (event.type === 'message_start') {
          // Get input token count
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            const text = event.delta.text;
            accumulatedContent += text;
            outputTokens += 1; // Approximate

            const usage: TokenUsage = {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
            };

            yield {
              content: text,
              model,
              provider: this.name,
              usage,
              metadata: {
                accumulated: accumulatedContent,
                streaming: true,
              },
            };
          }
        } else if (event.type === 'message_delta') {
          // Get final token count and stop reason
          outputTokens = event.usage.output_tokens;
          stopReason = this.mapStopReason(event.delta.stop_reason);
        } else if (event.type === 'message_stop') {
          // Final message with complete info
          const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          };

          const response: LLMResponse = {
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
            response.stopReason = stopReason;
          }

          yield response;
        }
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new LLMProviderError(error.message, 'claude', 'API_ERROR', error.status, error);
      }

      throw new LLMProviderError(
        error instanceof Error ? error.message : 'Unknown error',
        'claude',
        'UNKNOWN_ERROR',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Map Anthropic stop reason to our format
   */
  private mapStopReason(reason: string | null | undefined): StopReason {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}

/**
 * Create and export singleton instance
 */
export const claudeProvider = new ClaudeProvider();
