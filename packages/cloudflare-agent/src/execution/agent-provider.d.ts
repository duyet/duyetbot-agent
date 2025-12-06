/**
 * Agent Provider Interface
 *
 * Combines LLM provider capabilities with platform transport operations.
 * Defines the contract for unified agent execution across different platforms.
 */
import type { MessageRef, ParsedInput } from '../transport.js';
import type { LLMResponse, Message, OpenAITool } from '../types.js';
/**
 * Chat options for LLM requests
 *
 * Configures behavior of the LLM provider when generating responses
 */
export interface ChatOptions {
  /** LLM model identifier (e.g., 'claude-3-5-sonnet-20241022') */
  model?: string;
  /** Maximum number of tokens to generate (default: depends on model) */
  maxTokens?: number;
  /** Sampling temperature (0.0 to 2.0, default: 1.0) */
  temperature?: number;
  /** Tools available to the LLM for function calling */
  tools?: OpenAITool[];
  /** System prompt for this request (overrides default) */
  systemPrompt?: string;
  /** Enable web search (appends :online suffix to model) */
  webSearch?: boolean;
}
/**
 * Simplified execution context for AgentProvider operations
 *
 * Lightweight context containing user message information and platform metadata
 */
export interface ProviderExecutionContext<TMeta = Record<string, unknown>> {
  /** The message text from the user */
  text: string;
  /** User identifier */
  userId: string | number;
  /** Chat/conversation identifier */
  chatId: string | number;
  /** Username (platform-specific: Telegram @username, GitHub login) */
  username?: string | undefined;
  /** Original message reference (for replies) */
  messageRef?: string | number | undefined;
  /** Message this is replying to */
  replyTo?: string | number | undefined;
  /** Platform-specific metadata */
  metadata?: TMeta | undefined;
  /** Timestamp when context was created */
  createdAt?: number | undefined;
}
/**
 * Parsed input extracted from platform context
 *
 * Normalized representation of user message across all platforms
 */
export interface ParsedInputOptions {
  /** The message text from user */
  text: string;
  /** User identifier */
  userId: string | number;
  /** Chat/conversation identifier */
  chatId: string | number;
  /** Username (platform-specific: Telegram @username, GitHub login) */
  username?: string;
  /** Original message reference (for replies) */
  messageRef?: MessageRef;
  /** Message this is replying to */
  replyTo?: MessageRef;
  /** Additional platform-specific metadata */
  metadata?: Record<string, unknown>;
  /** Platform identifier */
  platform?: 'telegram' | 'github' | 'api' | string;
}
/**
 * Agent Provider Interface
 *
 * Unified interface combining LLM chat capabilities with platform-specific
 * message operations (send, edit, typing indicator, etc).
 *
 * Implementers provide a bridge between the agent logic and external services:
 * - LLM provider for generating responses
 * - Transport layer for platform-specific operations
 *
 * @example
 * ```typescript
 * const provider: AgentProvider = {
 *   // LLM operations
 *   chat: async (messages, options) => {
 *     return await llmClient.createMessage({
 *       model: options?.model || 'claude-3-5-sonnet-20241022',
 *       system: options?.systemPrompt,
 *       max_tokens: options?.maxTokens || 2048,
 *       tools: options?.tools,
 *       messages,
 *     });
 *   },
 *
 *   // Transport operations
 *   send: async (ctx, content) => {
 *     const result = await transport.send(ctx, content);
 *     return result;
 *   },
 *
 *   edit: async (ctx, ref, content) => {
 *     await transport.edit?.(ctx, ref, content);
 *   },
 *
 *   typing: async (ctx) => {
 *     await transport.typing?.(ctx);
 *   },
 *
 *   createContext: (input) => {
 *     return createProviderContext(input);
 *   },
 * };
 * ```
 */
