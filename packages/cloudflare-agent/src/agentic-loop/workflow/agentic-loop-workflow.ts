/**
 * AgenticLoopWorkflow - Cloudflare Workflow-Based Agent Execution
 *
 * Implements the agentic loop (think → act → observe → repeat) as a durable
 * Cloudflare Workflow, eliminating the 30-second DO timeout constraint.
 *
 * Key benefits over synchronous AgenticLoop:
 * - **No timeout risk**: Each iteration is a separate step with 30s budget
 * - **Automatic persistence**: State saved after each step
 * - **Built-in retries**: Exponential backoff on transient failures
 * - **Progress reporting**: Real-time updates via DO callback
 * - **Unlimited iterations**: Can run for hours if needed
 *
 * ## Provider Architecture
 *
 * Uses Cloudflare AI Gateway to route to OpenRouter.
 * The implementation mirrors `@duyetbot/providers` but is inlined to avoid
 * circular dependency (providers imports types from cloudflare-agent).
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 * @see https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
 *
 * @module agentic-loop-workflow
 */

import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { WorkflowEntrypoint } from 'cloudflare:workers';
import { NonRetryableError } from 'cloudflare:workflows';
import { createCoreTools } from '../tools/index.js';
import type { LoopMessage, LoopTool } from '../types.js';
import type {
  AgenticLoopWorkflowEnv,
  AgenticLoopWorkflowParams,
  JsonRecord,
  ProgressCallbackConfig,
  WorkflowCompletionResult,
  WorkflowLLMResponse,
  WorkflowProgressUpdate,
  WorkflowToolCall,
} from './types.js';

// ============================================================================
// Types for Workflow Step Results (JSON-serializable)
// ============================================================================

/**
 * Serializable iteration result for workflow steps
 * Must be plain JSON - no functions, classes, or special objects
 */
interface SerializableIterationResult {
  done: boolean;
  response?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'tool_result';
    content: string;
    toolCallId?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: JsonRecord }>;
  }>;
  toolsUsed: string[];
  tokenUsage: {
    input: number;
    output: number;
    cached?: number;
    reasoning?: number;
    costUsd?: number;
  };
  debugSteps: Array<{
    iteration: number;
    type: 'thinking' | 'tool_execution';
    toolName?: string;
    args?: JsonRecord;
    result?: { success: boolean; output: string; durationMs: number; error?: string };
    thinking?: string;
  }>;
}

/**
 * AgenticLoopWorkflow - Durable workflow for agent execution
 *
 * Extends WorkflowEntrypoint to run the agentic loop as durable steps.
 * Each iteration is a separate step with automatic state persistence.
 */
export class AgenticLoopWorkflow extends WorkflowEntrypoint<
  AgenticLoopWorkflowEnv,
  AgenticLoopWorkflowParams
