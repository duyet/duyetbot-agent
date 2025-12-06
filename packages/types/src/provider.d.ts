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
 * OpenRouter web search plugin configuration
 *
 * Enables native web search through OpenRouter's plugin system.
 * When enabled, the model can access real-time web information.
 *
 * @see https://openrouter.ai/docs/features/web-search
 */
export interface WebSearchPlugin {
  /** Plugin identifier - must be 'web' */
  id: 'web';
  /** Search engine: 'native' uses model provider's built-in search, 'exa' uses Exa API */
  engine?: 'native' | 'exa';
  /** Maximum number of search results (default: 5, max: 10) */
  max_results?: number;
  /** Custom prompt to attach search results (optional) */
  search_prompt?: string;
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
  /** OpenRouter plugins (e.g., web search) */
  plugins?: WebSearchPlugin[];
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
export declare class LLMProviderError extends Error {
  provider: string;
  code?: string;
  statusCode?: number;
  cause?: Error;
  constructor(message: string, provider: string, code?: string, statusCode?: number, cause?: Error);
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
export declare function parseProviderFormat(format: string): ProviderFormat;
/**
 * Format provider and model into standard format
 */
export declare function formatProvider(provider: string, model: string): string;
//# sourceMappingURL=provider.d.ts.map
