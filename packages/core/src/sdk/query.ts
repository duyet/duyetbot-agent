/**
 * SDK Query Function
 *
 * Main entry point for agent execution using Claude Agent SDK patterns
 */

import type { QueryOptions } from './options.js';
import { createDefaultOptions, validateOptions } from './options.js';
import type {
  QueryController,
  QueryInput,
  SDKAnyMessage,
  SDKAssistantMessage,
  SDKResultMessage,
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
  isComplete: boolean;
  aborted: boolean;
}

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
    isComplete: false,
    aborted: false,
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

    // Emit user messages
    for (const message of userMessages) {
      const userMessage: SDKUserMessage = {
        type: 'user',
        sessionId,
        content: message,
        uuid: generateUUID(),
      };
      state.messages.push(userMessage);
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

      // Generate assistant response
      const assistantResponse = await generateResponse(state, opts);

      // Emit assistant message
      yield assistantResponse;
      state.messages.push(assistantResponse);

      // Check if we need to execute tools
      if (assistantResponse.stopReason === 'tool_use') {
        // Execute tools and yield results
        const toolResults = await executeTools(state, opts);
        for (const result of toolResults) {
          yield result;
          state.messages.push(result);
        }
      } else if (assistantResponse.stopReason === 'end_turn') {
        state.isComplete = true;
      } else if (assistantResponse.stopReason === 'max_tokens') {
        // Continue generation
      } else if (assistantResponse.stopReason === 'interrupt') {
        state.isComplete = true;
      }
    }

    // Emit result message
    const resultMessage: SDKResultMessage = {
      type: 'result',
      sessionId,
      content: getLastAssistantContent(state),
      uuid: generateUUID(),
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

async function generateResponse(
  state: QueryState,
  _opts: QueryOptions
): Promise<SDKAssistantMessage> {
  // TODO: Integrate with actual LLM provider
  // For now, return a placeholder response
  return {
    type: 'assistant',
    sessionId: state.sessionId,
    content: 'Response placeholder - integrate with LLM provider',
    stopReason: 'end_turn',
    uuid: generateUUID(),
  };
}

async function executeTools(
  _state: QueryState,
  _opts: QueryOptions
): Promise<Array<SDKToolUseMessage | SDKToolResultMessage>> {
  const results: Array<SDKToolUseMessage | SDKToolResultMessage> = [];

  // TODO: Parse tool calls from last assistant message
  // Execute each tool and yield results
  // For now, return empty array

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
