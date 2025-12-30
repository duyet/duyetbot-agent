/**
 * LLM Provider Factory
 *
 * Creates LLM provider instances for different backends:
 * - AnthropicProvider: Direct Anthropic API access
 * - OpenRouterProvider: Via OpenRouter API
 * - AIGatewayProvider: Via Cloudflare AI Gateway
 *
 * All providers implement a common interface for compatibility
 * with the Claude Agent SDK and custom agent implementations.
 */

import type { LLMMessage, LLMResponse, OpenAITool, ToolCall } from '@duyetbot/types';
import type { Config, LLMProvider as LLMProviderType } from './config.js';

/**
 * Common chat options across all providers
 */
export interface ChatOptions {
  /** Enable web search (provider-specific) */
  webSearch?: boolean;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Temperature for response randomness */
  temperature?: number;
}

/**
 * Base LLM provider interface
 *
 * All providers must implement this interface for compatibility.
 */
export interface LLMProvider {
  /** Provider name for logging/debugging */
  readonly name: string;

  /** Model identifier */
  readonly model: string;

  /**
   * Execute a chat request
   *
   * @param messages - Conversation history
   * @param tools - Optional function calling tools
   * @param options - Additional chat options
   * @returns LLM response with content and optional tool calls
   */
  chat(messages: LLMMessage[], tools?: OpenAITool[], options?: ChatOptions): Promise<LLMResponse>;

  /**
   * Stream a chat response
   *
   * @param messages - Conversation history
   * @param tools - Optional function calling tools
   * @param options - Additional chat options
   * @returns Async generator yielding partial responses
   */
  streamChat?(
    messages: LLMMessage[],
    tools?: OpenAITool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponse>;
}

/**
 * Anthropic API configuration
 */
export interface AnthropicConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use */
  model: string;
  /** API base URL (default: https://api.anthropic.com) */
  baseURL?: string;
  /** Maximum tokens (default: 4096) */
  maxTokens?: number;
  /** Request timeout (default: 60000ms) */
  timeout?: number;
}

/**
 * Anthropic Provider
 *
 * Direct access to Anthropic Claude API.
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.maxTokens = config.maxTokens ?? 4096;
    this.timeout = config.timeout ?? 60000;
  }

  async chat(messages: LLMMessage[], tools?: OpenAITool[], options?: ChatOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      // Convert LLMMessage format to Anthropic format
      const systemMessages = messages.filter((m) => m.role === 'system');
      const chatMessages = messages.filter((m) => m.role !== 'system');

      const requestBody = {
        model: this.model,
        messages: chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options?.maxTokens ?? this.maxTokens,
        ...(systemMessages.length > 0 && {
          system: systemMessages.map((m) => m.content).join('\n\n'),
        }),
        ...(tools && {
          tools: tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }),
      };

      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${error}`);
      }

      const data = await response.json();

      // Extract content blocks
      const textBlocks = data.content.filter((b: { type: string }) => b.type === 'text');
      const toolBlocks = data.content.filter((b: { type: string }) => b.type === 'tool_use');

      const content = textBlocks.map((b: { text: string }) => b.text).join('');

      const toolCalls: ToolCall[] = toolBlocks.map((b: { id: string; name: string; input: unknown }) => ({
        id: b.id,
        name: b.name,
        arguments: JSON.stringify(b.input),
      }));

      return {
        content,
        ...(toolCalls.length > 0 && { toolCalls }),
        model: data.model,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
          totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    tools?: OpenAITool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      const systemMessages = messages.filter((m) => m.role === 'system');
      const chatMessages = messages.filter((m) => m.role !== 'system');

      const requestBody = {
        model: this.model,
        messages: chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: options?.maxTokens ?? this.maxTokens,
        stream: true,
        ...(systemMessages.length > 0 && {
          system: systemMessages.map((m) => m.content).join('\n\n'),
        }),
        ...(tools && {
          tools: tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          })),
        }),
      };

      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              accumulatedContent += event.delta.text;
              yield { content: accumulatedContent };
            }

            if (event.type === 'message_stop') {
              yield {
                content: accumulatedContent,
                usage: {
                  inputTokens: event.message?.usage?.input_tokens ?? 0,
                  outputTokens: event.message?.usage?.output_tokens ?? 0,
                  totalTokens:
                    (event.message?.usage?.input_tokens ?? 0) +
                    (event.message?.usage?.output_tokens ?? 0),
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * OpenRouter configuration
 */
export interface OpenRouterConfig {
  /** OpenRouter API key or Cloudflare AI Gateway key */
  apiKey: string;
  /** Model to use */
  model: string;
  /** API base URL (default: https://openrouter.ai/api/v1) */
  baseURL?: string;
  /** Maximum tokens (default: 4096) */
  maxTokens?: number;
  /** Request timeout (default: 60000ms) */
  timeout?: number;
}

/**
 * OpenRouter Provider
 *
 * Access to OpenRouter API with support for multiple models.
 */
export class OpenRouterProvider implements LLMProvider {
  readonly name = 'openrouter';
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(config: OpenRouterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseURL = config.baseURL || 'https://openrouter.ai/api/v1';
    this.maxTokens = config.maxTokens ?? 4096;
    this.timeout = config.timeout ?? 60000;
  }

