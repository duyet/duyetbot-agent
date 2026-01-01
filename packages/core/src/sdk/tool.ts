/**
 * SDK Tool Creator
 *
 * Create SDK-compatible tools with Zod schemas
 */

import type { Tool, ToolInput } from '@duyetbot/types';
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
 *
 * @param output - The output to convert (string, object, or SDKToolResult)
 * @param isError - Whether to mark the result as an error (default: false)
 * @returns SDKToolResult with standardized format
 *
 * @example
 * ```typescript
 * const result = toSDKResult('Hello, world!');
 * // { content: 'Hello, world!', isError: false }
 *
 * const error = toSDKResult('Failed', true);
 * // { content: 'Failed', isError: true }
 *
 * const obj = toSDKResult({ data: 123 });
 * // { content: '{\n  "data": 123\n}', isError: false, metadata: { data: 123 } }
 * ```
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
 *
 * Automatically converts handler output to SDKToolResult and catches errors.
 *
 * @template TInput - Input type for the handler
 * @template TOutput - Output type from the handler
 * @param handler - The original handler function
 * @returns Wrapped handler that returns Promise<SDKToolResult>
 *
 * @example
 * ```typescript
 * const originalHandler = async (input: { name: string }) => {
 *   return `Hello, ${input.name}!`;
 * };
 * const wrapped = wrapHandler(originalHandler);
 * const result = await wrapped({ name: 'World' });
 * // { content: 'Hello, World!', isError: false }
 * ```
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
 *
 * @param tool - Legacy tool with execute method
 * @returns SDKTool compatible with the SDK query system
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
 *
 * Wraps a function that returns a string as an SDKTool with automatic error handling.
 *
 * @template TInput - Input type for the tool
 * @param name - Tool name (used for LLM tool selection)
 * @param description - Tool description (shown to LLM)
 * @param inputSchema - Zod schema for input validation
 * @param fn - Function that processes input and returns a string
 * @returns SDKTool compatible with the SDK query system
 *
 * @example
 * ```typescript
 * const echoTool = simpleTool(
 *   'echo',
 *   'Echo back the input text',
 *   z.object({ text: z.string() }),
 *   async ({ text }) => `You said: ${text}`
 * );
 * ```
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
 *
 * Creates a Map for efficient tool lookup by name.
 *
 * @param tools - Array of SDK tools to compose
 * @returns Map of tool name to tool
 *
 * @example
 * ```typescript
 * const registry = composeTools([bashTool, gitTool, githubTool]);
 * const tool = registry.get('bash');
 * ```
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
 *
 * Extracts tool metadata in a format suitable for LLM function calling.
 *
 * @param tool - The SDK tool to extract metadata from
 * @returns Object with name, description, and input schema
 *
 * @example
 * ```typescript
 * const metadata = getToolMetadata(bashTool);
 * // { name: 'bash', description: '...', input_schema: {...} }
 * ```
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
 *
 * Maps over an array of tools to extract metadata for each.
 *
 * @param tools - Array of SDK tools
 * @returns Array of tool metadata objects
 *
 * @example
 * ```typescript
 * const allMetadata = getAllToolMetadata([bashTool, gitTool]);
 * // [{ name: 'bash', ... }, { name: 'git', ... }]
 * ```
 */
export function getAllToolMetadata(
  tools: SDKTool[]
): Array<{ name: string; description: string; input_schema: unknown }> {
  return tools.map(getToolMetadata);
}

/**
 * Convert an array of legacy tools to SDK format
 *
 * Converts legacy duyetbot Tool format to SDKTool format for use with the SDK query system.
 *
 * @param tools - Array of legacy Tool objects to convert
 * @returns Array of SDKTool objects compatible with the SDK query system
 *
 * @example
 * ```typescript
 * import { getAllBuiltinTools } from '@duyetbot/tools';
 * import { toSDKTools } from '@duyetbot/core';
 *
 * const sdkTools = toSDKTools(getAllBuiltinTools());
 *
 * // Use with query
 * for await (const msg of query('Hello', { tools: sdkTools })) {
 *   console.log(msg);
 * }
 * ```
 */
export function toSDKTools(tools: Tool[]): SDKTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler: async (input: unknown): Promise<SDKToolResult> => {
      const result = await tool.execute({ content: input } as ToolInput);
      const sdkResult: SDKToolResult = {
        content:
          typeof result.content === 'string' ? result.content : JSON.stringify(result.content),
        isError: result.status !== 'success',
      };
      if (result.metadata) {
        sdkResult.metadata = result.metadata;
      }
      return sdkResult;
    },
  }));
}