> {
  /**
   * Main workflow execution
   */
  override async run(
    event: WorkflowEvent<AgenticLoopWorkflowParams>,
    step: WorkflowStep
  ): Promise<WorkflowCompletionResult> {
    const {
      executionId,
      query,
      systemPrompt,
      conversationHistory,
      maxIterations,
      progressCallback,
      isSubagent = false,
      traceId = `workflow-${executionId}`,
    } = event.payload;

    const startTime = Date.now();

    // Initialize messages from conversation history
    let messages: SerializableIterationResult['messages'] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user' as const, content: query },
    ];

    const toolsUsed: Set<string> = new Set();
    let totalTokens: SerializableIterationResult['tokenUsage'] = {
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      costUsd: 0,
    };
    const debugSteps: SerializableIterationResult['debugSteps'] = [];

    // Get tools (recreated at runtime since functions can't be serialized)
    const tools = createCoreTools({ isSubagent });

    let iteration = 0;

    try {
      // Main agentic loop - each iteration is a durable step
      while (iteration < maxIterations) {
        // Execute iteration as a durable step
        // Note: We use 'as unknown' cast to bypass Cloudflare's complex Serializable<T> type
        // which causes infinite type instantiation with recursive JsonValue types.
        // The actual data is JSON-serializable - this is purely a TypeScript limitation.
        const stepResult = (await step.do(
          `iteration-${iteration}`,
          {
            retries: {
              limit: 3,
              delay: '5 seconds',
              backoff: 'exponential',
            },
            timeout: '2 minutes',
          },
          // Remove return type annotation to avoid Serializable<T> type checking
          async () => {
            // 1. Report initial thinking progress (random rotator message)
            await this.reportProgress(progressCallback, {
              type: 'thinking',
              iteration,
              message: '', // Empty message triggers rotator in formatWorkflowProgress
              timestamp: Date.now(),
            });

            // 2. Call LLM with current messages
            const loopMessages = messages.map(
              (m) =>
                ({
                  role: m.role,
                  content: m.content,
                  ...(m.toolCallId && { toolCallId: m.toolCallId }),
                  ...(m.toolCalls && { toolCalls: m.toolCalls }),
                }) as LoopMessage
            );

            const llmResponse = await this.callLLM(
              this.env,
              systemPrompt,
              loopMessages,
              tools,
              traceId
            );

            // Update token usage (including extended fields)
            if (llmResponse.usage) {
              totalTokens.input += llmResponse.usage.inputTokens;
              totalTokens.output += llmResponse.usage.outputTokens;
              if (llmResponse.usage.cachedTokens) {
                totalTokens.cached = (totalTokens.cached || 0) + llmResponse.usage.cachedTokens;
              }
              if (llmResponse.usage.reasoningTokens) {
                totalTokens.reasoning =
                  (totalTokens.reasoning || 0) + llmResponse.usage.reasoningTokens;
              }
              if (llmResponse.usage.estimatedCostUsd) {
                totalTokens.costUsd =
                  (totalTokens.costUsd || 0) + llmResponse.usage.estimatedCostUsd;
              }
            }

            // 2b. Update with actual LLM reasoning text (if available and different from tool calls)
            if (llmResponse.content && llmResponse.content.trim()) {
              await this.reportProgress(progressCallback, {
                type: 'thinking',
                iteration,
                message: llmResponse.content, // Actual LLM reasoning
                timestamp: Date.now(),
              });
            }

            // Track thinking step with actual LLM content
            debugSteps.push({
              iteration,
              type: 'thinking',
              thinking: llmResponse.content || 'Processing',
            });

            // 3. Add assistant message to history
            const assistantMessage: SerializableIterationResult['messages'][0] = {
              role: 'assistant',
              content: llmResponse.content,
            };

            if (llmResponse.toolCalls && llmResponse.toolCalls.length > 0) {
              assistantMessage.toolCalls = llmResponse.toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.name,
                arguments: tc.arguments,
              }));
            }

            messages.push(assistantMessage);

            // 4. Check if done (no tool calls)
            if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
              return {
                done: true,
                response: llmResponse.content,
                messages: [...messages],
                toolsUsed: Array.from(toolsUsed),
                tokenUsage: { ...totalTokens },
                debugSteps: [...debugSteps],
              };
            }

            // 5. Execute tools (in-step, parallel)
            const toolResults = await this.executeTools(
              llmResponse.toolCalls,
              tools,
              progressCallback,
              iteration,
              isSubagent,
              traceId
            );

            // 6. Add tool results to message history and track usage
            for (const result of toolResults) {
              messages.push({
                role: 'tool_result',
                toolCallId: result.toolCallId,
                content: result.content,
              });

              if (result.toolName) {
                toolsUsed.add(result.toolName);
              }

              // Track debug info
              debugSteps.push({
                iteration,
                type: 'tool_execution',
                toolName: result.toolName,
                args: result.args,
                result: {
                  success: result.success,
                  output: result.content.slice(0, 500), // Truncate for storage
                  durationMs: result.durationMs,
                  ...(result.error && { error: result.error }),
                },
              });
            }

            return {
              done: false,
              messages: [...messages],
              toolsUsed: Array.from(toolsUsed),
              tokenUsage: { ...totalTokens },
              debugSteps: [...debugSteps],
            };
          }
        )) as unknown as SerializableIterationResult | null;

        // Handle null result (shouldn't happen but TypeScript requires it)
        if (!stepResult) {
          throw new NonRetryableError('Workflow step returned null');
        }

        // Check if loop should terminate
        if (stepResult.done) {
          // Report completion
          const result: WorkflowCompletionResult = {
            success: true,
            response: stepResult.response || '',
            iterations: iteration + 1,
            toolsUsed: stepResult.toolsUsed,
            totalDurationMs: Date.now() - startTime,
            tokenUsage: {
              input: stepResult.tokenUsage.input,
              output: stepResult.tokenUsage.output,
              total: stepResult.tokenUsage.input + stepResult.tokenUsage.output,
              ...(stepResult.tokenUsage.cached && { cached: stepResult.tokenUsage.cached }),
              ...(stepResult.tokenUsage.reasoning && {
                reasoning: stepResult.tokenUsage.reasoning,
              }),
              ...(stepResult.tokenUsage.costUsd && { costUsd: stepResult.tokenUsage.costUsd }),
            },
            debugContext: { steps: stepResult.debugSteps },
          };

          await step.do('report-completion', async () => {
            await this.reportCompletion(progressCallback, result);
          });

          return result;
        }

        // Update state from step result
        messages = stepResult.messages;
        for (const tool of stepResult.toolsUsed) {
          toolsUsed.add(tool);
        }
        totalTokens = stepResult.tokenUsage;

        iteration++;
      }

      // Max iterations reached
      const maxIterResult: WorkflowCompletionResult = {
        success: false,
        response: 'Maximum iterations reached without completing the task.',
        iterations: maxIterations,
        toolsUsed: Array.from(toolsUsed),
        totalDurationMs: Date.now() - startTime,
        tokenUsage: {
          input: totalTokens.input,
          output: totalTokens.output,
          total: totalTokens.input + totalTokens.output,
          ...(totalTokens.cached && { cached: totalTokens.cached }),
          ...(totalTokens.reasoning && { reasoning: totalTokens.reasoning }),
          ...(totalTokens.costUsd && { costUsd: totalTokens.costUsd }),
        },
        error: 'Max iterations exceeded',
        debugContext: { steps: debugSteps },
      };

      await step.do('report-max-iterations', async () => {
        await this.reportCompletion(progressCallback, maxIterResult);
      });

      return maxIterResult;
    } catch (error) {
      // Handle fatal errors
      const errorMessage = error instanceof Error ? error.message : String(error);

      const errorResult: WorkflowCompletionResult = {
        success: false,
        response: `Error during execution: ${errorMessage}`,
        iterations: iteration + 1,
        toolsUsed: Array.from(toolsUsed),
        totalDurationMs: Date.now() - startTime,
        tokenUsage: {
          input: totalTokens.input,
          output: totalTokens.output,
          total: totalTokens.input + totalTokens.output,
          ...(totalTokens.cached && { cached: totalTokens.cached }),
          ...(totalTokens.reasoning && { reasoning: totalTokens.reasoning }),
          ...(totalTokens.costUsd && { costUsd: totalTokens.costUsd }),
        },
        error: errorMessage,
        debugContext: { steps: debugSteps },
      };

      // Try to report error (best effort)
      try {
        await step.do('report-error', async () => {
          await this.reportCompletion(progressCallback, errorResult);
        });
      } catch {
        // Ignore reporting errors
      }

      // Re-throw non-retryable errors
      if (error instanceof NonRetryableError) {
        throw error;
      }

      return errorResult;
    }
  }

  // ============================================================================
  // LLM Calling
  // ============================================================================

  /**
   * Call LLM with the current conversation via Cloudflare AI Gateway
   *
   * This implementation mirrors `@duyetbot/providers` (createOpenRouterProvider)
   * but is inlined here to avoid circular dependency:
   * - providers imports types from cloudflare-agent
   * - cloudflare-agent cannot import from providers
   *
   * The AI Gateway URL is constructed via env.AI.gateway().getUrl() and
   * uses BYOK authentication with cf-aig-authorization header.
   *
   * @see https://developers.cloudflare.com/ai-gateway/
   * @see https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
   */
  private async callLLM(
    env: AgenticLoopWorkflowEnv,
    systemPrompt: string | undefined,
    messages: LoopMessage[],
    tools: LoopTool[],
    _traceId: string
  ): Promise<WorkflowLLMResponse> {
    // Validate required configuration
    if (!env.AI_GATEWAY_NAME) {
      throw new NonRetryableError('AI_GATEWAY_NAME is required for workflow execution');
    }
    if (!env.AI_GATEWAY_API_KEY) {
      throw new NonRetryableError('AI_GATEWAY_API_KEY is required for workflow execution');
    }

    const model = env.MODEL || 'anthropic/claude-sonnet-4';

    // Format messages for OpenAI-compatible API
    const llmMessages = [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      ...messages.map((m) => {
        if (m.role === 'tool_result') {
          return {
            role: 'tool' as const,
            content: m.content,
            tool_call_id: m.toolCallId || 'unknown',
          };
        }
        if (m.role === 'assistant' && m.toolCalls) {
          return {
            role: 'assistant' as const,
            content: m.content,
            tool_calls: m.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments),
              },
            })),
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }),
    ];

    // Format tools for OpenAI-compatible API
    const openAITools = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // Get AI Gateway URL for OpenRouter (same pattern as @duyetbot/providers)
    const gatewayUrl = await env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
    const url = `${gatewayUrl}/chat/completions`;

    console.log('[AgenticLoopWorkflow] Calling AI Gateway', {
      gateway: env.AI_GATEWAY_NAME,
      model,
      messageCount: llmMessages.length,
      hasTools: openAITools.length > 0,
    });

    // Build request body
    const body = {
      model,
      messages: llmMessages,
      max_tokens: 4096,
      ...(openAITools.length > 0 && {
        tools: openAITools,
        tool_choice: 'auto',
      }),
    };

    // Call OpenRouter via AI Gateway with BYOK authentication
    // Uses cf-aig-authorization header (same pattern as @duyetbot/providers)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `AI Gateway error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id?: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
      error?: { message: string };
    };

    // Check for API-level error in response body
    if (data.error) {
      throw new Error(data.error.message || 'Unknown AI Gateway error');
    }

    const choice = data.choices?.[0]?.message;
    if (!choice) {
      throw new Error('No response from AI Gateway');
    }

    // Extract tool calls (filter to function type, generate fallback ID if missing)
    const toolCalls: WorkflowToolCall[] | undefined = choice.tool_calls
      ?.filter((tc) => tc.type === 'function')
      .map((tc, index) => ({
        id: tc.id || `tool_call_${Date.now()}_${index}`,
        name: tc.function.name,
        arguments: this.safeParseJSON(tc.function.arguments),
      }));

    return {
      content: choice.content || '',
      ...(toolCalls && toolCalls.length > 0 && { toolCalls }),
      ...(data.usage && {
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
        },
      }),
    };
  }

  // ============================================================================
  // Tool Execution
  // ============================================================================

  /**
   * Execute tool calls in parallel
   */
  private async executeTools(
    toolCalls: WorkflowToolCall[],
    tools: LoopTool[],
    progressCallback: ProgressCallbackConfig,
    iteration: number,
    _isSubagent: boolean,
    traceId: string
  ): Promise<
    Array<{
      toolCallId: string;
      toolName: string;
      content: string;
      success: boolean;
      durationMs: number;
      args: JsonRecord;
      error?: string;
    }>
  > {
    // Track parallel tools and their states
    const parallelToolsMap = new Map<
      string,
      {
        id: string;
        name: string;
        argsStr: string;
        result?: {
          status: 'completed' | 'error';
          summary: string;
          durationMs?: number;
        };
      }
    >();

    // Initialize map with all tools
    for (const tc of toolCalls) {
      parallelToolsMap.set(tc.id, {
        id: tc.id,
        name: tc.name,
        argsStr: this.formatToolArgs(tc.arguments),
      });
    }

    // Report parallel tools start (only if multiple tools)
    if (toolCalls.length > 1) {
      await this.reportProgress(progressCallback, {
        type: 'parallel_tools_start',
        iteration,
        message: `⏺ Running ${toolCalls.length} tools in parallel...`,
        parallelTools: Array.from(parallelToolsMap.values()),
        timestamp: Date.now(),
      });
    }

    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const startTime = Date.now();

        // Report tool start (only for single tools, parallel is reported above)
        if (toolCalls.length === 1) {
          await this.reportProgress(progressCallback, {
            type: 'tool_start',
            iteration,
            message: `🔧 Running ${tc.name}...`,
            toolName: tc.name,
            toolArgs: tc.arguments,
            timestamp: Date.now(),
          });
        }

        // Find tool
        const tool = tools.find((t) => t.name === tc.name);
        if (!tool) {
          const durationMs = Date.now() - startTime;

          // Update parallel tools map
          parallelToolsMap.set(tc.id, {
            ...parallelToolsMap.get(tc.id)!,
            result: {
              status: 'error',
              summary: 'Tool not found',
              durationMs,
            },
          });

          // Report error
          if (toolCalls.length === 1) {
            await this.reportProgress(progressCallback, {
              type: 'tool_error',
              iteration,
              message: `❌ Tool ${tc.name} not found`,
              toolName: tc.name,
              toolArgs: tc.arguments,
              toolResult: 'Tool not found',
              durationMs,
              timestamp: Date.now(),
            });
          } else {
            await this.reportProgress(progressCallback, {
              type: 'parallel_tool_complete',
              iteration,
              message: `Tool ${tc.name} error`,
              toolCallId: tc.id,
              toolName: tc.name,
              durationMs,
              parallelTools: Array.from(parallelToolsMap.values()),
              timestamp: Date.now(),
            });
          }

          return {
            toolCallId: tc.id,
            toolName: tc.name,
            content: `Error: Tool '${tc.name}' not found`,
            success: false,
            durationMs,
            args: tc.arguments,
            error: 'Tool not found',
          };
        }

        // Execute tool
        try {
          // Build minimal context for tool execution
          const toolContext = {
            platform: 'workflow' as const,
            traceId,
            env: this.env,
          };

          const result = await tool.execute(
            tc.arguments,
            toolContext as unknown as Parameters<typeof tool.execute>[1]
          );
          const durationMs = Date.now() - startTime;

          // Update parallel tools map
          const summary = this.summarizeToolResult(result.output);
          parallelToolsMap.set(tc.id, {
            ...parallelToolsMap.get(tc.id)!,
            result: {
              status: 'completed',
              summary,
              durationMs,
            },
          });

          // Report success
          if (toolCalls.length === 1) {
            await this.reportProgress(progressCallback, {
              type: 'tool_complete',
              iteration,
              message: `✅ ${tc.name} completed (${durationMs}ms)`,
              toolName: tc.name,
              toolArgs: tc.arguments,
              toolResult: result.output,
              durationMs,
              timestamp: Date.now(),
            });
          } else {
            await this.reportProgress(progressCallback, {
              type: 'parallel_tool_complete',
              iteration,
              message: `Tool ${tc.name} completed`,
              toolCallId: tc.id,
              toolName: tc.name,
              durationMs,
              parallelTools: Array.from(parallelToolsMap.values()),
              timestamp: Date.now(),
            });
          }

          return {
            toolCallId: tc.id,
            toolName: tc.name,
            content: result.output,
            success: result.success,
            durationMs,
            args: tc.arguments,
            ...(result.error && { error: result.error }),
          };
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Update parallel tools map
          parallelToolsMap.set(tc.id, {
            ...parallelToolsMap.get(tc.id)!,
            result: {
              status: 'error',
              summary: errorMessage,
              durationMs,
            },
          });

          // Report error
          if (toolCalls.length === 1) {
            await this.reportProgress(progressCallback, {
              type: 'tool_error',
              iteration,
              message: `❌ ${tc.name} failed: ${errorMessage}`,
              toolName: tc.name,
              toolArgs: tc.arguments,
              toolResult: errorMessage,
              durationMs,
              timestamp: Date.now(),
            });
          } else {
            await this.reportProgress(progressCallback, {
              type: 'parallel_tool_complete',
              iteration,
              message: `Tool ${tc.name} error`,
              toolCallId: tc.id,
              toolName: tc.name,
              durationMs,
              parallelTools: Array.from(parallelToolsMap.values()),
              timestamp: Date.now(),
            });
          }

          return {
            toolCallId: tc.id,
            toolName: tc.name,
            content: `Error: ${errorMessage}`,
            success: false,
            durationMs,
            args: tc.arguments,
            error: errorMessage,
          };
        }
      })
    );

    return results;
  }

  // ============================================================================
  // Progress Reporting
  // ============================================================================

  /**
   * Get the platform-specific DO binding based on namespace
   *
   * The workflow uses cross-script bindings to call back to the originating
   * app's CloudflareAgent (TelegramAgent or GitHubAgent).
   */
  private getAgentBinding(namespace: string): {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => { fetch: (req: Request) => Promise<Response> };
  } | null {
    // Map namespace to binding name
    switch (namespace) {
      case 'TelegramAgent':
        return this.env.TelegramAgent || null;
      case 'GitHubAgent':
        return this.env.GitHubAgent || null;
      default:
        console.warn(`[AgenticLoopWorkflow] Unknown agent namespace: ${namespace}`);
        return null;
    }
  }

  /**
   * Report progress to CloudflareAgent DO
   *
   * Calls the DO's /workflow-progress endpoint to update the thinking message.
   * Progress reporting is best-effort - failures won't stop the workflow.
   */
  private async reportProgress(
    callback: ProgressCallbackConfig,
    update: WorkflowProgressUpdate
  ): Promise<void> {
    try {
      console.log('[AgenticLoopWorkflow] Progress:', {
        executionId: callback.executionId,
        namespace: callback.doNamespace,
        type: update.type,
        iteration: update.iteration,
        message: update.message,
      });

      // Get platform-specific DO binding
      const doBinding = this.getAgentBinding(callback.doNamespace);
      if (!doBinding) {
        console.warn(`[AgenticLoopWorkflow] ${callback.doNamespace} DO binding not available`);
        return;
      }

      // Get DO stub using the stored ID
      const doId = doBinding.idFromName(callback.doId);
      const doStub = doBinding.get(doId);

      // Call DO's progress endpoint
      const response = await doStub.fetch(
        new Request('https://internal/workflow-progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            executionId: callback.executionId,
            update,
          }),
        })
      );

      if (!response.ok) {
        console.warn('[AgenticLoopWorkflow] Progress update failed:', response.status);
      }
    } catch (error) {
      // Progress reporting is best-effort, don't fail the workflow
      console.error('[AgenticLoopWorkflow] Failed to report progress:', error);
    }
  }

  /**
   * Report completion to CloudflareAgent DO
   *
   * Calls the DO's /workflow-complete endpoint to deliver the final response.
   * The DO will edit the thinking message with the final response text.
   */
  private async reportCompletion(
    callback: ProgressCallbackConfig,
    result: WorkflowCompletionResult
  ): Promise<void> {
    try {
      console.log('[AgenticLoopWorkflow] Completion:', {
        executionId: callback.executionId,
        namespace: callback.doNamespace,
        success: result.success,
        iterations: result.iterations,
        toolsUsed: result.toolsUsed,
        durationMs: result.totalDurationMs,
      });

      // Get platform-specific DO binding
      const doBinding = this.getAgentBinding(callback.doNamespace);
      if (!doBinding) {
        console.error(
          `[AgenticLoopWorkflow] ${callback.doNamespace} DO binding not available - cannot deliver response`
        );
        return;
      }

      // Get DO stub using the stored ID
      const doId = doBinding.idFromName(callback.doId);
      const doStub = doBinding.get(doId);

      // Call DO's completion endpoint
      const response = await doStub.fetch(
        new Request('https://internal/workflow-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            executionId: callback.executionId,
            result,
          }),
        })
      );

      if (response.ok) {
        console.log('[AgenticLoopWorkflow] Response delivered successfully');
      } else {
        const errorText = await response.text();
        console.error(
          '[AgenticLoopWorkflow] Completion delivery failed:',
          response.status,
          errorText
        );
      }
    } catch (error) {
      console.error('[AgenticLoopWorkflow] Failed to report completion:', error);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Safely parse JSON arguments
   */
  private safeParseJSON(str: string): JsonRecord {
    try {
      return JSON.parse(str) as JsonRecord;
    } catch {
      return { raw: str };
    }
  }

  /**
   * Format tool arguments for display in parallel tools view
   */
  private formatToolArgs(args: JsonRecord): string {
    if (Object.keys(args).length === 0) {
      return '';
    }

    const pairs = Object.entries(args)
      .map(([key, value]) => {
        if (typeof value === 'string') {
          const truncated = value.length > 50 ? `${value.slice(0, 47)}...` : value;
          return `${key}: "${truncated}"`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      })
      .slice(0, 2); // Show max 2 args

    if (Object.keys(args).length > 2) {
      pairs.push(`...`);
    }

    return pairs.join(', ');
  }

  /**
   * Summarize tool result for display in parallel tools view
   */
  private summarizeToolResult(output: string): string {
    if (!output) {
      return 'No output';
    }

    // Truncate to first 60 chars or first sentence
    const firstSentence = output.split('\n')[0] || output;
    if (firstSentence.length > 60) {
      return `${firstSentence.slice(0, 60)}...`;
    }

    return firstSentence;
  }
}
