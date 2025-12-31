/**
 * Tool Executor - Unified interface for executing builtin and MCP tools
 *
 * Provides a clean abstraction over different tool types:
 * - Built-in tools from @duyetbot/tools (executed via Tool interface)
 * - MCP tools (executed via MCP client callTool)
 */

import { logger } from '@duyetbot/hono-middleware';
import type { Tool, ToolInput } from '@duyetbot/types';
import type { ToolCall } from '../types.js';

/**
 * MCP tool call parameters
 * Extended with index signature for compatibility with agents SDK
 */
export interface MCPToolCallParams {
  serverId: string;
  name: string;
  arguments: Record<string, unknown>;
  [key: string]: unknown; // Index signature for agent SDK compatibility
}

/**
 * MCP call result
 */
export interface MCPCallResult {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Result text */
  result: string;
  /** Execution error if any */
  error?: string;
}

/**
 * Configuration for ToolExecutor
 */
export interface ToolExecutorConfig {
  /** Map of builtin tools by name */
  builtinToolMap: Map<string, Tool>;
  /** Function to call MCP tools */
  mcpCallTool: (params: MCPToolCallParams) => Promise<MCPCallResult>;
}

/**
 * ToolExecutor class - Execute builtin tools and MCP tools
 */
export class ToolExecutor {
  constructor(private config: ToolExecutorConfig) {}

  /**
   * Execute a tool call (builtin or MCP)
   * @param toolCall - Tool call from LLM
   * @returns Tool execution result
   */
  async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
    // Parse arguments
    let toolArgs: Record<string, unknown> = {};
    try {
      toolArgs = JSON.parse(toolCall.arguments);
    } catch {
      return {
        result: '',
        error: 'Invalid JSON arguments',
      };
    }

    try {
      // Check if it's a built-in tool first
      const builtinTool = this.config.builtinToolMap.get(toolCall.name);
      if (builtinTool) {
        return await this.executeBuiltinTool(builtinTool, toolCall.name, toolArgs);
      }

      // Otherwise, execute as MCP tool
      return await this.executeMCPTool(toolCall.name, toolArgs);
    } catch (error) {
      logger.error(`[ToolExecutor] Tool execution failed: ${error}`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        result: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Execute a builtin tool
   */
  private async executeBuiltinTool(
    tool: Tool,
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    logger.info(`[ToolExecutor] Calling built-in tool: ${name}`);

    // Execute built-in tool
    const toolInput: ToolInput = {
      content: args,
    };
    const result = await tool.execute(toolInput);

    // Format result
    let resultText =
      typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

    if (result.status === 'error' && result.error) {
      resultText = `Error: ${result.error.message}`;
      return {
        result: resultText,
        error: result.error.message,
      };
    }

    return {
      result: resultText,
    };
  }

  /**
   * Execute an MCP tool
   */
  private async executeMCPTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    // Parse tool name to get server ID (format: serverId__toolName)
    const [serverId, ...toolNameParts] = toolName.split('__');
    const actualToolName = toolNameParts.join('__') || toolName;

    logger.info(`[ToolExecutor] Calling MCP tool: ${actualToolName} on server ${serverId}`);

    const result = await this.config.mcpCallTool({
      serverId: serverId || '',
      name: actualToolName,
      arguments: args,
    });

    // Format MCP result
    const resultText = result.content
      .map((c) => (c.type === 'text' ? c.text : JSON.stringify(c)))
      .join('\n');

    return {
      result: resultText,
    };
  }
}
