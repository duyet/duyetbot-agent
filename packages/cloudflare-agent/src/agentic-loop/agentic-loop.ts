/**
 * Agentic Loop - Claude Code-style Agent Reasoning Loop
 *
 * Implements the core agentic loop pattern: think → act → observe → repeat
 *
 * The loop operates as follows:
 * 1. Add initial messages to conversation history
 * 2. Call LLM with current message history and available tools
 * 3. If LLM returns a response without tool calls → done, return response
 * 4. If LLM returns tool calls → execute them (can be parallel)
 * 5. Add tool results to message history
 * 6. Report progress via callbacks
 * 7. Repeat from step 2
 *
 * Loop terminates when:
 * - LLM returns a response without tool calls (normal completion)
 * - Maximum iterations reached (safety limit)
 * - LLM or tool execution error occurs
 *
 * Design principles:
 * - Progress callbacks on every iteration and tool execution
 * - Parallel tool execution when multiple tools called in single iteration
 * - Tool errors fed back to LLM, not crashing the loop
 * - Subagent detection to prevent recursive spawning
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LLMMessage, LLMResponse, OpenAITool } from '../types.js';
import type {
  AgenticLoopConfig,
  AgenticLoopResult,
  LoopContext,
  LoopMessage,
  LoopTool,
  ProgressUpdate,
  ToolCall,
  ToolResult,
} from './types.js';

/**
 * Core agentic loop implementation
 *
 * Manages the think → act → observe cycle for agent reasoning.
 * Integrates with LLM providers and tool execution frameworks.
 */
export class AgenticLoop {
  private config: AgenticLoopConfig;
  private messages: LoopMessage[];
  private toolsInvoked: Set<string>;
  private totalTokens: { input: number; output: number };
  private debugSteps: Array<{
    iteration: number;
    type: 'thinking' | 'tool_execution';
    toolName?: string;
    args?: Record<string, unknown>;
    result?: ToolResult;
    thinking?: string;
  }>;

  /**
   * Create a new agentic loop instance
   *
   * @param config - Configuration for the loop (tools, system prompt, callbacks)
   */
  constructor(config: AgenticLoopConfig) {
    this.config = config;
    this.messages = [];
    this.toolsInvoked = new Set();
    this.totalTokens = { input: 0, output: 0 };
    this.debugSteps = [];
  }

