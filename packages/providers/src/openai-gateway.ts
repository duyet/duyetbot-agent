/**
 * OpenAI SDK Provider for Cloudflare AI Gateway
 *
 * Alternative LLM provider using OpenAI SDK to call LLMs through
 * Cloudflare AI Gateway's OpenRouter endpoint.
 *
 * Key features:
 * - Uses OpenAI SDK for type-safe API calls
 * - Supports automatic tool calling loop via runTools()
 * - Routes through Cloudflare AI Gateway for caching/logging
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/
 */

import OpenAI from 'openai';
import type { RunnableToolFunctionWithParse } from 'openai/lib/RunnableFunction';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { LLMMessage, LLMProvider, LLMResponse, OpenAITool } from '@duyetbot/chat-agent';
import type { Tool } from '@duyetbot/types';

/**
 * Cloudflare AI binding interface for AI Gateway URL generation
 *
 * The getUrl() method returns a Promise<string> in the actual Cloudflare runtime.
 */
export interface CloudflareAIBinding {
  gateway: (gatewayId: string) => {
    getUrl: (provider: string) => Promise<string>;
  };
}

/**
 * Environment bindings required for OpenAI Gateway provider
 *
 * Two modes supported:
 * 1. With AI binding: Uses env.AI.gateway().getUrl() for URL construction (recommended)
 * 2. Without AI binding: Requires AI_GATEWAY_ACCOUNT_ID for manual URL construction
 */
export interface OpenAIGatewayEnv {
  /** Cloudflare AI binding - if provided, uses gateway().getUrl() for URL construction */
  AI?: CloudflareAIBinding;
  /** Cloudflare account ID - required if AI binding not available */
  AI_GATEWAY_ACCOUNT_ID?: string;
  /** Gateway name configured in Cloudflare dashboard */
  AI_GATEWAY_NAME: string;
  /** OpenRouter API key */
  OPENROUTER_API_KEY: string;
  /** Model to use (e.g., 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o') */
  MODEL?: string;
}

/**
 * Configuration options for OpenAI Gateway provider
 */
export interface OpenAIGatewayProviderOptions {
  /** Default model if not specified in env */
  defaultModel?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Request timeout in milliseconds */
  requestTimeout?: number;
  /** Custom logger */
  logger?: {
    info: (message: string, data?: Record<string, unknown>) => void;
    error: (message: string, data?: Record<string, unknown>) => void;
    debug?: (message: string, data?: Record<string, unknown>) => void;
  };
}

/**
 * Callbacks for tool execution events
 */
export interface ToolCallbacks {
  /** Called when a tool is about to be executed */
  onToolCall?: (name: string, args: unknown) => void;
  /** Called after a tool completes */
  onToolResult?: (name: string, result: string) => void;
}

/**
 * Extended LLM provider interface with runTools support
 */
export interface OpenAIGatewayProvider extends LLMProvider {
  /**
   * Chat with automatic tool calling loop using OpenAI SDK's runTools()
   *
   * Unlike chat(), this method:
   * - Accepts tools with their execute functions
   * - Automatically handles tool call → result → LLM iteration
   * - Returns final response after all tools complete
   *
   * @param messages - Conversation history
   * @param tools - Tools with execute functions attached
   * @param callbacks - Optional callbacks for tool events
   * @returns Final response after tool loop completes
   */
  chatWithTools(
    messages: LLMMessage[],
    tools: Tool[],
    callbacks?: ToolCallbacks
  ): Promise<LLMResponse>;
}

/**
 * Convert @duyetbot/types Tool to OpenAI RunnableToolFunction
 *
 * This bridges the gap between our Tool interface (Zod schema + execute)
 * and OpenAI SDK's expected format for runTools().
 */
export function toolToRunnableFunction<TInput extends Record<string, unknown>>(
  tool: Tool
): RunnableToolFunctionWithParse<TInput> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema) as Record<string, unknown>,
      // Parse function to validate/parse tool arguments
      parse: (args: string): TInput => {
        const parsed = JSON.parse(args);
        // Validate against Zod schema
        return tool.inputSchema.parse(parsed) as TInput;
      },
      // Execute function called by runTools()
      function: async (args: TInput): Promise<string> => {
        const result = await tool.execute({
          content: args as Record<string, unknown>,
        });
        // Return string result for LLM
        if (typeof result.content === 'string') {
          return result.content;
        }
        return JSON.stringify(result.content);
      },
    },
  };
}

/**
 * Convert LLMMessage to OpenAI ChatCompletionMessageParam
 */
function toOpenAIMessage(msg: LLMMessage): ChatCompletionMessageParam {
  if (msg.role === 'tool') {
    return {
      role: 'tool',
      content: msg.content,
      tool_call_id: msg.tool_call_id || '',
    };
  }

  if (msg.role === 'assistant') {
    return {
      role: 'assistant',
      content: msg.content,
    };
  }

  if (msg.role === 'system') {
    return {
      role: 'system',
      content: msg.content,
    };
  }

  // Default: user message
  return {
    role: 'user',
    content: msg.content,
  };
}

/**
 * Create an LLM provider using OpenAI SDK with Cloudflare AI Gateway
 *
 * @example
 * ```typescript
 * const provider = createOpenAIGatewayProvider({
 *   AI_GATEWAY_ACCOUNT_ID: 'abc123',
 *   AI_GATEWAY_NAME: 'my-gateway',
 *   OPENROUTER_API_KEY: 'sk-or-xxx',
 *   MODEL: 'anthropic/claude-3.5-sonnet',
 * });
 *
 * // Simple chat
 * const response = await provider.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 *
 * // Chat with automatic tool loop
 * const response = await provider.chatWithTools(
 *   [{ role: 'user', content: 'What is the weather?' }],
 *   [weatherTool],
 *   { onToolCall: (name, args) => console.log(`Calling ${name}`) }
 * );
 * ```
 */
