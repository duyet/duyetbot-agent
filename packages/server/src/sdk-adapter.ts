/**
 * SDK Adapter
 *
 * Converts existing duyetbot tools to SDK format and provides execution helpers
 */

import { query, createQueryController } from '@duyetbot/core/sdk';
import type { QueryOptions, SDKAnyMessage, SDKTool } from '@duyetbot/core/sdk';
import type { Tool } from '@duyetbot/types';
import { z } from 'zod';

/**
 * Convert a duyetbot tool to SDK format
 */
export function toSDKTool(tool: Tool): SDKTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as z.ZodType,
    handler: async (input: unknown) => {
      const result = await tool.execute({ content: input as string | Record<string, unknown> });

      return {
        content: result.content,
        isError: result.status === 'error',
        metadata: result.metadata,
      };
    },
  };
}

/**
 * Convert multiple tools to SDK format
 */
export function toSDKTools(tools: Tool[]): SDKTool[] {
  return tools.map(toSDKTool);
}

/**
 * Execute a query and collect all messages
 */
export async function executeQuery(
  input: string,
  options: QueryOptions
): Promise<{
  messages: SDKAnyMessage[];
  response: string;
  tokens: { input: number; output: number; total: number };
  duration: number;
}> {
  const messages: SDKAnyMessage[] = [];
  let response = '';
  let tokens = { input: 0, output: 0, total: 0 };
  let duration = 0;

  for await (const message of query(input, options)) {
    messages.push(message);

    if (message.type === 'assistant') {
      response += message.content;
    } else if (message.type === 'result') {
      response = message.content;
      tokens = {
        input: message.inputTokens || 0,
        output: message.outputTokens || 0,
        total: message.totalTokens || 0,
      };
      duration = message.duration || 0;
    }
  }

  return { messages, response, tokens, duration };
}

/**
 * Stream a query with callbacks for each message type
 */
export async function* streamQuery(
  input: string,
  options: QueryOptions,
  controller?: ReturnType<typeof createQueryController>
): AsyncGenerator<SDKAnyMessage, void, unknown> {
  yield* query(input, options, controller);
}

export { createQueryController };