  /**
   * Main execution loop
   *
   * Runs the Claude Code-style agentic loop:
   * - Maintains conversation history
   * - Calls LLM with tool definitions
   * - Executes tool calls
   * - Feeds results back to LLM
   * - Reports progress to callbacks
   *
   * @param ctx - Loop execution context with platform info and tracing
   * @param initialMessages - Starting messages (usually user query)
   * @returns Loop result with response, metrics, and tool usage
   */
  async run(ctx: LoopContext, initialMessages: LoopMessage[]): Promise<AgenticLoopResult> {
    const startTime = Date.now();
    let iteration = 0;

    try {
      // Initialize message history with user input
      this.messages = [...initialMessages];

      // Main loop - think → act → observe
      while (iteration < this.config.maxIterations) {
        // Report thinking progress
        await this.reportProgress({
          type: 'thinking',
          message: `Thinking... (iteration ${iteration + 1}/${this.config.maxIterations})`,
          iteration,
          timestamp: Date.now(),
        });

        // Capture thinking step for debug
        const thinkingStep = {
          iteration,
          type: 'thinking' as const,
          thinking: `Iteration ${iteration + 1}/${this.config.maxIterations}`,
        };
        this.debugSteps.push(thinkingStep);

        // Call LLM with current message history and tools
        const llmResponse = await this.chat(ctx, this.messages);

        // Update token usage
        if (llmResponse.usage) {
          this.totalTokens.input += llmResponse.usage.inputTokens;
          this.totalTokens.output += llmResponse.usage.outputTokens;
        }

        // Parse tool calls and add assistant response to history
        const parsedToolCalls = llmResponse.toolCalls?.map((call) => ({
          id: call.id,
          name: call.name,
          arguments: this.parseToolArguments(call.arguments),
        }));

        const assistantMessage: LoopMessage & { role: 'assistant' } = {
          role: 'assistant',
          content: llmResponse.content,
        };

        if (parsedToolCalls !== undefined) {
          assistantMessage.toolCalls = parsedToolCalls;
        }

        this.messages.push(assistantMessage);

        // Check if LLM has tool calls to execute
        if (!parsedToolCalls || parsedToolCalls.length === 0) {
          // No tool calls - agent is done reasoning
          return this.createResult(true, llmResponse.content, iteration, startTime);
        }

        // Execute tool calls (parallel execution)
        const toolResults = await this.executeToolCalls(ctx, parsedToolCalls, iteration);

        // Add tool results to message history
        for (const result of toolResults) {
          this.messages.push({
            role: 'tool_result',
            toolCallId: result.toolCall.id,
            content: result.result.output,
          });
        }

        iteration++;
      }

      // Maximum iterations reached
      return this.createResult(
        false,
        this.messages[this.messages.length - 1]?.role === 'assistant'
          ? (this.messages[this.messages.length - 1] as any).content
          : 'Max iterations reached',
        iteration,
        startTime,
        'Maximum iterations exceeded'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('AgenticLoop error', { error: errorMsg });

      return this.createResult(
        false,
        'An error occurred during execution',
        iteration,
        startTime,
        errorMsg
      );
    }
  }

  /**
   * Parse tool arguments from JSON string to object
   *
   * @param argumentsStr - JSON string of arguments
   * @returns Parsed arguments object
   */
  private parseToolArguments(argumentsStr: string): Record<string, unknown> {
    try {
      return JSON.parse(argumentsStr) as Record<string, unknown>;
    } catch {
      logger.warn('Failed to parse tool arguments', { argumentsStr });
      return {};
    }
  }

  /**
   * Call LLM with current message history
   *
   * Converts loop messages to LLM format and calls the provider.
   * The LLM receives:
   * - System prompt (if specified in config)
   * - Full message history
   * - Available tool definitions
   *
   * @param ctx - Loop context for LLM provider access
   * @param messages - Current conversation messages
   * @returns LLM response with content and optional tool calls
   */
  private async chat(ctx: LoopContext, messages: LoopMessage[]): Promise<LLMResponse> {
    // Get LLM provider from execution context
    const provider = (ctx.executionContext as any).provider;
    if (!provider) {
      throw new Error('LLM provider not available in execution context');
    }

    // Build message list for LLM
    const llmMessages: LLMMessage[] = [];

    // Add system prompt if configured
    if (this.config.systemPrompt) {
      llmMessages.push({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // Convert loop messages to LLM format
    for (const msg of messages) {
      if (msg.role === 'user') {
        llmMessages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        llmMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      } else if (msg.role === 'tool_result') {
        llmMessages.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId,
        });
      }
    }

    // Convert tools to OpenAI format
    const tools = this.config.tools.map((tool) => this.toolToOpenAIFormat(tool));

    // Call LLM
    const response = await provider.chat(llmMessages, tools);

    return response;
  }

  /**
   * Execute a set of tool calls (potentially in parallel)
   *
   * For each tool call:
   * 1. Report tool start
   * 2. Find tool in configuration
   * 3. Execute tool with arguments
   * 4. Report tool completion/error
   * 5. Collect result
   *
   * @param ctx - Loop context with platform info and tracing
   * @param toolCalls - Tool calls from LLM to execute
   * @param iteration - Current iteration number
   * @returns Results from all tool executions
   */
  private async executeToolCalls(
    ctx: LoopContext,
    toolCalls: ToolCall[],
    iteration: number
  ): Promise<Array<{ toolCall: ToolCall; result: ToolResult }>> {
    // Execute all tool calls in parallel
    const results = await Promise.all(
      toolCalls.map((toolCall) => this.executeTool(ctx, toolCall, iteration))
    );

    return results;
  }

  /**
   * Execute a single tool
   *
   * Handles:
   * - Tool lookup in configuration
   * - Progress callbacks (start and completion)
   * - Execution with error handling
   * - Duration tracking
   * - Debug accumulation for observability
   *
   * @param ctx - Loop context
   * @param toolCall - Tool call to execute
   * @param iteration - Current iteration number
   * @returns Tool call and result
   */
  private async executeTool(
    ctx: LoopContext,
    toolCall: ToolCall,
    iteration: number
  ): Promise<{ toolCall: ToolCall; result: ToolResult }> {
    const startTime = Date.now();

    try {
      // Find tool in configuration
      const tool = this.config.tools.find((t) => t.name === toolCall.name);
      if (!tool) {
        const result: ToolResult = {
          success: false,
          output: `Tool not found: ${toolCall.name}`,
          error: `Tool not found: ${toolCall.name}`,
          durationMs: Date.now() - startTime,
        };

        // Capture debug info
        await this.captureDebugInfo(toolCall.name, toolCall.arguments, result, iteration);

        return {
          toolCall,
          result,
        };
      }

      // Report tool start
      await this.reportProgress({
        type: 'tool_start',
        message: `Executing ${toolCall.name}...`,
        toolName: toolCall.name,
        iteration,
        timestamp: Date.now(),
      });

      if (this.config.onToolStart) {
        await this.config.onToolStart(toolCall.name, toolCall.arguments);
      }

      // Execute the tool
      const result = await tool.execute(toolCall.arguments, ctx);
      const durationMs = Date.now() - startTime;

      // Track tool usage
      this.toolsInvoked.add(toolCall.name);

      // Capture debug info with result
      await this.captureDebugInfo(toolCall.name, toolCall.arguments, result, iteration);

      // Report completion
      await this.reportProgress({
        type: result.success ? 'tool_complete' : 'tool_error',
        message: result.success
          ? `${toolCall.name} completed (${durationMs}ms)`
          : `${toolCall.name} failed: ${result.error || 'Unknown error'}`,
        toolName: toolCall.name,
        iteration,
        timestamp: Date.now(),
        durationMs,
      });

      if (this.config.onToolEnd) {
        await this.config.onToolEnd(toolCall.name, result);
      }

      return { toolCall, result };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error('Tool execution error', {
        tool: toolCall.name,
        error: errorMsg,
      });

      // Prepare error result
      const result: ToolResult = {
        success: false,
        output: `Error executing ${toolCall.name}: ${errorMsg}`,
        error: errorMsg,
        durationMs,
      };

      // Capture debug info for error case
      await this.captureDebugInfo(toolCall.name, toolCall.arguments, result, iteration);

      // Return error result without throwing - let LLM handle the error
      return {
        toolCall,
        result,
      };
    }
  }

  /**
   * Convert loop tool to OpenAI tool format
   *
   * Adapts internal tool representation to OpenAI/Claude compatible format
   * for passing to LLM APIs.
   *
   * @param tool - Internal tool representation
   * @returns OpenAI-formatted tool definition
   */
  private toolToOpenAIFormat(tool: LoopTool): OpenAITool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  /**
   * Capture debug information for a tool call
   *
   * Collects tool invocation details for observability and calls the debug
   * accumulator callback if configured.
   *
   * @param toolName - Name of the tool
   * @param args - Arguments passed to the tool
   * @param result - Result from tool execution
   * @param iteration - Current iteration number
   */
  private async captureDebugInfo(
    toolName: string,
    args: Record<string, unknown>,
    result: ToolResult,
    iteration: number
  ): Promise<void> {
    try {
      // Add to internal debug steps
      const debugStep = {
        iteration,
        type: 'tool_execution' as const,
        toolName,
        args,
        result,
      };
      this.debugSteps.push(debugStep);

      // Call debug accumulator callback if configured
      if (this.config.debugAccumulator) {
        try {
          await this.config.debugAccumulator({
            name: toolName,
            args,
            result,
            iteration,
          });
        } catch (error) {
          logger.error('Debug accumulator callback error', {
            tool: toolName,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't throw - debug callbacks should not crash the loop
        }
      }
    } catch (error) {
      logger.error('Debug capture error', {
        tool: toolName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - debug operations should not crash the loop
    }
  }

  /**
   * Report progress via configured callbacks
   *
   * Called on every iteration and tool execution to provide real-time
   * feedback about what the agent is doing. Useful for Telegram/GitHub
   * bots updating users in real-time.
   *
   * @param update - Progress update to report
   */
  private async reportProgress(update: ProgressUpdate): Promise<void> {
    if (this.config.onProgress) {
      try {
        await this.config.onProgress(update);
      } catch (error) {
        logger.error('Progress callback error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - progress callbacks should not crash the loop
      }
    }
  }

  /**
   * Create final loop result
   *
   * Packages up the loop response, metrics, and metadata into
   * the standard AgenticLoopResult format, including debug context.
   *
   * @param success - Whether loop completed successfully
   * @param response - Final response text
   * @param iterations - Number of iterations executed
   * @param startTime - Loop start time for duration calculation
   * @param error - Error message if failed
   * @returns Formatted loop result
   */
  private createResult(
    success: boolean,
    response: string,
    iterations: number,
    startTime: number,
    error?: string
  ): AgenticLoopResult {
    const result: AgenticLoopResult = {
      success,
      response,
      iterations,
      toolsUsed: Array.from(this.toolsInvoked),
      totalDurationMs: Date.now() - startTime,
      tokenUsage: {
        input: this.totalTokens.input,
        output: this.totalTokens.output,
        total: this.totalTokens.input + this.totalTokens.output,
      },
      debugContext: {
        steps: this.debugSteps,
      },
    };

    if (error !== undefined) {
      result.error = error;
    }

    return result;
  }

  /**
   * Get invoked tools (for debugging)
   *
   * @returns Set of tool names that were used
   */
  getToolsInvoked(): Set<string> {
    return new Set(this.toolsInvoked);
  }

  /**
   * Get full message history (for debugging/observability)
   *
   * @returns Current conversation message history
   */
  getMessages(): LoopMessage[] {
    return [...this.messages];
  }
}

/**
 * Create a new agentic loop instance
 *
 * Convenience factory for instantiating a loop with configuration.
 *
 * @param config - Loop configuration
 * @returns Configured AgenticLoop instance
 *
 * @example
 * ```typescript
 * const loop = createAgenticLoop({
 *   maxIterations: 10,
 *   systemPrompt: 'You are a helpful assistant...',
 *   tools: [readFileTool, searchTool],
 *   onProgress: async (update) => {
 *     console.log(`[${update.iteration}] ${update.message}`);
 *   }
 * });
 *
 * const result = await loop.run(ctx, [
 *   { role: 'user', content: 'Find the README' }
 * ]);
 * ```
 */
export function createAgenticLoop(config: AgenticLoopConfig): AgenticLoop {
  return new AgenticLoop(config);
}
