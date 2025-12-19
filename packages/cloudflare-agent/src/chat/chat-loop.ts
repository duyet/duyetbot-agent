/**
 * Chat Loop - Core business logic for LLM chat with tool iterations
 *
 * Orchestrates:
 * - LLM API calls with tool support
 * - Tool execution iterations (up to maxToolIterations)
 * - Token usage tracking
 * - Progress event emission
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LLMProvider, Message, OpenAITool } from '../types.js';
import type { StepProgressTracker } from '../workflow/step-tracker.js';
import type { QuotedContext } from '../workflow/types.js';
import {
  buildInitialMessages,
  buildToolIterationMessages,
  type ContextBuilderConfig,
} from './context-builder.js';
import { parse } from './response-handler.js';
import { ToolExecutor, type ToolExecutorConfig } from './tool-executor.js';

/**
 * Configuration for ChatLoop
 */
export interface ChatLoopConfig {
  /** LLM provider */
  llmProvider: LLMProvider;
  /** System prompt */
  systemPrompt: string;
  /** Maximum tool call iterations (default: 5) */
  maxToolIterations: number;
  /** Tools available to LLM */
  tools: OpenAITool[];
  /** Tool executor configuration */
  toolExecutor: ToolExecutorConfig;
}

/**
 * Result from chat execution
 */
export interface ChatResult {
  /** Final assistant content */
  content: string;
  /** New messages to add to history (user + assistant) */
  newMessages: Message[];
  /** Aggregated token usage */
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    cached?: number;
  };
  /** Model used */
  model?: string;
}

/**
 * ChatLoop class - Execute chat with tool iterations
 */
export class ChatLoop {
  private toolExecutor: ToolExecutor;

  constructor(private config: ChatLoopConfig) {
    this.toolExecutor = new ToolExecutor(config.toolExecutor);
  }

