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
import { getToolCalls, hasToolCalls, parse } from './response-handler.js';
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
    let response = await this.config.llmProvider.chat(
      llmMessages,
      hasTools ? this.config.tools : undefined
    );

    // Parse response
    let parsedResponse = parse(response);

    // Track token usage
    const tokenUsage = {
      input: parsedResponse.usage?.inputTokens || 0,
      output: parsedResponse.usage?.outputTokens || 0,
      total: parsedResponse.usage?.totalTokens || 0,
      cached: parsedResponse.usage?.cachedTokens,
    };

    // Update step tracker
    if (parsedResponse.usage) {
      stepTracker?.addTokenUsage(parsedResponse.usage);
    }
    if (parsedResponse.model) {
      stepTracker?.setModel(parsedResponse.model);
    }

    // Emit thinking with LLM's response content
    // This shows what the LLM is "thinking" before/during tool execution
    if (parsedResponse.content) {
      await stepTracker?.addStep({
        type: 'thinking',
        iteration: 0,
        thinking: parsedResponse.content,
      });
    }

    // Handle tool calls (up to maxToolIterations)
    let iterations = 0;

    // Track tool conversation for iterations (separate from embedded history)
    const toolConversation: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];

    while (hasToolCalls(parsedResponse) && iterations < this.config.maxToolIterations) {
      iterations++;
      logger.info(
        `[ChatLoop] Processing ${parsedResponse.toolCalls?.length} tool calls (iteration ${iterations})`
      );

      // Add assistant message with tool calls to tool conversation
      toolConversation.push({
        role: 'assistant' as const,
        content: parsedResponse.content || '',
      });

      // Execute each tool call
      const toolCalls = getToolCalls(parsedResponse);
      for (const toolCall of toolCalls) {
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
          });
        }
      }

      // Rebuild messages with embedded history + tool conversation
      const toolMessages = buildToolIterationMessages(llmMessages, toolConversation);

      // Emit LLM iteration step
      await stepTracker?.addStep({
        type: 'llm_iteration',
        iteration: iterations,
        maxIterations: this.config.maxToolIterations,
      });

      // Continue conversation with tool results
      response = await this.config.llmProvider.chat(
        toolMessages,
        hasTools ? this.config.tools : undefined
      );

      // Parse new response
      parsedResponse = parse(response);

      // Track token usage from follow-up calls
      if (parsedResponse.usage) {
        tokenUsage.input += parsedResponse.usage.inputTokens || 0;
        tokenUsage.output += parsedResponse.usage.outputTokens || 0;
        tokenUsage.total += parsedResponse.usage.totalTokens || 0;
        if (typeof parsedResponse.usage.cachedTokens === 'number') {
          tokenUsage.cached = (tokenUsage.cached || 0) + parsedResponse.usage.cachedTokens;
        }

        stepTracker?.addTokenUsage(parsedResponse.usage);
      }
      if (parsedResponse.model) {
        stepTracker?.setModel(parsedResponse.model);
      }

      // Emit thinking text from follow-up response
      // This shows the LLM's reasoning after receiving tool results
      if (parsedResponse.content) {
        await stepTracker?.addStep({
          type: 'thinking',
          iteration: iterations,
          thinking: parsedResponse.content,
        });
      }
    }

    // Emit preparing step before finalizing
    await stepTracker?.addStep({ type: 'preparing', iteration: 0 });

    const assistantContent = parsedResponse.content;

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
    if (parsedResponse.model) {
      result.model = parsedResponse.model;
    }

    return result;
  }
}
