/**
 * CloudflareAgent Integration for AgenticLoop
 *
 * Provides the bridge between CloudflareAgent's message handling and the
 * AgenticLoop execution. This module is conditionally used when USE_AGENTIC_LOOP
 * feature flag is enabled.
 *
 * Key responsibilities:
 * - Create LoopContext from CloudflareAgent state
 * - Wire progress callbacks to transport for real-time updates
 * - Convert AgenticLoopResult to response string
 * - Handle heartbeat reporting during execution
 *
 * @example
 * ```typescript
 * // In CloudflareAgent batch processing
 * if (isAgenticLoopEnabled(env)) {
 *   const response = await runAgenticLoop({
 *     query: combinedText,
 *     transport,
 *     ctx,
 *     messageRef,
 *     provider,
 *     systemPrompt,
 *   });
 *   // Edit message with response
 * }
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MessageRef, Transport } from '../transport.js';
import type { LLMProvider } from '../types.js';
import { AgenticLoop } from './agentic-loop.js';
import { createCoreTools } from './tools/index.js';
import { createTransportAdapter } from './transport-adapter.js';
import type { AgenticLoopResult, LoopContext, LoopMessage, LoopTool } from './types.js';

/**
 * Configuration for running the AgenticLoop
 */
export interface AgenticLoopIntegrationConfig<TContext> {
  /** User's query/message */
  query: string;
  /** Transport for sending/editing messages */
  transport: Transport<TContext>;
  /** Platform context (Telegram/GitHub) */
  ctx: TContext;
  /** Reference to the thinking message to edit */
  messageRef: MessageRef;
  /** LLM provider for chat calls */
  provider: LLMProvider;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** Optional heartbeat function to keep DO alive */
  reportHeartbeat?: () => Promise<void>;
  /** Optional typing indicator function */
  sendTyping?: () => Promise<void>;
  /** Maximum iterations (default: 50) */
  maxIterations?: number;
  /** Additional tools beyond core tools */
  additionalTools?: LoopTool[];
  /** Whether this is a subagent (disables subagent tool) */
  isSubagent?: boolean;
  /** Conversation history for context */
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Platform identifier for tracing */
  platform?: string;
  /** Trace ID for debugging */
  traceId?: string;
}

/**
 * Result from running the AgenticLoop
 */
export interface AgenticLoopIntegrationResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Final response to send to user */
  response: string;
  /** Execution metrics */
  metrics: {
    iterations: number;
    toolsUsed: string[];
    durationMs: number;
    tokensUsed?: number;
  };
  /** Error message if failed */
  error?: string;
  /** Debug context with step-by-step execution details for observability */
  debugContext?: {
    /** Execution steps including tool calls and results */
    steps: Array<{
      iteration: number;
      type: 'thinking' | 'tool_execution';
      toolName?: string;
      args?: Record<string, unknown>;
      result?: {
        success: boolean;
        output: string;
        durationMs: number;
        error?: string;
      };
      thinking?: string;
    }>;
  };
}

/**
 * Run the AgenticLoop with CloudflareAgent integration
 *
 * This is the main entry point for using the agentic loop within CloudflareAgent.
 * It handles:
 * - Creating the execution context
 * - Setting up progress callbacks to update the thinking message
 * - Running the loop until completion or max iterations
 * - Returning the final response
 *
 * @param config - Integration configuration
 * @returns Result with response and metrics
 */