  /**
   * Execute chat loop with tool iterations
   * @param userMessage - User's message
   * @param conversationHistory - Previous conversation messages
   * @param stepTracker - Optional progress tracker
   * @param quotedContext - Optional quoted message context
   * @returns Chat result
   */
  async execute(
    userMessage: string,
    conversationHistory: Message[],
    stepTracker?: StepProgressTracker,
    quotedContext?: QuotedContext
  ): Promise<ChatResult> {
    // Emit initial thinking step (placeholder until LLM responds)
    await stepTracker?.addStep({ type: 'thinking', iteration: 0 });

    const hasTools = this.config.tools.length > 0;

    // Build context configuration
    const contextConfig: ContextBuilderConfig = {
      systemPrompt: this.config.systemPrompt,
      messages: conversationHistory,
    };

    // Build initial messages with embedded history
    const llmMessages = buildInitialMessages(contextConfig, userMessage, quotedContext);

    // Call LLM with tools if available
    let response: any;
    let responseContent = '';
    let toolCalls: any[] = [];
    let usage: any = undefined;
    let responseModel: string | undefined = undefined;

    if (this.config.llmProvider.streamChat) {
      const stream = this.config.llmProvider.streamChat(
        llmMessages,
        hasTools ? this.config.tools : undefined
      );
      let lastProgressUpdate = 0;
      const PROGRESS_MIN_INTERVAL = 1000;

      for await (const chunk of stream) {
        responseContent = chunk.content || responseContent;
        if (chunk.toolCalls) toolCalls = chunk.toolCalls;
        if (chunk.usage) usage = chunk.usage;
        if (chunk.model) responseModel = chunk.model;

        // Throttled update to step tracker
        if (Date.now() - lastProgressUpdate > PROGRESS_MIN_INTERVAL) {
          if (responseContent) {
            await stepTracker?.addStep({
              type: 'thinking',
              iteration: 0,
              thinking: responseContent,
            });
          }
          lastProgressUpdate = Date.now();
        }
      }

      // Final update after stream ends
      if (responseContent) {
        await stepTracker?.addStep({
          type: 'thinking',
          iteration: 0,
          thinking: responseContent,
        });
      }
    } else {
      response = await this.config.llmProvider.chat(
        llmMessages,
        hasTools ? this.config.tools : undefined
      );
      const parsed = parse(response);
      responseContent = parsed.content;
      toolCalls = parsed.toolCalls || [];
      usage = parsed.usage;
      responseModel = parsed.model;

      if (responseContent) {
        await stepTracker?.addStep({
          type: 'thinking',
          iteration: 0,
          thinking: responseContent,
        });
      }
    }

    // Track token usage
    const tokenUsage = {
      input: usage?.inputTokens || 0,
      output: usage?.outputTokens || 0,
      total: usage?.totalTokens || (usage?.inputTokens || 0) + (usage?.outputTokens || 0),
      cached: usage?.cachedTokens,
    };

    // Update step tracker
    if (usage) {
      stepTracker?.addTokenUsage(usage);
    }
    if (responseModel) {
      stepTracker?.setModel(responseModel);
    }

    // Handle tool calls (up to maxToolIterations)
    let iterations = 0;

    // Track tool conversation for iterations (separate from embedded history)
    const toolConversation: Message[] = [];

    while (toolCalls.length > 0 && iterations < this.config.maxToolIterations) {
      iterations++;
      logger.info(
        `[ChatLoop] Processing ${toolCalls.length} tool calls in parallel (iteration ${iterations})`
      );

      // Add assistant message with tool calls to tool conversation
      toolConversation.push({
        role: 'assistant' as const,
        content: responseContent || '',
      });

      // Execute tools in parallel
      await Promise.all(
        toolCalls.map(async (toolCall) => {
          // Parse args for step tracking
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolCall.arguments);
          } catch {
            // Invalid JSON args, continue with empty object
          }

          // Emit tool start step with args
          await stepTracker?.addStep({
            type: 'tool_start',
            toolName: toolCall.name,
            args: toolArgs,
            iteration: iterations,
          });

          // Execute tool
          const executionResult = await this.toolExecutor.execute(toolCall);

          if (executionResult.error) {
            // Emit tool error step
            await stepTracker?.addStep({
              type: 'tool_error',
              toolName: toolCall.name,
              args: toolArgs,
              error: executionResult.error,
              iteration: iterations,
            });

            // Add error to conversation
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Error for ${toolCall.name}]: ${executionResult.error}`,
              toolCallId: toolCall.id,
            });
          } else {
            // Emit tool complete step
            await stepTracker?.addStep({
              type: 'tool_complete',
              toolName: toolCall.name,
              args: toolArgs,
              result: executionResult.result,
              iteration: iterations,
            });

            // Add result to conversation
            toolConversation.push({
              role: 'user' as const,
              content: `[Tool Result for ${toolCall.name}]: ${executionResult.result}`,
              toolCallId: toolCall.id,
            });
          }
        })
      );

      // Rebuild messages with embedded history + tool conversation
      const toolMessages = buildToolIterationMessages(llmMessages, toolConversation);

      // Emit LLM iteration step
      await stepTracker?.addStep({
        type: 'llm_iteration',
        iteration: iterations,
        maxIterations: this.config.maxToolIterations,
      });

      // Continue conversation with tool results
      let nextUsage: any = undefined;
      let nextModel: string | undefined = undefined;

      if (this.config.llmProvider.streamChat) {
        const stream = this.config.llmProvider.streamChat(
          toolMessages,
          hasTools ? this.config.tools : undefined
        );
        let lastProgressUpdate = 0;
        const PROGRESS_MIN_INTERVAL = 1000;
        responseContent = ''; // Reset for next iteration
        toolCalls = [];

        for await (const chunk of stream) {
          responseContent = chunk.content || responseContent;
          if (chunk.toolCalls) toolCalls = chunk.toolCalls;
          if (chunk.usage) nextUsage = chunk.usage;
          if (chunk.model) nextModel = chunk.model;

          // Throttled update to step tracker
          if (Date.now() - lastProgressUpdate > PROGRESS_MIN_INTERVAL) {
            if (responseContent) {
              await stepTracker?.addStep({
                type: 'thinking',
                iteration: iterations,
                thinking: responseContent,
              });
            }
            lastProgressUpdate = Date.now();
          }
        }

        // Final update
        if (responseContent) {
          await stepTracker?.addStep({
            type: 'thinking',
            iteration: iterations,
            thinking: responseContent,
          });
        }
      } else {
        const response = await this.config.llmProvider.chat(
          toolMessages,
          hasTools ? this.config.tools : undefined
        );
        const parsed = parse(response);
        responseContent = parsed.content;
        toolCalls = parsed.toolCalls || [];
        nextUsage = parsed.usage;
        nextModel = parsed.model;

        if (responseContent) {
          await stepTracker?.addStep({
            type: 'thinking',
            iteration: iterations,
            thinking: responseContent,
          });
        }
      }

      // Track token usage from follow-up calls
      if (nextUsage) {
        tokenUsage.input += nextUsage.inputTokens || 0;
        tokenUsage.output += nextUsage.outputTokens || 0;
        tokenUsage.total += nextUsage.totalTokens || (nextUsage.inputTokens || 0) + (nextUsage.outputTokens || 0);
        if (typeof nextUsage.cachedTokens === 'number') {
          tokenUsage.cached = (tokenUsage.cached || 0) + nextUsage.cachedTokens;
        }

        stepTracker?.addTokenUsage(nextUsage);
      }
      if (nextModel) {
        stepTracker?.setModel(nextModel);
        responseModel = nextModel;
      }
    }

    // Emit preparing step before finalizing
    await stepTracker?.addStep({ type: 'preparing', iteration: 0 });

    const assistantContent = responseContent;

    // Build new messages for history
    const newMessages: Message[] = [
      { role: 'user' as const, content: userMessage },
      { role: 'assistant' as const, content: assistantContent },
    ];

    // Build result with proper optional property handling
    const result: ChatResult = {
      content: assistantContent,
      newMessages,
      tokenUsage: {
        input: tokenUsage.input,
        output: tokenUsage.output,
        total: tokenUsage.total,
      },
    };

    // Only add cached if it's a number (exactOptionalPropertyTypes compliance)
    if (typeof tokenUsage.cached === 'number') {
      result.tokenUsage.cached = tokenUsage.cached;
    }

    // Only add model if defined (exactOptionalPropertyTypes compliance)
    if (responseModel) {
      result.model = responseModel;
    }

    return result;
  }
}
