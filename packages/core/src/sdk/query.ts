/**
 * SDK Query Function
 *
 * Main entry point for agent execution using Claude Agent SDK patterns
 */

import Anthropic from '@anthropic-ai/sdk';
import type { QueryOptions } from './options.js';
import { createDefaultOptions, validateOptions } from './options.js';
import type {
  QueryController,
  QueryInput,
  SDKAnyMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKTool,
  SDKToolResultMessage,
  SDKToolUseMessage,
  SDKUserMessage,
} from './types.js';

/**
 * Query execution state
 */
interface QueryState {
  sessionId: string;
  messages: SDKAnyMessage[];
  anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }>;
  isComplete: boolean;
  aborted: boolean;
  inputTokens: number;
  outputTokens: number;
  startTime: number;
}

/**
 * Content block types for Anthropic API
 */
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Create a query controller for interruption
 */
export function createQueryController(): QueryController {
  const abortController = new AbortController();
  return {
    interrupt: () => abortController.abort(),
    signal: abortController.signal,
  };
}

/**
 * Execute a query and stream responses
 *
 * This is the main entry point for agent execution. It accepts either
 * a string prompt or an async iterable for streaming input.
 *
 * @example
 * ```typescript
 * // Simple string query
 * for await (const message of query('Hello, world!', options)) {
 *   console.log(message);
 * }
 *
 * // Streaming input
 * async function* streamInput() {
 *   yield { type: 'user', content: 'Part 1...' };
 *   yield { type: 'user', content: 'Part 2...' };
 * }
 * for await (const message of query(streamInput(), options)) {
 *   console.log(message);
 * }
 * ```
 */
export async function* query(
  input: QueryInput,
  options?: QueryOptions,
  controller?: QueryController
): AsyncGenerator<SDKAnyMessage, void, unknown> {
  // Merge with defaults
  const opts = createDefaultOptions(options);

  // Validate options
  const validation = validateOptions(opts);
  if (!validation.valid) {
    yield {
      type: 'system',
      content: `Invalid options: ${validation.errors.join(', ')}`,
    };
    return;
  }

  // Generate session ID if not provided
  const sessionId = opts.sessionId || opts.resume || generateSessionId();

  // Initialize state
  const state: QueryState = {
    sessionId,
    messages: [],
    anthropicMessages: [],
    isComplete: false,
    aborted: false,
    inputTokens: 0,
    outputTokens: 0,
    startTime: Date.now(),
  };

  // Handle abort signal
  if (controller?.signal) {
    controller.signal.addEventListener('abort', () => {
      state.aborted = true;
    });
  }

  try {
    // Convert input to messages
    const userMessages = await collectInput(input);

    // Emit user messages and build anthropic messages
    for (const message of userMessages) {
      const userMessage: SDKUserMessage = {
        type: 'user',
        sessionId,
        content: message,
        uuid: generateUUID(),
      };
      state.messages.push(userMessage);
      state.anthropicMessages.push({ role: 'user', content: message });
      yield userMessage;
    }

    // Check for abort
    if (state.aborted) {
      yield createInterruptMessage(sessionId);
      return;
    }

    // Execute agent loop
    let iteration = 0;
    const maxIterations = 100; // Prevent infinite loops

    while (!state.isComplete && iteration < maxIterations) {
      iteration++;

      // Check for abort
      if (state.aborted) {
        yield createInterruptMessage(sessionId);
        return;
      }

      // Generate assistant response with retry
      const { response, toolCalls } = await generateResponseWithRetry(state, opts);

      // Emit assistant message
      yield response;
      state.messages.push(response);

      // Check if we need to execute tools
      if (response.stopReason === 'tool_use' && toolCalls.length > 0) {
        // Build content blocks for anthropic message
        const assistantContent: ContentBlock[] = [];

        // Add text if present
        if (response.content) {
          assistantContent.push({ type: 'text', text: response.content });
        }

        // Add tool use blocks
        for (const toolCall of toolCalls) {
          assistantContent.push({
            type: 'tool_use',
            id: toolCall.toolUseId,
            name: toolCall.toolName,
            input: toolCall.toolInput,
          });
        }

        state.anthropicMessages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and yield results
        const toolResults = await executeTools(toolCalls, opts);
        const toolResultContent: ContentBlock[] = [];

        for (const result of toolResults) {
          yield result;
          state.messages.push(result);
          const toolResultBlock: ContentBlock = {
            type: 'tool_result',
            tool_use_id: result.toolUseId,
            content: result.content,
          };
          if (result.isError) {
            toolResultBlock.is_error = result.isError;
          }
          toolResultContent.push(toolResultBlock);
        }

        // Add tool results as user message for next turn
        state.anthropicMessages.push({ role: 'user', content: toolResultContent });
      } else if (response.stopReason === 'end_turn') {
        // Add final assistant message
        state.anthropicMessages.push({ role: 'assistant', content: response.content });
        state.isComplete = true;
      } else if (response.stopReason === 'max_tokens') {
        // Continue generation - add partial response
        state.anthropicMessages.push({ role: 'assistant', content: response.content });
      } else if (response.stopReason === 'interrupt') {
        state.isComplete = true;
      }
    }

    // Emit result message
    const duration = Date.now() - state.startTime;
    const resultMessage: SDKResultMessage = {
      type: 'result',
      sessionId,
      content: getLastAssistantContent(state),
      uuid: generateUUID(),
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      totalTokens: state.inputTokens + state.outputTokens,
      duration,
    };
    yield resultMessage;
  } catch (error) {
    // Emit error as system message
    const errorMessage = error instanceof Error ? error.message : String(error);
    yield {
      type: 'system',
      sessionId,
      content: `Error: ${errorMessage}`,
      uuid: generateUUID(),
    };
  }
}

