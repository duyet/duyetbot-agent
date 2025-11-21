/**
 * SDK Tool Creator
 *
 * Create SDK-compatible tools with Zod schemas
 */

import type { z } from 'zod';
import type { SDKTool, SDKToolResult } from './types.js';

/**
 * Create an SDK-compatible tool
 *
 * @example
 * ```typescript
 * const bashTool = sdkTool(
 *   'bash',
 *   'Execute shell commands',
 *   z.object({ command: z.string() }),
 *   async ({ command }) => {
 *     const result = await exec(command);
 *     return { output: result.stdout };
 *   }
 * );
 * ```
 */
export function sdkTool<TInput, TOutput>(
  name: string,
  description: string,
  inputSchema: z.ZodType<TInput>,
  handler: (input: TInput) => Promise<TOutput>
): SDKTool<TInput, TOutput> {
  return {
    name,
    description,
    inputSchema,
    handler,
  };
}

/**
 * Convert tool output to SDK result format
 */
export function toSDKResult(output: unknown, isError = false): SDKToolResult {
  if (typeof output === 'string') {
    return { content: output, isError };
  }

  if (output && typeof output === 'object') {
    // Check if it's already an SDK result
    if ('content' in output && typeof (output as SDKToolResult).content === 'string') {
      return output as SDKToolResult;
    }

    // Convert object to JSON string
    return {
      content: JSON.stringify(output, null, 2),
      isError,
      metadata: output as Record<string, unknown>,
    };
  }

  return {
    content: String(output),
    isError,
  };
}

/**
 * Wrap a handler to return SDK result format
 */
export function wrapHandler<TInput, TOutput>(
  handler: (input: TInput) => Promise<TOutput>
): (input: TInput) => Promise<SDKToolResult> {
  return async (input: TInput): Promise<SDKToolResult> => {
    try {
      const result = await handler(input);
      return toSDKResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toSDKResult(message, true);
    }
  };
}

/**
 * Convert existing duyetbot tool to SDK tool format
 */
export function convertToSDKTool(tool: {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (input: { content: unknown }) => Promise<{
    status: string;
    content: string;
    error?: { message: string; code?: string };
    metadata?: Record<string, unknown>;
  }>;
}): SDKTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler: async (input: unknown): Promise<SDKToolResult> => {
      const result = await tool.execute({ content: input });
      const sdkResult: SDKToolResult = {
        content: result.content,
        isError: result.status !== 'success',
      };
      if (result.metadata) {
        sdkResult.metadata = result.metadata;
      }
      return sdkResult;
    },
  };
}

/**
 * Create a tool from a simple function
 */
export function simpleTool<TInput>(
  name: string,
  description: string,
  inputSchema: z.ZodType<TInput>,
  fn: (input: TInput) => Promise<string> | string
): SDKTool<TInput, SDKToolResult> {
  return {
    name,
    description,
    inputSchema,
    handler: async (input: TInput): Promise<SDKToolResult> => {
      try {
        const result = await fn(input);
        return { content: result };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: message, isError: true };
      }
    },
  };
}

/**
 * Compose multiple tools into a single registry-like structure
 */
export function composeTools(tools: SDKTool[]): Map<string, SDKTool> {
  const registry = new Map<string, SDKTool>();
  for (const tool of tools) {
    registry.set(tool.name, tool);
  }
  return registry;
}

/**
 * Get tool metadata for LLM consumption
 */
export function getToolMetadata(tool: SDKTool): {
  name: string;
  description: string;
  input_schema: unknown;
} {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

/**
 * Get metadata for all tools
 */
export function getAllToolMetadata(
  tools: SDKTool[]
): Array<{ name: string; description: string; input_schema: unknown }> {
  return tools.map(getToolMetadata);
}
