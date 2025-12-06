/**
 * BaseAgent Class
 *
 * Abstract base class for all Durable Object agents.
 * Provides common functionality for agent initialization, provider management,
 * message handling, LLM communication, and debug tracking.
 *
 * All DO agents should extend this class and implement their domain-specific logic.
 *
 * @example
 * ```typescript
 * class MyAgent extends BaseAgent<MyEnv, MyState> {
 *   async fetch(request: Request): Promise<Response> {
 *     const ctx = createExecutionContext(...);
 *     await this.respond(ctx, 'Hello, World!');
 *     return new Response('OK');
 *   }
 * }
 * ```
 */
import { Agent } from 'agents';
import type {
  AgentProvider,
  ExecutionContext,
  ChatOptions as ProviderChatOptions,
} from '../execution/index.js';
import type { LLMResponse, Message } from '../types.js';
import type { BaseEnv, BaseState } from './base-types.js';
/**
 * BaseAgent abstract class
 *
 * Provides core functionality for all Durable Object agents including:
 * - Provider management for LLM and transport operations
 * - Message sending and editing via transport layer
 * - LLM chat execution with timing and token tracking
 * - Execution context management with tracing
 * - Debug information accumulation
 *
 * @typeParam TEnv - Environment bindings type (extends BaseEnv)
 * @typeParam TState - Agent state type (extends BaseState)
 */
export declare abstract class BaseAgent<
  TEnv extends BaseEnv,
  TState extends BaseState,
> extends Agent<TEnv, TState> {
  /**
   * LLM provider for chat and transport operations
   * Set via setProvider() before agent execution
   */
  protected provider: AgentProvider;
  /**
   * Set the provider for this agent
   *
   * The provider combines LLM capabilities with platform-specific message operations.
   * This should be called during agent initialization.
   *
   * @param provider - AgentProvider instance for LLM and transport operations
   *
   * @example
   * ```typescript
   * const agent = this.env.AGENT_NAMESPACE.get(id);
   * agent.setProvider(createProvider(this.env));
   * ```
   */
  setProvider(provider: AgentProvider): void;
  /**
   * Send a message to the user via the platform transport
   *
   * If responseMessageId exists, edits the message; otherwise sends a new message
   * and stores the reference.
   *
   * @param ctx - ExecutionContext containing user and message information
   * @param content - Message content to send
   * @throws Error if provider is not set or send/edit fails
   *
   * @example
   * ```typescript
   * await this.respond(ctx, 'Processing your request...');
   * // Later, update the same message:
   * await this.respond(ctx, 'Done! Here is the result...');
   * ```
   */
  protected respond(ctx: ExecutionContext, content: string): Promise<void>;
  /**
   * Update thinking status message
   *
   * Edits the response message with a thinking indicator.
   * Useful for long operations to show the user that work is in progress.
   *
   * @param ctx - ExecutionContext containing message reference
   * @param status - Current status message (e.g., "Analyzing data")
   * @throws Error if responseMessageId is not set or edit fails
   *
   * @example
   * ```typescript
   * await this.updateThinking(ctx, 'Fetching data from API');
   * const data = await fetchData();
   * await this.updateThinking(ctx, 'Processing results');
   * ```
   */
  protected updateThinking(ctx: ExecutionContext, status: string): Promise<void>;
  /**
   * Send typing indicator to show the agent is processing
   *
   * Displays a typing indicator on the platform to provide user feedback
   * during long operations.
   *
   * @param ctx - ExecutionContext containing platform information
   * @throws Error if provider.typing() fails (may be unsupported on some platforms)
   *
   * @example
   * ```typescript
   * await this.sendTyping(ctx);
   * const result = await expensiveOperation();
   * await this.respond(ctx, result);
   * ```
   */
  protected sendTyping(ctx: ExecutionContext): Promise<void>;
  /**
   * Send a chat message to the LLM
   *
   * Calls the provider's LLM API and tracks timing information in the debug context.
   * Automatically measures execution time and records it in ctx.debug.llmMs.
   *
   * @param ctx - ExecutionContext for tracing and debug accumulation
   * @param messages - Conversation messages to send to the LLM
   * @param options - Optional chat configuration (model, tokens, tools, etc)
   * @returns LLMResponse containing content, optional tool calls, and token usage
   * @throws Error if provider.chat() fails
   *
   * @example
   * ```typescript
   * const response = await this.chat(ctx, [
   *   { role: 'user', content: 'What is 2+2?' }
   * ], {
   *   maxTokens: 500,
   *   temperature: 0.7,
   * });
   *
   * console.log(response.content); // "2+2 equals 4"
   * console.log(ctx.debug.llmMs);  // 234 (ms spent in LLM)
   * ```
   */
  protected chat(
    ctx: ExecutionContext,
    messages: Message[],
    options?: ProviderChatOptions
  ): Promise<LLMResponse>;
  /**
   * Check if execution has time remaining before deadline
   *
   * Determines whether there is sufficient time remaining before the execution
   * deadline (typically the Durable Object request timeout).
   *
   * Useful for controlling long-running operations that might timeout.
   *
   * @param ctx - ExecutionContext containing deadline
   * @param bufferMs - Safety buffer in milliseconds (default: 5000)
   * @returns true if current time + bufferMs < deadline, false otherwise
   *
   * @example
   * ```typescript
   * while (hasMoreItems && this.hasTimeRemaining(ctx, 10000)) {
   *   await processItem();
   * }
   * // Stop processing if time is running out
   * ```
   */
  protected hasTimeRemaining(ctx: ExecutionContext, bufferMs?: number): boolean;
  /**
   * Create a child execution context for delegated operations
   *
   * Creates a new ExecutionContext for sub-operations while maintaining
   * tracing connection to the parent operation through spanId relationships.
   *
   * Use this when delegating to other agents or workers.
   *
   * @param ctx - Parent ExecutionContext
   * @returns New ExecutionContext with new spanId and parent linkage
   *
   * @example
   * ```typescript
   * const parentCtx = ctx;
   * const childCtx = this.createChildContext(parentCtx);
   * // childCtx.parentSpanId === parentCtx.spanId
   * // childCtx.traceId === parentCtx.traceId (same trace)
   * await subAgent.execute(childCtx);
   * ```
   */
  protected createChildContext(ctx: ExecutionContext): ExecutionContext;
  /**
   * Record an agent execution span in debug information
   *
   * Adds an entry to the debug.agentChain tracking which agents executed
   * and how long they took.
   *
   * @param ctx - ExecutionContext with debug accumulator
   * @param agentName - Name of the agent that executed (e.g., 'simple-agent')
   * @param durationMs - Execution duration in milliseconds
   *
   * @example
   * ```typescript
   * const startTime = Date.now();
   * try {
   *   await executeAgent();
   * } finally {
   *   this.recordExecution(ctx, 'my-agent', Date.now() - startTime);
   * }
   * ```
   */
  protected recordExecution(ctx: ExecutionContext, agentName: string, durationMs: number): void;
}
//# sourceMappingURL=base-agent.d.ts.map