/**
 * Single-mode query execution (non-streaming)
 *
 * @example
 * ```typescript
 * const result = await querySingle('What is 2+2?', options);
 * console.log(result.content);
 * ```
 */
export async function querySingle(
  input: string,
  options?: QueryOptions
): Promise<SDKResultMessage> {
  let result: SDKResultMessage | undefined;

  for await (const message of query(input, options)) {
    if (message.type === 'result') {
      result = message;
    }
  }

  if (!result) {
    throw new Error('Query did not produce a result');
  }

  return result;
}

/**
 * Collect all messages to display during streaming
 */
export async function collectMessages(
  input: QueryInput,
  options?: QueryOptions
): Promise<SDKAnyMessage[]> {
  const messages: SDKAnyMessage[] = [];

  for await (const message of query(input, options)) {
    messages.push(message);
  }

  return messages;
}

// Helper functions

async function collectInput(input: QueryInput): Promise<string[]> {
  if (typeof input === 'string') {
    return [input];
  }

  const messages: string[] = [];
  for await (const message of input) {
    messages.push(message.content);
  }
  return messages;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function createInterruptMessage(sessionId: string): SDKAssistantMessage {
  return {
    type: 'assistant',
    sessionId,
    content: 'Query interrupted by user',
    stopReason: 'interrupt',
    uuid: generateUUID(),
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const delay = Math.min(config.baseDelayMs * 2 ** attempt, config.maxDelayMs);
  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) {
    // Retry on rate limits, server errors, and timeouts
    return (
      error.status === 429 || // Rate limit
      error.status === 500 || // Server error
      error.status === 502 || // Bad gateway
      error.status === 503 || // Service unavailable
      error.status === 504 // Gateway timeout
    );
  }

  // Retry on network errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused')
    );
  }

  return false;
}

/**
 * Generate response with retry logic
 */
async function generateResponseWithRetry(
  state: QueryState,
  opts: QueryOptions,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<{ response: SDKAssistantMessage; toolCalls: SDKToolUseMessage[] }> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await generateResponse(state, opts);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error) || attempt === retryConfig.maxRetries) {
        throw lastError;
      }

      const delay = calculateBackoff(attempt, retryConfig);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Unknown error during response generation');
}

/**
 * Map model shorthand to full model ID
 */
function mapModelToId(model: string): string {
  const modelMap: Record<string, string> = {
    haiku: 'claude-3-5-haiku-20241022',
    sonnet: 'claude-sonnet-4-20250514',
    opus: 'claude-3-opus-20240229',
  };
  return modelMap[model] || model;
}

/**
 * Generate response using Anthropic API
 */
