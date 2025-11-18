/**
 * LLM Provider Types and Interfaces
 *
 * Defines the unified interface for all LLM providers (Claude, OpenAI, OpenRouter)
 */

/**
 * Message role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Message in a conversation
 */
export interface LLMMessage {
  role: MessageRole;
  content: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Stop reason for LLM response
 */
export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'content_filter' | 'error';

/**
 * Response from an LLM
 */
export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: TokenUsage;
  stopReason?: StopReason;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for an LLM provider
 */
export interface ProviderConfig {
  provider: string;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  baseURL?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for querying an LLM
 */
export interface QueryOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Unified interface for all LLM providers
 */
export interface LLMProvider {
  /**
   * Name of the provider
   */
  name: string;

  /**
   * Query the LLM with messages
   * Returns an async generator for streaming responses
   */
  query(messages: LLMMessage[], options?: QueryOptions): AsyncGenerator<LLMResponse, void, unknown>;

  /**
   * Configure the provider
   */
  configure(config: ProviderConfig): void;

  /**
   * Get current configuration
   */
  getConfig?(): ProviderConfig | undefined;

  /**
   * Validate configuration
   */
  validateConfig?(config: ProviderConfig): boolean;
}

/**
 * Error thrown by LLM providers
 */
export class LLMProviderError extends Error {
  public provider: string;
  public code?: string;
  public statusCode?: number;
  public override cause?: Error;

  constructor(
    message: string,
    provider: string,
    code?: string,
    statusCode?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'LLMProviderError';
    this.provider = provider;
    if (code !== undefined) {
      this.code = code;
    }
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Provider format parser result
 * Format: <provider>:<model_id>
 * Examples:
 * - claude:claude-3-5-sonnet-20241022
 * - openai:gpt-4-turbo
 * - openrouter:anthropic/claude-3.5-sonnet
 */
export interface ProviderFormat {
  provider: string;
  model: string;
  original: string;
}

/**
 * Parse provider format string
 */
export function parseProviderFormat(format: string): ProviderFormat {
  const parts = format.split(':');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid provider format: "${format}". Expected format: <provider>:<model_id>`);
  }

  return {
    provider: parts[0].trim(),
    model: parts[1].trim(),
    original: format,
  };
}

/**
 * Format provider and model into standard format
 */
export function formatProvider(provider: string, model: string): string {
  return `${provider}:${model}`;
}
