/**
 * SDK Query Function
 *
 * Main entry point for agent execution using Claude Agent SDK
 */

import {
  type SDKMessage,
  type Options as SDKOptions,
  type Query as SDKQuery,
  createSdkMcpServer,
  query as sdkQuery,
  tool as sdkTool,
} from '@anthropic-ai/claude-agent-sdk';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import type { QueryOptions } from './options.js';
import { createDefaultOptions, validateOptions } from './options.js';
import type {
  QueryController,
  QueryInput,
  SDKAnyMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKSystemMessage,
  SDKTool,
  SDKUserMessage,
} from './types.js';

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
 * Convert our tools to SDK MCP server format
 */
function createToolsMcpServer(tools: SDKTool[]) {
  const sdkTools = tools.map((t) => {
    // Get the raw shape from the Zod schema
    const schemaDef = t.inputSchema._def as { shape?: () => ZodRawShape };
    const shape = schemaDef.shape?.() || {};

    return sdkTool(t.name, t.description, shape, async (args: unknown): Promise<CallToolResult> => {
      try {
        const result = await t.handler(args);

        // Convert to CallToolResult format
        if (typeof result === 'string') {
          return { content: [{ type: 'text', text: result }] };
        }

        if (result && typeof result === 'object') {
          if ('content' in result && typeof result.content === 'string') {
            return {
              content: [{ type: 'text', text: result.content }],
              isError: 'isError' in result ? Boolean(result.isError) : false,
            };
          }
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        return { content: [{ type: 'text', text: String(result) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  });

  return createSdkMcpServer({
    name: 'duyetbot-tools',
    version: '1.0.0',
    tools: sdkTools,
  });
}

/**
 * Convert our options to SDK options
 */
function convertToSDKOptions(opts: QueryOptions, controller?: QueryController): SDKOptions {
  const sdkOptions: SDKOptions = {
    maxTurns: 100,
  };

  // Only set defined values
  if (opts.model) {
    sdkOptions.model = opts.model;
  }
  if (opts.systemPrompt) {
    sdkOptions.systemPrompt = opts.systemPrompt;
  }
  if (opts.permissionMode) {
    sdkOptions.permissionMode = opts.permissionMode;
  }
  if (opts.resume) {
    sdkOptions.resume = opts.resume;
  }

  // Add abort controller
  if (controller?.signal) {
    sdkOptions.abortController = new AbortController();
    controller.signal.addEventListener('abort', () => {
      sdkOptions.abortController?.abort();
    });
  }

  // Convert tools to MCP server
  if (opts.tools && opts.tools.length > 0) {
    const toolsServer = createToolsMcpServer(opts.tools);
    sdkOptions.mcpServers = {
      'duyetbot-tools': toolsServer,
    };
  }

  // Convert agents
  if (opts.agents && opts.agents.length > 0) {
    sdkOptions.agents = {};
    for (const agent of opts.agents) {
      const agentDef: {
        description: string;
        prompt: string;
        tools?: string[];
        model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
      } = {
        description: agent.description,
        prompt: agent.prompt || '',
      };
      if (agent.tools) {
        agentDef.tools = agent.tools;
      }
      if (agent.model) {
        agentDef.model = agent.model as 'sonnet' | 'opus' | 'haiku' | 'inherit';
      }
      sdkOptions.agents[agent.name] = agentDef;
    }
  }

  return sdkOptions;
}

/**
 * Convert SDK message to our message format
 */
function convertSDKMessage(msg: SDKMessage, sessionId: string): SDKAnyMessage | null {
  switch (msg.type) {
    case 'user':
      return {
        type: 'user',
        sessionId,
        content:
          typeof msg.message.content === 'string'
            ? msg.message.content
            : JSON.stringify(msg.message.content),
        uuid: msg.uuid,
      } as SDKUserMessage;

    case 'assistant': {
      // Extract text content from the message
      let content = '';
      for (const block of msg.message.content) {
        if (block.type === 'text') {
          content += block.text;
        }
      }

      return {
        type: 'assistant',
        sessionId,
        content,
        stopReason: msg.message.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
        uuid: msg.uuid,
      } as SDKAssistantMessage;
    }

    case 'result': {
      const resultMsg = msg as SDKMessage & {
        result?: string;
        usage?: { input_tokens: number; output_tokens: number };
        duration_ms?: number;
      };

      return {
        type: 'result',
        sessionId,
        content: resultMsg.result || '',
        inputTokens: resultMsg.usage?.input_tokens,
        outputTokens: resultMsg.usage?.output_tokens,
        totalTokens: (resultMsg.usage?.input_tokens || 0) + (resultMsg.usage?.output_tokens || 0),
        duration: resultMsg.duration_ms,
        uuid: msg.uuid,
      } as SDKResultMessage;
    }

    case 'system':
      return {
        type: 'system',
        sessionId,
        content: JSON.stringify(msg),
        uuid: msg.uuid,
      } as SDKSystemMessage;

    default:
      // Skip stream events and other internal messages
      return null;
  }
}

/**
 * Execute a query and stream responses
 *
 * This is the main entry point for agent execution using the Claude Agent SDK.
 *
 * @example
 * ```typescript
 * // Simple string query
 * for await (const message of query('Hello, world!', options)) {
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
    } as SDKSystemMessage;
    return;
  }

  // Generate session ID if not provided
  const sessionId = opts.sessionId || opts.resume || generateSessionId();

  // Convert input to string
  let prompt: string;
  if (typeof input === 'string') {
    prompt = input;
  } else {
    const messages: string[] = [];
    for await (const msg of input) {
      messages.push(msg.content);
    }
    prompt = messages.join('\n');
  }

  // Emit user message
  yield {
    type: 'user',
    sessionId,
    content: prompt,
    uuid: generateUUID(),
  } as SDKUserMessage;

  try {
    // Convert options to SDK format
    const sdkOptions = convertToSDKOptions(opts, controller);

    // Execute SDK query
    const sdkQueryResult: SDKQuery = sdkQuery({
      prompt,
      options: sdkOptions,
    });

    // Stream SDK messages and convert to our format
    for await (const msg of sdkQueryResult) {
      const converted = convertSDKMessage(msg, sessionId);
      if (converted) {
        yield converted;
      }
    }
  } catch (error) {
    // Emit error as system message
    const errorMessage = error instanceof Error ? error.message : String(error);
    yield {
      type: 'system',
      sessionId,
      content: `Error: ${errorMessage}`,
      uuid: generateUUID(),
    } as SDKSystemMessage;
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
      result = message as SDKResultMessage;
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

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
