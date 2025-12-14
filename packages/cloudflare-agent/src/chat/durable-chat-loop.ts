/**
 * Durable ChatLoop - Alarm-based iteration for unlimited execution time
 *
 * Instead of running all iterations in a single execution (30s limit),
 * we run ONE iteration per alarm, saving state between alarms.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LLMProvider, Message, OpenAITool } from '../types.js';
import { ContextBuilder, type ContextBuilderConfig } from './context-builder.js';
import { ResponseHandler } from './response-handler.js';
import { ToolExecutor, type ToolExecutorConfig } from './tool-executor.js';
import type { ChatIterationResult, ChatLoopExecution } from './types.js';

export interface DurableChatLoopConfig {
  llmProvider: LLMProvider;
  tools: OpenAITool[];
  toolExecutor: ToolExecutorConfig;
}

/**
 * Run a single iteration of the chat loop
 * Called from DO alarm handler
 */
export async function runChatIteration(
  execution: ChatLoopExecution,
  config: DurableChatLoopConfig
): Promise<ChatIterationResult> {
  const startTime = Date.now();
  execution.iteration++;

  logger.info(
    `[DurableChatLoop] Starting iteration ${execution.iteration}/${execution.maxIterations} (execution: ${execution.executionId})`
  );

  // Build messages for LLM
  const contextConfig: ContextBuilderConfig = {
    systemPrompt: execution.systemPrompt,
    messages: execution.conversationHistory,
  };

  // Include iteration messages (tool results from previous iterations)
  let llmMessages = ContextBuilder.buildInitialMessages(
    contextConfig,
    execution.userMessage,
    execution.quotedContext
  );

  // Append iteration messages if any
  if (execution.iterationMessages.length > 0) {
    llmMessages = [...llmMessages, ...execution.iterationMessages];
  }

  // Call LLM
  const hasTools = config.tools.length > 0;
  const response = await config.llmProvider.chat(llmMessages, hasTools ? config.tools : undefined);

  // Parse response
  const parsed = ResponseHandler.parse(response);

  // Track token usage
  if (parsed.usage) {
    execution.tokenUsage.input += parsed.usage.inputTokens || 0;
    execution.tokenUsage.output += parsed.usage.outputTokens || 0;
    if (parsed.usage.cachedTokens) {
      execution.tokenUsage.cached = (execution.tokenUsage.cached || 0) + parsed.usage.cachedTokens;
    }
  }

  // Add execution step
  execution.executionSteps.push({
    type: 'llm_call',
    iteration: execution.iteration,
    thinking: parsed.content,
    timestamp: Date.now(),
    durationMs: Date.now() - startTime,
  });

  // Check if we have tool calls
  if (ResponseHandler.hasToolCalls(parsed)) {
    const toolCalls = ResponseHandler.getToolCalls(parsed);

    logger.info(
      `[DurableChatLoop] Processing ${toolCalls.length} tool calls (iteration ${execution.iteration})`
    );

    // Store assistant message with tool calls
    execution.iterationMessages.push({
      role: 'assistant',
      content: parsed.content || '',
    });

    // Execute tools
    const toolExecutor = new ToolExecutor(config.toolExecutor);

    for (const toolCall of toolCalls) {
      let toolArgs: Record<string, unknown> = {};
      try {
        toolArgs = JSON.parse(toolCall.arguments);
      } catch {
        // Invalid JSON args, continue with empty object
      }

      // Track tool start
      execution.executionSteps.push({
        type: 'tool_start',
        iteration: execution.iteration,
        toolName: toolCall.name,
        args: toolArgs,
        timestamp: Date.now(),
      });

      const toolStart = Date.now();
      const result = await toolExecutor.execute(toolCall);

      if (result.error) {
        execution.executionSteps.push({
          type: 'tool_error',
          iteration: execution.iteration,
          toolName: toolCall.name,
          error: result.error,
          timestamp: Date.now(),
          durationMs: Date.now() - toolStart,
        });

        execution.iterationMessages.push({
          role: 'user',
          content: `[Tool Error for ${toolCall.name}]: ${result.error}`,
        });
      } else {
        execution.executionSteps.push({
          type: 'tool_complete',
          iteration: execution.iteration,
          toolName: toolCall.name,
          result: result.result?.substring(0, 200),
          timestamp: Date.now(),
          durationMs: Date.now() - toolStart,
        });

        execution.iterationMessages.push({
          role: 'user',
          content: `[Tool Result for ${toolCall.name}]: ${result.result}`,
        });

        if (!execution.toolsUsed.includes(toolCall.name)) {
          execution.toolsUsed.push(toolCall.name);
        }
      }
    }

    logger.info(
      `[DurableChatLoop] Iteration ${execution.iteration} completed with tool calls - scheduling next iteration`
    );

    return {
      done: false,
      hasToolCalls: true,
      tokenUsage: execution.tokenUsage,
    };
  }

  // No tool calls - we're done
  execution.lastAssistantContent = parsed.content;
  execution.done = true;
  execution.response = parsed.content;

  logger.info(
    `[DurableChatLoop] Execution ${execution.executionId} completed after ${execution.iteration} iterations`
  );

  return {
    done: true,
    response: parsed.content,
    hasToolCalls: false,
    tokenUsage: execution.tokenUsage,
  };
}

/**
 * Initialize a new chat loop execution
 */
export function createChatExecution(params: {
  userMessage: string;
  systemPrompt: string;
  conversationHistory: Message[];
  maxIterations: number;
  messageRef: number;
  platform: 'telegram' | 'github';
  transportMetadata: Record<string, unknown>;
  traceId?: string;
  eventId?: string;
  quotedContext?: ChatLoopExecution['quotedContext'];
}): ChatLoopExecution {
  return {
    executionId: crypto.randomUUID(),
    traceId: params.traceId,
    eventId: params.eventId,
    iteration: 0,
    maxIterations: params.maxIterations,
    startedAt: Date.now(),
    userMessage: params.userMessage,
    systemPrompt: params.systemPrompt,
    quotedContext: params.quotedContext,
    conversationHistory: params.conversationHistory,
    iterationMessages: [],
    messageRef: params.messageRef,
    platform: params.platform,
    tokenUsage: { input: 0, output: 0 },
    toolsUsed: [],
    executionSteps: [],
    transportMetadata: params.transportMetadata,
    done: false,
  };
}

/**
 * Format progress message for display
 */
export function formatExecutionProgress(execution: ChatLoopExecution): string {
  const steps = execution.executionSteps;
  if (steps.length === 0) {
    return '[~] Thinking...';
  }

  const lines: string[] = [];

  // Show completed steps
  for (const step of steps) {
    if (step.type === 'thinking' && step.thinking) {
      lines.push(`⏺ ${step.thinking.substring(0, 100)}...`);
    } else if (step.type === 'tool_complete') {
      lines.push(`⏺ ${step.toolName} ✓`);
    } else if (step.type === 'tool_error') {
      lines.push(`⏺ ${step.toolName} ✗`);
    }
  }

  // Show current state
  const lastStep = steps[steps.length - 1];
  if (lastStep?.type === 'tool_start') {
    lines.push(`* ${lastStep.toolName}...`);
  } else if (!execution.done) {
    lines.push('* Thinking...');
  }

  return lines.join('\n') || '[~] Processing...';
}