export async function runAgenticLoop<TContext>(
  config: AgenticLoopIntegrationConfig<TContext>
): Promise<AgenticLoopIntegrationResult> {
  const startTime = Date.now();

  const {
    query,
    transport,
    ctx,
    messageRef,
    provider,
    systemPrompt,
    reportHeartbeat,
    sendTyping,
    maxIterations = 50,
    additionalTools = [],
    isSubagent = false,
    conversationHistory = [],
    platform = 'unknown',
    traceId = `loop-${Date.now()}`,
  } = config;

  // Create edit function for transport adapter
  const editMessage = async (text: string): Promise<void> => {
    if (transport.edit) {
      try {
        await transport.edit(ctx, messageRef, text);
      } catch (error) {
        logger.warn('[AgenticLoop] Failed to edit message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  };

  // Create transport adapter for progress callbacks
  // Note: Only include optional properties when defined (exactOptionalPropertyTypes)
  const adapter = createTransportAdapter({
    editMessage,
    maxDisplayedUpdates: 5,
    ...(reportHeartbeat && { reportHeartbeat }),
    ...(sendTyping && { sendTyping }),
  });

  // Get core tools (plan, research, memory, github, approval, subagent)
  // Subagent tool is excluded if isSubagent=true to prevent recursion
  const coreTools = createCoreTools({ isSubagent });
  const tools = [...coreTools, ...additionalTools];

  // Create execution context for tools
  const loopContext: LoopContext = {
    executionContext: {
      platform,
      traceId,
      provider, // Tools may need LLM access
    } as any,
    iteration: 0,
    toolHistory: [],
    isSubagent,
  };

  // Build initial messages
  const initialMessages: LoopMessage[] = [];

  // Add conversation history
  for (const msg of conversationHistory) {
    initialMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current query
  initialMessages.push({
    role: 'user',
    content: query,
  });

  // Track debug steps for observability
  const debugSteps: Array<{
    iteration: number;
    type: 'thinking' | 'tool_execution';
    toolName?: string;
    args?: Record<string, unknown>;
    result?: {
      success: boolean;
      output: string;
      durationMs: number;
      error?: string;
    };
    thinking?: string;
  }> = [];

  // Create and run the agentic loop
  // Note: Only include systemPrompt when defined (exactOptionalPropertyTypes)
  const loop = new AgenticLoop({
    maxIterations,
    tools,
    ...(systemPrompt && { systemPrompt }),
    ...adapter.callbacks,
    // Debug accumulator for observability
    debugAccumulator: async (info) => {
      debugSteps.push({
        iteration: info.iteration,
        type: 'tool_execution',
        toolName: info.name,
        args: info.args,
        result: {
          success: info.result.success,
          output: info.result.output,
          durationMs: info.result.durationMs,
          ...(info.result.error && { error: info.result.error }),
        },
      });
    },
  });

  try {
    logger.info('[AgenticLoop] Starting execution', {
      query: query.slice(0, 100),
      maxIterations,
      toolCount: tools.length,
      isSubagent,
      traceId,
    });

    const result = await loop.run(loopContext, initialMessages);

    const durationMs = Date.now() - startTime;

    logger.info('[AgenticLoop] Execution completed', {
      success: result.success,
      iterations: result.iterations,
      toolsUsed: result.toolsUsed,
      durationMs,
      traceId,
    });

    // Build metrics object, only including tokensUsed when available
    const metrics: AgenticLoopIntegrationResult['metrics'] = {
      iterations: result.iterations,
      toolsUsed: result.toolsUsed,
      durationMs,
    };
    if (result.tokenUsage?.total !== undefined) {
      metrics.tokensUsed = result.tokenUsage.total;
    }

    // Merge debug steps from loop's internal context with our tracked steps
    const mergedDebugSteps = result.debugContext?.steps || [];

    // Create final result with debug context
    const finalResult: AgenticLoopIntegrationResult = {
      success: result.success,
      response: result.response,
      metrics,
    };

    // Only include error when present (exactOptionalPropertyTypes)
    if (result.error) {
      finalResult.error = result.error;
    }

    // Only include debugContext if there are steps (exactOptionalPropertyTypes)
    if (mergedDebugSteps.length > 0) {
      finalResult.debugContext = {
        steps: mergedDebugSteps,
      };
    }

    return finalResult;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error('[AgenticLoop] Execution failed', {
      error: errorMsg,
      durationMs,
      traceId,
    });

    return {
      success: false,
      response: 'An error occurred while processing your request.',
      metrics: {
        iterations: 0,
        toolsUsed: [],
        durationMs,
      },
      error: errorMsg,
    };
  }
}

/**
 * Format AgenticLoop result for display
 *
 * Adds execution summary as a footer if debug mode is enabled.
 * Respects platform's parseMode (HTML vs MarkdownV2) for proper formatting.
 * Accepts both AgenticLoopResult (from raw loop) and AgenticLoopIntegrationResult (from runAgenticLoop).
 *
 * @param result - Loop execution result (either type)
 * @param includeDebug - Whether to include debug footer
 * @param parseMode - Telegram parseMode (HTML or MarkdownV2) for proper formatting
 * @returns Formatted response string
 */
export function formatAgenticLoopResponse(
  result: AgenticLoopResult | AgenticLoopIntegrationResult,
  includeDebug = false,
  parseMode?: 'HTML' | 'MarkdownV2'
): string {
  let response = result.response;

  if (includeDebug && result.success) {
    // Normalize metrics from either type
    const iterations = 'iterations' in result ? result.iterations : result.metrics.iterations;
    const toolsUsed = 'toolsUsed' in result ? result.toolsUsed : result.metrics.toolsUsed;
    const durationMs =
      'totalDurationMs' in result ? result.totalDurationMs : result.metrics.durationMs;
    const tokensTotal =
      'tokenUsage' in result
        ? result.tokenUsage?.total
        : (result as AgenticLoopIntegrationResult).metrics.tokensUsed;

    // Format footer based on parseMode
    if (parseMode === 'HTML') {
      // HTML format with <code> block for monospace
      const footerLines = [
        `⏰ ${iterations} iteration${iterations !== 1 ? 's' : ''}`,
        `🔧 Tools: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none'}`,
        `⏱️ ${durationMs}ms`,
      ];

      if (tokensTotal !== undefined) {
        footerLines.push(`📊 ${tokensTotal} tokens`);
      }

      response += `\n\n<code>${footerLines.join('\n')}</code>`;
    } else if (parseMode === 'MarkdownV2') {
      // MarkdownV2 format with escaped special characters
      const escapeMarkdownV2Char = (str: string): string => {
        return str.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
      };

      const footerLines = [
        `⏰ ${escapeMarkdownV2Char(`${iterations} iteration${iterations !== 1 ? 's' : ''}`)}`,
        `🔧 Tools: ${escapeMarkdownV2Char(toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none')}`,
        `⏱️ ${escapeMarkdownV2Char(`${durationMs}ms`)}`,
      ];

      if (tokensTotal !== undefined) {
        footerLines.push(`📊 ${escapeMarkdownV2Char(`${tokensTotal} tokens`)}`);
      }

      response += `\n\n\`\`\`\n${footerLines.join('\n')}\n\`\`\``;
    } else {
      // Plain text format (fallback)
      const footer = [
        '',
        '---',
        `⏰ ${iterations} iteration${iterations !== 1 ? 's' : ''}`,
        `🔧 Tools: ${toolsUsed.length > 0 ? toolsUsed.join(', ') : 'none'}`,
        `⏱️ ${durationMs}ms`,
      ];

      if (tokensTotal !== undefined) {
        footer.push(`📊 ${tokensTotal} tokens`);
      }

      response += footer.join('\n');
    }
  }

  return response;
}

/**
 * Check if AgenticLoop should be used based on query characteristics
 *
 * Some queries may be better suited for the legacy routing system.
 * This function provides a heuristic check.
 *
 * @param query - User's query
 * @returns Whether to use AgenticLoop
 */
export function shouldUseAgenticLoop(_query: string): boolean {
  // Always use AgenticLoop when enabled - the feature flag is the primary control
  // This function can be extended later for query-specific routing
  // The _query parameter is preserved for future heuristics
  return true;
}
