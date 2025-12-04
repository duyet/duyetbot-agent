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

import { logger } from '@duyetbot/hono-middleware';
import { Agent } from 'agents';
import type {
  AgentProvider,
  ExecutionContext,
  ChatOptions as ProviderChatOptions,
} from '../execution/index.js';
import {
  createProviderContext as createProviderContextFn,
  createSpanId as createSpanIdFn,
  recordAgentSpan as recordAgentSpanFn,
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
export abstract class BaseAgent<TEnv extends BaseEnv, TState extends BaseState> extends Agent<
  TEnv,
  TState
> {
  /**
   * LLM provider for chat and transport operations
   * Set via setProvider() before agent execution
   */
  protected provider!: AgentProvider;

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
  setProvider(provider: AgentProvider): void {
    this.provider = provider;
    logger.debug('[BaseAgent] Provider set', {
      agent: this.constructor.name,
    });
  }

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
  protected async respond(ctx: ExecutionContext, content: string): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not set. Call setProvider() before responding.');
    }

    const providerCtx = createProviderContextFn({
      text: ctx.query,
      userId: ctx.userId,
      chatId: ctx.chatId,
      ...(ctx.username && { username: ctx.username }),
      messageRef: ctx.userMessageId,
    });

    try {
      if (ctx.responseMessageId) {
        // Edit existing message
        await this.provider.edit(providerCtx, ctx.responseMessageId, content);
        logger.debug('[BaseAgent] Message edited', {
          spanId: ctx.spanId,
          messageRef: ctx.responseMessageId,
          contentLength: content.length,
        });
      } else {
        // Send new message and store reference
        const messageRef = await this.provider.send(providerCtx, content);
        ctx.responseMessageId = messageRef;
        logger.debug('[BaseAgent] Message sent', {
          spanId: ctx.spanId,
          messageRef,
          contentLength: content.length,
        });
      }
    } catch (error) {
      logger.error('[BaseAgent] Failed to respond', {
        spanId: ctx.spanId,
        error: error instanceof Error ? error.message : String(error),
        hasExistingMessage: !!ctx.responseMessageId,
      });
      throw error;
    }
  }

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
  protected async updateThinking(ctx: ExecutionContext, status: string): Promise<void> {
    if (!ctx.responseMessageId) {
      logger.warn('[BaseAgent] updateThinking called without responseMessageId', {
        spanId: ctx.spanId,
      });
      return;
    }

    const content = `🤔 ${status}...`;

    try {
      const providerCtx = createProviderContextFn({
        text: ctx.query,
        userId: ctx.userId,
        chatId: ctx.chatId,
        ...(ctx.username && { username: ctx.username }),
        messageRef: ctx.userMessageId,
      });

      await this.provider.edit(providerCtx, ctx.responseMessageId, content);
      logger.debug('[BaseAgent] Thinking status updated', {
        spanId: ctx.spanId,
        status,
      });
    } catch (error) {
      logger.warn('[BaseAgent] Failed to update thinking status', {
        spanId: ctx.spanId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - thinking indicator is not critical
    }
  }

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
  protected async sendTyping(ctx: ExecutionContext): Promise<void> {
    if (!this.provider) {
      logger.warn('[BaseAgent] Provider not set for sendTyping', {
        spanId: ctx.spanId,
      });
      return;
    }

    try {
      const providerCtx = createProviderContextFn({
        text: ctx.query,
        userId: ctx.userId,
        chatId: ctx.chatId,
        ...(ctx.username && { username: ctx.username }),
        messageRef: ctx.userMessageId,
      });

      await this.provider.typing(providerCtx);
      logger.debug('[BaseAgent] Typing indicator sent', {
        spanId: ctx.spanId,
      });
    } catch (error) {
      logger.warn('[BaseAgent] Failed to send typing indicator', {
        spanId: ctx.spanId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - typing indicator is optional
    }
  }

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
  protected async chat(
    ctx: ExecutionContext,
    messages: Message[],
    options?: ProviderChatOptions
  ): Promise<LLMResponse> {
    if (!this.provider) {
      throw new Error('Provider not set. Call setProvider() before calling chat().');
    }

    const startTime = Date.now();

    try {
      const response = await this.provider.chat(messages, options);

      const durationMs = Date.now() - startTime;
      ctx.debug.llmMs = durationMs;

      logger.debug('[BaseAgent] LLM chat completed', {
        spanId: ctx.spanId,
        durationMs,
        contentLength: response.content.length,
        hasToolCalls: !!response.toolCalls?.length,
        tokensUsed: response.usage?.totalTokens,
      });

      return response;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      ctx.debug.llmMs = durationMs;

      logger.error('[BaseAgent] LLM chat failed', {
        spanId: ctx.spanId,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

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
  protected hasTimeRemaining(ctx: ExecutionContext, bufferMs: number = 5000): boolean {
    const now = Date.now();
    const timeRemaining = ctx.deadline - now;
    const hasTime = timeRemaining > bufferMs;

    if (!hasTime) {
      logger.warn('[BaseAgent] Approaching deadline', {
        spanId: ctx.spanId,
        timeRemaining,
        bufferMs,
      });
    }

    return hasTime;
  }

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
  protected createChildContext(ctx: ExecutionContext): ExecutionContext {
    const newSpanId = createSpanIdFn();

    return {
      ...ctx,
      spanId: newSpanId,
      parentSpanId: ctx.spanId,
    };
  }

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
  protected recordExecution(ctx: ExecutionContext, agentName: string, durationMs: number): void {
    recordAgentSpanFn(ctx.debug, agentName, ctx.spanId, durationMs, ctx.parentSpanId);

    logger.debug('[BaseAgent] Execution recorded', {
      spanId: ctx.spanId,
      agentName,
      durationMs,
      parentSpanId: ctx.parentSpanId,
    });
  }
}