  async chat(messages: LLMMessage[], tools?: OpenAITool[], options?: ChatOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
            ...(m.name && { name: m.name }),
          })),
          max_tokens: options?.maxTokens ?? this.maxTokens,
          ...(tools && {
            tools,
            tool_choice: 'auto',
          }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      const toolCalls: ToolCall[] = choice.message?.tool_calls?.map((tc: {
        id: string;
        function: { name: string; arguments: string };
      }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })) ?? [];

      return {
        content: choice.message?.content ?? '',
        ...(toolCalls.length > 0 && { toolCalls }),
        model: data.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    tools?: OpenAITool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? this.maxTokens,
          stream: true,
          ...(tools && {
            tools,
            tool_choice: 'auto',
          }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta;

            if (delta?.content) {
              accumulatedContent += delta.content;
              yield { content: accumulatedContent };
            }

            if (event.usage) {
              yield {
                content: accumulatedContent,
                usage: {
                  inputTokens: event.usage.prompt_tokens ?? 0,
                  outputTokens: event.usage.completion_tokens ?? 0,
                  totalTokens:
                    (event.usage.prompt_tokens ?? 0) + (event.usage.completion_tokens ?? 0),
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Cloudflare AI Gateway configuration
 */
export interface AIGatewayConfig {
  /** Cloudflare AI Gateway API key */
  apiKey: string;
  /** Gateway name from Cloudflare dashboard */
  gatewayName: string;
  /** Model to use */
  model: string;
  /** API base URL (default: uses AI Gateway binding) */
  baseURL?: string;
  /** Maximum tokens (default: 4096) */
  maxTokens?: number;
  /** Request timeout (default: 60000ms) */
  timeout?: number;
}

/**
 * Cloudflare AI Gateway Provider
 *
 * Routes requests through Cloudflare AI Gateway for caching,
 * rate limiting, and observability.
 */
export class AIGatewayProvider implements LLMProvider {
  readonly name = 'ai-gateway';
  readonly model: string;
  private readonly apiKey: string;
  private readonly gatewayName: string;
  private readonly baseURL: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(config: AIGatewayConfig) {
    this.apiKey = config.apiKey;
    this.gatewayName = config.gatewayName;
    this.model = config.model;
    this.baseURL = config.baseURL || 'https://gateway.ai.cloudflare.net/v1';
    this.maxTokens = config.maxTokens ?? 4096;
    this.timeout = config.timeout ?? 60000;
  }

  async chat(messages: LLMMessage[], tools?: OpenAITool[], options?: ChatOptions): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      const url = `${this.baseURL}/${this.gatewayName}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
            ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
            ...(m.name && { name: m.name }),
          })),
          max_tokens: options?.maxTokens ?? this.maxTokens,
          usage: { include: true },
          ...(tools && {
            tools,
            tool_choice: 'auto',
          }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI Gateway error ${response.status}: ${error}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      const toolCalls: ToolCall[] = choice.message?.tool_calls?.map((tc: {
        id: string;
        function: { name: string; arguments: string };
      }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })) ?? [];

      return {
        content: choice.message?.content ?? '',
        ...(toolCalls.length > 0 && { toolCalls }),
        model: data.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
          ...(data.usage?.cost && { actualCostUsd: data.usage.cost }),
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    tools?: OpenAITool[],
    options?: ChatOptions
  ): AsyncIterable<LLMResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? this.timeout);

    try {
      const url = `${this.baseURL}/${this.gatewayName}/chat/completions`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'cf-aig-authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: options?.maxTokens ?? this.maxTokens,
          stream: true,
          usage: { include: true },
          ...(tools && {
            tools,
            tool_choice: 'auto',
          }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`AI Gateway error ${response.status}: ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);
            const delta = event.choices?.[0]?.delta;

            if (delta?.content) {
              accumulatedContent += delta.content;
              yield { content: accumulatedContent };
            }

            if (event.usage) {
              yield {
                content: accumulatedContent,
                usage: {
                  inputTokens: event.usage.prompt_tokens ?? 0,
                  outputTokens: event.usage.completion_tokens ?? 0,
                  totalTokens:
                    (event.usage.prompt_tokens ?? 0) + (event.usage.completion_tokens ?? 0),
                },
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Provider configuration type
 */
export type ProviderConfig = AnthropicConfig | OpenRouterConfig | AIGatewayConfig;

/**
 * Create an LLM provider based on configuration
 *
 * Factory function that creates the appropriate provider instance
 * based on the LLM_PROVIDER setting.
 *
 * @param config - Application configuration
 * @returns LLM provider instance
 */
export function createLLMProvider(config: Pick<Config, 'LLM_PROVIDER' | 'MODEL' | 'AI_GATEWAY_API_KEY' | 'AI_GATEWAY_NAME' | 'ANTHROPIC_API_KEY'>): LLMProvider {
  const providerType = config.LLM_PROVIDER;

  switch (providerType) {
    case 'claude': {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required for claude provider');
      }
      return new AnthropicProvider({
        apiKey: config.ANTHROPIC_API_KEY,
        model: config.MODEL,
      });
    }

    case 'openrouter': {
      if (!config.AI_GATEWAY_API_KEY) {
        throw new Error('AI_GATEWAY_API_KEY is required for openrouter provider');
      }
      return new OpenRouterProvider({
        apiKey: config.AI_GATEWAY_API_KEY,
        model: config.MODEL,
      });
    }

    case 'ai-gateway': {
      if (!config.AI_GATEWAY_API_KEY) {
        throw new Error('AI_GATEWAY_API_KEY is required for ai-gateway provider');
      }
      if (!config.AI_GATEWAY_NAME) {
        throw new Error('AI_GATEWAY_NAME is required for ai-gateway provider');
      }
      return new AIGatewayProvider({
        apiKey: config.AI_GATEWAY_API_KEY,
        gatewayName: config.AI_GATEWAY_NAME,
        model: config.MODEL,
      });
    }

    default:
      throw new Error(`Unknown LLM provider: ${providerType}`);
  }
}
