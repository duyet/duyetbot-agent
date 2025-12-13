/**
 * MCP Tool Adapter
 *
 * Converts MCP (Model Context Protocol) tools into LoopTool format
 * compatible with the agentic loop. Handles tool wrapping, argument
 * transformation, and error handling.
 *
 * This adapter bridges the gap between MCP tools and the agent's tool
 * execution system, providing proper error handling and result formatting.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopContext, LoopTool, ToolResult } from '../agentic-loop/types.js';
import { formatMcpToolName } from './naming.js';
import type { MCPToolDefinition } from './types.js';

/**
 * Interface for MCP client to support tool execution
 *
 * This is the minimal interface an MCP client must implement
 * to be compatible with the tool adapter.
 */
export interface MCPClient {
  /**
   * Execute a tool on the MCP server
   *
   * @param mcpName - Name of the MCP server
   * @param toolName - Name of the tool to execute
   * @param args - Arguments to pass to the tool
   * @returns Result from tool execution
   * @throws Error if tool execution fails
   */
  execute(mcpName: string, toolName: string, args: Record<string, unknown>): Promise<string>;
}

/**
 * Wrap an MCP tool definition into a LoopTool
 *
 * Converts an MCP tool definition into the format expected by the
 * agentic loop, including proper error handling and result formatting.
 * The returned tool uses the prefixed naming convention.
 *
 * @param toolDef - MCP tool definition to wrap
 * @param mcpClient - MCP client for executing tools
 * @returns LoopTool compatible with the agentic loop
 *
 * @example
 * ```typescript
 * const mcpTool: MCPToolDefinition = {
 *   mcpName: 'duyet',
 *   originalName: 'get_cv',
 *   prefixedName: 'duyet__get_cv',
 *   description: 'Get Duyet\'s CV',
 *   parameters: { type: 'object', properties: {}, required: [] }
 * };
 *
 * const loopTool = createMcpToolWrapper(mcpTool, mcpClient);
 * // Now can be used in the agentic loop
 * executor.register(loopTool);
 * ```
 */
export function createMcpToolWrapper(toolDef: MCPToolDefinition, mcpClient: MCPClient): LoopTool {
  return {
    name: toolDef.prefixedName,
    description: toolDef.description,
    parameters: toolDef.parameters,

    execute: async (_args: Record<string, unknown>, _ctx: LoopContext): Promise<ToolResult> => {
      const startTime = Date.now();

      try {
        logger.debug(
          `[MCPAdapter] Executing tool ${toolDef.prefixedName} with args: ${JSON.stringify(_args)}`
        );

        // Call the MCP tool
        const result = await mcpClient.execute(toolDef.mcpName, toolDef.originalName, _args);

        const durationMs = Date.now() - startTime;
        logger.debug(`[MCPAdapter] Tool ${toolDef.prefixedName} succeeded in ${durationMs}ms`);

        return {
          success: true,
          output: result,
          durationMs,
        };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error(`[MCPAdapter] Tool ${toolDef.prefixedName} failed: ${errorMessage}`);

        return {
          success: false,
          output: `Error executing ${toolDef.prefixedName}: ${errorMessage}`,
          error: errorMessage,
          durationMs,
        };
      }
    },
  };
}

/**
 * Wrap multiple MCP tools into LoopTools
 *
 * Converts an array of MCP tool definitions into LoopTools.
 * Fails fast if any tool fails to wrap.
 *
 * @param toolDefs - Array of MCP tool definitions
 * @param mcpClient - MCP client for executing tools
 * @returns Array of wrapped LoopTools
 * @throws Error if any tool wrapping fails
 *
 * @example
 * ```typescript
 * const mcpTools = registry.listTools();
 * const loopTools = createMcpToolWrappers(mcpTools, mcpClient);
 * executor.registerAll(loopTools);
 * ```
 */
export function createMcpToolWrappers(
  toolDefs: MCPToolDefinition[],
  mcpClient: MCPClient
): LoopTool[] {
  return toolDefs.map((toolDef) => createMcpToolWrapper(toolDef, mcpClient));
}

/**
 * Create a mock MCP client for testing purposes
 *
 * Returns a simple mock client that returns predefined responses.
 * Useful for testing without a real MCP server.
 *
 * @param responses - Map of tool names to response strings
 * @returns Mock MCPClient instance
 *
 * @example
 * ```typescript
 * const mockClient = createMockMCPClient({
 *   'duyet__get_cv': 'Duyet Nguyen - Software Engineer'
 * });
 *
 * const loopTool = createMcpToolWrapper(toolDef, mockClient);
 * const result = await loopTool.execute({}, ctx);
 * // result.output === 'Duyet Nguyen - Software Engineer'
 * ```
 */
export function createMockMCPClient(responses: Record<string, string>): MCPClient {
  return {
    async execute(mcpName: string, toolName: string, _args: Record<string, unknown>) {
      const key = formatMcpToolName(mcpName, toolName);
      if (key in responses) {
        return responses[key];
      }
      throw new Error(`Mock response not defined for ${key}`);
    },
  };
}

/**
 * Create a failing MCP client for testing error scenarios
 *
 * Returns a client that always throws errors. Useful for testing
 * error handling in tool execution.
 *
 * @param errorMessage - Error message to throw
 * @returns Mock MCPClient instance that always fails
 *
 * @example
 * ```typescript
 * const failingClient = createFailingMCPClient('Connection timeout');
 * const loopTool = createMcpToolWrapper(toolDef, failingClient);
 * const result = await loopTool.execute({}, ctx);
 * // result.success === false
 * // result.error === 'Connection timeout'
 * ```
 */
export function createFailingMCPClient(errorMessage: string = 'Mock error'): MCPClient {
  return {
    async execute() {
      throw new Error(errorMessage);
    },
  };
}