async function generateResponse(
  state: QueryState,
  opts: QueryOptions
): Promise<{ response: SDKAssistantMessage; toolCalls: SDKToolUseMessage[] }> {
  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseURL = process.env.ANTHROPIC_BASE_URL;

  if (!apiKey) {
    // Return placeholder if no API key (for testing)
    return {
      response: {
        type: 'assistant',
        sessionId: state.sessionId,
        content: 'Response placeholder - set ANTHROPIC_API_KEY to enable LLM',
        stopReason: 'end_turn',
        uuid: generateUUID(),
      },
      toolCalls: [],
    };
  }

  // Create Anthropic client
  const clientOptions: { apiKey: string; baseURL?: string; timeout?: number } = {
    apiKey,
  };
  if (baseURL) {
    clientOptions.baseURL = baseURL;
  }
  if (opts.timeout) {
    clientOptions.timeout = opts.timeout;
  }

  const client = new Anthropic(clientOptions);

  // Build tools for API
  const tools = opts.tools?.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema._def
      ? zodToJsonSchema(tool.inputSchema)
      : { type: 'object' as const },
  }));

  // Map model
  const model = mapModelToId(opts.model || 'sonnet');

  // Build request params
  const requestParams: Anthropic.MessageCreateParams = {
    model,
    max_tokens: opts.maxTokens || 8192,
    messages: state.anthropicMessages as Anthropic.MessageParam[],
  };

  // Only add optional params if defined
  if (opts.temperature !== undefined) {
    requestParams.temperature = opts.temperature;
  }
  if (opts.systemPrompt) {
    requestParams.system = opts.systemPrompt;
  }
  if (tools && tools.length > 0) {
    requestParams.tools = tools as Anthropic.Tool[];
  }

  // Create request
  const response = await client.messages.create(requestParams);

  // Update token counts
  state.inputTokens += response.usage.input_tokens;
  state.outputTokens += response.usage.output_tokens;

  // Extract content and tool calls
  let textContent = '';
  const toolCalls: SDKToolUseMessage[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textContent += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        type: 'tool_use',
        sessionId: state.sessionId,
        toolName: block.name,
        toolInput: block.input,
        toolUseId: block.id,
        uuid: generateUUID(),
      });
    }
  }

  // Map stop reason
  let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'interrupt';
  switch (response.stop_reason) {
    case 'tool_use':
      stopReason = 'tool_use';
      break;
    case 'max_tokens':
      stopReason = 'max_tokens';
      break;
    default:
      stopReason = 'end_turn';
  }

  return {
    response: {
      type: 'assistant',
      sessionId: state.sessionId,
      content: textContent,
      stopReason,
      uuid: generateUUID(),
    },
    toolCalls,
  };
}

/**
 * Execute tools and return results
 */
async function executeTools(
  toolCalls: SDKToolUseMessage[],
  opts: QueryOptions
): Promise<SDKToolResultMessage[]> {
  const results: SDKToolResultMessage[] = [];
  const toolMap = new Map<string, SDKTool>();

  // Build tool map
  if (opts.tools) {
    for (const tool of opts.tools) {
      toolMap.set(tool.name, tool);
    }
  }

  // Execute each tool
  for (const toolCall of toolCalls) {
    const tool = toolMap.get(toolCall.toolName);

    if (!tool) {
      results.push({
        type: 'tool_result',
        toolUseId: toolCall.toolUseId,
        content: `Tool not found: ${toolCall.toolName}`,
        isError: true,
        uuid: generateUUID(),
      });
      continue;
    }

    try {
      // Validate input
      const validatedInput = tool.inputSchema.parse(toolCall.toolInput);

      // Execute handler
      const result = await tool.handler(validatedInput);

      // Format result
      let content: string;
      let isError = false;

      if (typeof result === 'string') {
        content = result;
      } else if (result && typeof result === 'object') {
        if ('content' in result) {
          content = String(result.content);
          isError = 'isError' in result ? Boolean(result.isError) : false;
        } else {
          content = JSON.stringify(result, null, 2);
        }
      } else {
        content = String(result);
      }

      results.push({
        type: 'tool_result',
        toolUseId: toolCall.toolUseId,
        content,
        isError,
        uuid: generateUUID(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        type: 'tool_result',
        toolUseId: toolCall.toolUseId,
        content: `Error executing tool: ${errorMessage}`,
        isError: true,
        uuid: generateUUID(),
      });
    }
  }

  return results;
}

function getLastAssistantContent(state: QueryState): string {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const message = state.messages[i];
    if (message && message.type === 'assistant' && message.content) {
      return message.content;
    }
  }
  return '';
}

/**
 * Convert Zod schema to JSON Schema (simplified)
 */
function zodToJsonSchema(schema: unknown): Record<string, unknown> {
  // Simple conversion - in production use zod-to-json-schema package
  const zodSchema = schema as {
    _def?: { typeName?: string; shape?: () => Record<string, unknown> };
  };

  if (zodSchema._def?.typeName === 'ZodObject') {
    const shape = zodSchema._def.shape?.() || {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value);
      const fieldDef = value as { _def?: { typeName?: string } };
      if (fieldDef._def?.typeName !== 'ZodOptional') {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  if (zodSchema._def?.typeName === 'ZodString') {
    return { type: 'string' };
  }

  if (zodSchema._def?.typeName === 'ZodNumber') {
    return { type: 'number' };
  }

  if (zodSchema._def?.typeName === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  if (zodSchema._def?.typeName === 'ZodArray') {
    const innerType = (zodSchema._def as { type?: unknown }).type;
    return {
      type: 'array',
      items: innerType ? zodToJsonSchema(innerType) : {},
    };
  }

  return { type: 'object' };
}