export interface AgentProvider {
  /**
   * Send a message to the LLM and get a response
   *
   * @param messages - Conversation history as Message objects
   * @param options - Optional chat configuration (model, tokens, tools, etc)
   * @returns LLM response with content and optional tool calls
   * @throws Error if LLM request fails
   *
   * @example
   * ```typescript
   * const response = await provider.chat(
   *   [
   *     { role: 'user', content: 'What is 2+2?' },
   *     { role: 'assistant', content: '2+2 = 4' },
   *     { role: 'user', content: 'And 3+3?' },
   *   ],
   *   {
   *     model: 'claude-3-5-sonnet-20241022',
   *     maxTokens: 1024,
   *     temperature: 0.7,
   *   }
   * );
   * ```
   */
  chat(messages: Message[], options?: ChatOptions): Promise<LLMResponse>;
  /**
   * Send a message through the platform transport
   *
   * Sends a message to the user via the platform-specific transport layer.
   * Returns a reference that can be used for editing or deletion.
   *
   * @param ctx - Provider execution context with platform information
   * @param content - Message content to send
   * @returns Reference to the sent message for future edits
   * @throws Error if message send fails
   *
   * @example
   * ```typescript
   * const ref = await provider.send(ctx, 'Hello, world!');
   * // Later, edit the message
   * await provider.edit(ctx, ref, 'Hello, updated world!');
   * ```
   */
  send(ctx: ProviderExecutionContext, content: string): Promise<MessageRef>;
  /**
   * Edit a previously sent message
   *
   * Updates the content of an existing message on the platform.
   * Used for progressive response updates and streaming.
   *
   * @param ctx - Provider execution context with platform information
   * @param ref - Reference to the message to edit
   * @param content - New message content
   * @throws Error if message edit fails (e.g., message not found, permission denied)
   *
   * @example
   * ```typescript
   * let ref = await provider.send(ctx, 'Processing...');
   * // Stream or progressive update
   * await provider.edit(ctx, ref, 'Processing... (50% complete)');
   * await provider.edit(ctx, ref, 'Processing... (100% complete)');
   * ```
   */
  edit(ctx: ProviderExecutionContext, ref: MessageRef, content: string): Promise<void>;
  /**
   * Send typing indicator to show agent is processing
   *
   * Displays a typing or "is processing" indicator on the platform
   * to provide user feedback during long operations.
   *
   * @param ctx - Provider execution context with platform information
   * @throws Error if typing indicator fails (optional on some platforms)
   *
   * @example
   * ```typescript
   * await provider.typing(ctx);
   * // Perform long operation...
   * const response = await provider.chat(messages);
   * await provider.send(ctx, response.content);
   * ```
   */
  typing(ctx: ProviderExecutionContext): Promise<void>;
  /**
   * Create a ProviderExecutionContext from ParsedInput
   *
   * Converts normalized ParsedInput into a ProviderExecutionContext that
   * contains runtime information for the current execution.
   *
   * @param input - Parsed input containing user message and metadata
   * @returns ProviderExecutionContext ready for use in agent operations
   *
   * @example
   * ```typescript
   * const parsedInput: ParsedInput = {
   *   text: 'What is the weather?',
   *   userId: '12345',
   *   chatId: '67890',
   *   username: 'john_doe',
   * };
   * const ctx = provider.createContext(parsedInput);
   * // ctx is ready to use for send, edit, typing operations
   * ```
   */
  createContext(input: ParsedInput): ProviderExecutionContext;
}
/**
 * Optional extended provider with additional capabilities
 *
 * Providers can optionally implement these for enhanced functionality
 */
export interface ExtendedAgentProvider extends AgentProvider {
  /**
   * Delete a message
   *
   * @param ctx - Provider execution context
   * @param ref - Reference to the message to delete
   */
  delete?(ctx: ProviderExecutionContext, ref: MessageRef): Promise<void>;
  /**
   * Add a reaction to a message
   *
   * @param ctx - Provider execution context
   * @param ref - Reference to the message to react to
   * @param emoji - Emoji or reaction identifier
   */
  react?(ctx: ProviderExecutionContext, ref: MessageRef, emoji: string): Promise<void>;
  /**
   * Get message history from platform
   *
   * Retrieves historical messages from the chat for context
   *
   * @param ctx - Provider execution context
   * @param limit - Maximum number of messages to retrieve
   * @returns Array of messages in conversation history
   */
  getHistory?(ctx: ProviderExecutionContext, limit?: number): Promise<Message[]>;
}
/**
 * Create a ProviderExecutionContext from ParsedInput
 *
 * @param input - ParsedInput containing extracted message data
 * @returns ProviderExecutionContext
 */
export declare function createProviderContext(input: ParsedInput): ProviderExecutionContext;
//# sourceMappingURL=agent-provider.d.ts.map