export function createOpenAIGatewayProvider(
  env: OpenAIGatewayEnv,
  options: OpenAIGatewayProviderOptions = {}
): OpenAIGatewayProvider {
  const {
    defaultModel = 'anthropic/claude-3.5-sonnet',
    maxTokens = 4096,
    requestTimeout = 60000,
    logger = console,
  } = options;

  const model = env.MODEL || defaultModel;

  // Lazy-initialized client - resolves async URL on first use
  let clientPromise: Promise<OpenAI> | null = null;

  const getClient = async (): Promise<OpenAI> => {
    if (!clientPromise) {
      clientPromise = (async () => {
        // Build AI Gateway URL for OpenRouter
        // Prefer: env.AI.gateway().getUrl() (Cloudflare native, always up-to-date)
        // Fallback: Manual URL construction (for testing or non-Workers environments)
        let baseURL: string;
        if (env.AI?.gateway) {
          // Use Cloudflare AI binding for URL construction (recommended)
          baseURL = await env.AI.gateway(env.AI_GATEWAY_NAME).getUrl('openrouter');
        } else if (env.AI_GATEWAY_ACCOUNT_ID) {
          // Fallback: Manual URL construction
          baseURL = `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/openrouter`;
        } else {
          throw new Error(
            'OpenAI Gateway provider requires either AI binding or AI_GATEWAY_ACCOUNT_ID'
          );
        }

        return new OpenAI({
          apiKey: env.OPENROUTER_API_KEY,
          baseURL,
          timeout: requestTimeout,
        });
      })();
    }
    return clientPromise;
  };

  return {
    /**
     * Standard chat method (LLMProvider interface)
     *
     * Returns tool calls for external handling - compatible with
     * existing cloudflare-agent.ts manual loop.
     */
    async chat(messages: LLMMessage[], tools?: OpenAITool[]): Promise<LLMResponse> {
      const openAIMessages = messages.map(toOpenAIMessage);

      logger.info?.('OpenAI Gateway chat request', {
        model,
        messageCount: messages.length,
        hasTools: !!tools?.length,
      });

      const startTime = Date.now();

      try {
        const client = await getClient();
        const response = await client.chat.completions.create({
          model,
          messages: openAIMessages,
          max_tokens: maxTokens,
          ...(tools?.length && {
            tools,
            tool_choice: 'auto' as const,
          }),
        });

        const choice = response.choices[0]?.message;

        // Extract tool calls if present (filter to function type only)
        const toolCalls = choice?.tool_calls
          ?.filter(
            (
              tc
            ): tc is OpenAI.Chat.Completions.ChatCompletionMessageToolCall & {
              type: 'function';
            } => tc.type === 'function'
          )
          .map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          }));

        logger.info?.('OpenAI Gateway chat completed', {
          model,
          durationMs: Date.now() - startTime,
          hasContent: !!choice?.content,
          toolCallCount: toolCalls?.length || 0,
        });

        return {
          content: choice?.content || '',
          ...(toolCalls?.length && { toolCalls }),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error?.('OpenAI Gateway chat error', {
          model,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`OpenAI Gateway error: ${errorMessage}`);
      }
    },

    /**
     * Chat with automatic tool calling loop using runTools()
     *
     * The OpenAI SDK handles the entire loop:
     * 1. Call LLM with tools
     * 2. If LLM returns tool_calls, execute the tool functions
     * 3. Send tool results back to LLM
     * 4. Repeat until LLM returns final text response
     */
    async chatWithTools(
      messages: LLMMessage[],
      tools: Tool[],
      callbacks?: ToolCallbacks
    ): Promise<LLMResponse> {
      const openAIMessages = messages.map(toOpenAIMessage);

      // Convert our tools to OpenAI's RunnableToolFunction format
      const runnableTools = tools.map((tool) =>
        toolToRunnableFunction<Record<string, unknown>>(tool)
      );

      logger.info?.('OpenAI Gateway chatWithTools started', {
        model,
        messageCount: messages.length,
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
      });

      const startTime = Date.now();

      try {
        const client = await getClient();
        const runner = client.chat.completions
          .runTools({
            model,
            messages: openAIMessages,
            tools: runnableTools,
            max_tokens: maxTokens,
          })
          .on('functionToolCall', (call) => {
            logger.debug?.('Tool called', {
              name: call.name,
              arguments: call.arguments,
            });
            try {
              callbacks?.onToolCall?.(call.name, JSON.parse(call.arguments));
            } catch {
              callbacks?.onToolCall?.(call.name, call.arguments);
            }
          })
          .on('functionToolCallResult', (result) => {
            logger.debug?.('Tool result', { result: result.substring(0, 200) });
            // Note: functionToolCallResult doesn't include name in newer SDK
            callbacks?.onToolResult?.('tool', result);
          });

        const completion = await runner.finalChatCompletion();

        logger.info?.('OpenAI Gateway chatWithTools completed', {
          model,
          durationMs: Date.now() - startTime,
          messageCount: runner.messages.length,
          hasContent: !!completion.choices[0]?.message?.content,
        });

        return {
          content: completion.choices[0]?.message?.content || '',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error?.('OpenAI Gateway chatWithTools error', {
          model,
          error: errorMessage,
          durationMs: Date.now() - startTime,
        });
        throw new Error(`OpenAI Gateway runTools error: ${errorMessage}`);
      }
    },
  };
}
