/**
 * Durable ChatLoop - Alarm-based iteration for unlimited execution time
 *
 * Instead of running all iterations in a single execution (30s limit),
 * we run ONE iteration per alarm, saving state between alarms.
 */

import { logger } from '@duyetbot/hono-middleware';
import { getRandomMessage } from '@duyetbot/progress';
import type { LLMProvider, Message, OpenAITool } from '../types.js';
import { buildInitialMessages, type ContextBuilderConfig } from './context-builder.js';
import { parse } from './response-handler.js';
import { ToolExecutor, type ToolExecutorConfig } from './tool-executor.js';
import type { ChatIterationResult, ChatLoopExecution } from './types.js';

// Tool execution timeout: 25 seconds (leaving 5s for overhead in 30s Worker limit)
const TOOL_TIMEOUT_MS = 25000;

/**
 * Wraps a promise with a timeout
 * @throws Error if the operation times out
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(
      () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
      timeoutMs
    );
  });

  return Promise.race([promise, timeoutPromise]);
}

export interface DurableChatLoopConfig {
  llmProvider: LLMProvider;
  tools: OpenAITool[];
  toolExecutor: ToolExecutorConfig;
  /** Optional callback to update progress after each step (for real-time message editing) */
  onProgress?: (execution: ChatLoopExecution) => Promise<void>;
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
  let llmMessages = buildInitialMessages(
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
  let responseContent = '';
  let toolCalls: any[] = [];
  let usage: any = undefined;
  let responseModel: string | undefined = undefined;

  if (config.llmProvider.streamChat) {
    const stream = config.llmProvider.streamChat(llmMessages, hasTools ? config.tools : undefined);
    let thinkingStepIndex = -1;
    let lastProgressUpdate = 0;
    const PROGRESS_MIN_INTERVAL = 1000;

    for await (const chunk of stream) {
      responseContent = chunk.content || responseContent;
      if (chunk.toolCalls) toolCalls = chunk.toolCalls;
      if (chunk.usage) usage = chunk.usage;
      if (chunk.model) responseModel = chunk.model;

      // Add or update thinking step
      if (thinkingStepIndex === -1) {
        thinkingStepIndex = execution.executionSteps.length;
        execution.executionSteps.push({
          type: 'thinking',
          iteration: execution.iteration,
          thinking: responseContent,
          timestamp: Date.now(),
        });
      } else {
        const step = execution.executionSteps[thinkingStepIndex];
        if (step && step.type === 'thinking') {
          step.thinking = responseContent;
        }
      }

      // Update progress frequently during streaming (throttled)
      if (config.onProgress && Date.now() - lastProgressUpdate > PROGRESS_MIN_INTERVAL) {
        await config.onProgress(execution);
        lastProgressUpdate = Date.now();
      }
    }

    // Final update for thinking step duration
    const step = execution.executionSteps[thinkingStepIndex];
    if (step && step.type === 'thinking') {
      step.durationMs = Date.now() - startTime;
    }
  } else {
    const response = await config.llmProvider.chat(llmMessages, hasTools ? config.tools : undefined);
    const parsed = parse(response);
    responseContent = parsed.content;
    toolCalls = parsed.toolCalls || [];
    usage = parsed.usage;
    responseModel = parsed.model;

    // Add single thinking step
    execution.executionSteps.push({
      type: 'thinking',
      iteration: execution.iteration,
      thinking: responseContent,
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
    });

    if (config.onProgress) {
      await config.onProgress(execution);
    }
  }

  // Track token usage and model
  if (usage) {
    execution.tokenUsage.input += usage.inputTokens || 0;
    execution.tokenUsage.output += usage.outputTokens || 0;
    if (usage.cachedTokens) {
      execution.tokenUsage.cached = (execution.tokenUsage.cached || 0) + usage.cachedTokens;
    }
  }
  if (responseModel) {
    execution.model = responseModel;
  }

  // Check if we have tool calls
  if (toolCalls.length > 0) {
    logger.info(
      `[DurableChatLoop] Processing ${toolCalls.length} tool calls in parallel (iteration ${execution.iteration})`
    );

    // Store assistant message with tool calls
    execution.iterationMessages.push({
      role: 'assistant',
      content: responseContent || '',
    });

    // Execute tools in parallel
    const toolExecutor = new ToolExecutor(config.toolExecutor);

    await Promise.all(
      toolCalls.map(async (toolCall) => {
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

        // Update progress to show tool running
        if (config.onProgress) {
          await config.onProgress(execution);
        }

        const toolStart = Date.now();

        try {
          const result = await withTimeout(
            toolExecutor.execute(toolCall),
            TOOL_TIMEOUT_MS,
            `Tool execution: ${toolCall.name}`
          );

          if (result.error) {
            execution.executionSteps.push({
              type: 'tool_error',
              iteration: execution.iteration,
              toolName: toolCall.name,
              args: toolArgs,
              error: result.error,
              timestamp: Date.now(),
              durationMs: Date.now() - toolStart,
            });

            execution.iterationMessages.push({
              role: 'user',
              content: `[Tool Error for ${toolCall.name}]: ${result.error}`,
              toolCallId: toolCall.id,
            });
          } else {
            execution.executionSteps.push({
              type: 'tool_complete',
              iteration: execution.iteration,
              toolName: toolCall.name,
              args: toolArgs,
              result: result.result?.substring(0, 200) || '',
              timestamp: Date.now(),
              durationMs: Date.now() - toolStart,
            });

            execution.iterationMessages.push({
              role: 'user',
              content: `[Tool Result for ${toolCall.name}]: ${result.result}`,
              toolCallId: toolCall.id,
            });

            if (!execution.toolsUsed.includes(toolCall.name)) {
              execution.toolsUsed.push(toolCall.name);
            }
          }
        } catch (timeoutError) {
          const errorMessage =
            timeoutError instanceof Error ? timeoutError.message : 'Tool execution timed out';

          execution.executionSteps.push({
            type: 'tool_error',
            iteration: execution.iteration,
            toolName: toolCall.name,
            args: toolArgs,
            error: errorMessage,
            timestamp: Date.now(),
            durationMs: Date.now() - toolStart,
          });

          execution.iterationMessages.push({
            role: 'user',
            content: `[Tool Error for ${toolCall.name}]: ${errorMessage}`,
            toolCallId: toolCall.id,
          });
        } finally {
          // Update progress after tool completes/fails
          if (config.onProgress) {
            await config.onProgress(execution);
          }
        }
      })
    );

    logger.info(
      `[DurableChatLoop] Iteration ${execution.iteration} completed with parallel tool calls - scheduling next iteration`
    );

    return {
      done: false,
      hasToolCalls: true,
      tokenUsage: execution.tokenUsage,
    };
  }

  // No tool calls - we're done
  execution.lastAssistantContent = responseContent;
  execution.done = true;
  execution.response = responseContent;

  logger.info(
    `[DurableChatLoop] Execution ${execution.executionId} completed after ${execution.iteration} iterations`
  );

  return {
    done: true,
    response: responseContent,
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
 * Format tool arguments for compact display
 * Shows first argument value or ellipsis for multiple args
 */
function formatToolArgsCompact(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) {
    return '';
  }

  const firstKey = keys[0] as string;
  const firstValue = args[firstKey];

  if (typeof firstValue === 'string') {
    const truncated = firstValue.length > 40 ? `${firstValue.slice(0, 37)}...` : firstValue;
    return `${firstKey}: "${truncated}"`;
  }
  return keys.length > 1 ? '...' : `${firstKey}: ${String(firstValue).slice(0, 20)}`;
}

/**
 * Format tool result for compact display
 */
function formatToolResultCompact(result: string): string {
  const firstLine = result.split('\n')[0] ?? '';
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

/**
 * Format progress message for display (Claude Code-style chain)
 *
 * Shows a visual chain of execution steps with:
 * - ⏺ prefix for completed steps
 * - * prefix for currently running step
 * - Tool args inline with tool name
 * - Tool results indented with ⎿
 */
export function formatExecutionProgress(execution: ChatLoopExecution): string {
  const steps = execution.executionSteps;
  if (steps.length === 0) {
    return `* ${getRandomMessage()}`;
  }

  const lines: string[] = [];

  // Process all steps in order
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isLast = i === steps.length - 1;
    const stepOrNull = step ?? null;
    if (!stepOrNull) {
      continue;
    }

    // Thinking step - LLM reasoning/content
    if (stepOrNull.type === 'thinking' && stepOrNull.thinking) {
      const thinking = stepOrNull.thinking.replace(/\n/g, ' ').trim();
      const truncated = thinking.slice(0, 80);
      const ellipsis = thinking.length > 80 ? '...' : '';

      // If this is the last step and still processing, show as running
      if (isLast && !execution.done) {
        lines.push(`* ${truncated}${ellipsis}`);
      } else {
        lines.push(`⏺ ${truncated}${ellipsis}`);
      }
    }

    // Tool starting - show as running with args
    else if (stepOrNull.type === 'tool_start') {
      const argsStr = stepOrNull.args ? formatToolArgsCompact(stepOrNull.args) : '';
      const toolDisplay = argsStr
        ? `${stepOrNull.toolName}(${argsStr})`
        : `${stepOrNull.toolName}()`;

      // If this is the last step, show as running
      if (isLast) {
        lines.push(`* ${toolDisplay}`);
        lines.push(`  ⎿ Running…`);
      } else {
        lines.push(`⏺ ${toolDisplay}`);
      }
    }

    // Tool completed - show result with args
    else if (stepOrNull.type === 'tool_complete') {
      const argsStr = stepOrNull.args ? formatToolArgsCompact(stepOrNull.args) : '';
      const toolDisplay = argsStr
        ? `${stepOrNull.toolName}(${argsStr})`
        : `${stepOrNull.toolName}()`;
      lines.push(`⏺ ${toolDisplay}`);
      if (stepOrNull.result && typeof stepOrNull.result === 'string') {
        const resultPreview = formatToolResultCompact(stepOrNull.result);
        lines.push(`  ⎿ ${resultPreview}`);
      }
    }

    // Tool error - show with args
    else if (stepOrNull.type === 'tool_error') {
      const argsStr = stepOrNull.args ? formatToolArgsCompact(stepOrNull.args) : '';
      const toolDisplay = argsStr
        ? `${stepOrNull.toolName}(${argsStr})`
        : `${stepOrNull.toolName}()`;
      lines.push(`⏺ ${toolDisplay}`);
      lines.push(`  ⎿ ❌ ${stepOrNull.error.slice(0, 60)}...`);
    }
  }

  // If still processing and last step wasn't thinking or tool_start, show rotating message
  if (!execution.done && lines.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (lastStep && lastStep.type !== 'tool_start' && lastStep.type !== 'thinking') {
      lines.push(`\n* ${getRandomMessage()}`);
    }
  }

  return lines.join('\n') || `* ${getRandomMessage()}`;
}
