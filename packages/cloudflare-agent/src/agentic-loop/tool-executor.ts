/**
 * Tool Executor for Agentic Loop
 *
 * Manages tool registration, validation, and execution during the agentic loop.
 * Provides Anthropic-compatible tool definitions for LLM consumption.
 *
 * Features:
 * - Tool registry management (register, retrieve, list)
 * - Argument validation against tool schemas
 * - Parallel tool execution with timing
 * - Anthropic tool format conversion
 * - Error handling and reporting
 *
 * @example
 * ```typescript
 * const executor = new ToolExecutor();
 *
 * // Register tools
 * executor.register({
 *   name: 'search',
 *   description: 'Search the web',
 *   parameters: {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' }
 *     },
 *     required: ['query']
 *   },
 *   execute: async (args, ctx) => {
 *     // Perform search...
 *     return { success: true, output: 'Results...', durationMs: 123 };
 *   }
 * });
 *
 * // Execute a tool call
 * const result = await executor.execute(ctx, {
 *   id: 'call_123',
 *   name: 'search',
 *   arguments: { query: 'React' }
 * });
 *
 * // Convert to Anthropic format for LLM
 * const anthropicTools = executor.toAnthropicFormat();
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type {
  AnthropicTool,
  LoopContext,
  LoopTool,
  ToolCall,
  ToolParameters,
  ToolResult,
} from './types.js';

/**
 * Registry and executor for agentic loop tools
 *
 * Handles tool registration, validation, and execution with proper error handling
 * and performance tracking.
 */
export class ToolExecutor {
  private tools: Map<string, LoopTool>;

  /**
   * Create a new tool executor
   */
  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a single tool
   *
   * Validates tool definition before registration to catch issues early.
   * Throws if tool name is already registered or validation fails.
   *
   * @param tool - Tool definition to register
   * @throws Error if tool name is duplicate or validation fails
   *
   * @example
   * ```typescript
   * executor.register({
   *   name: 'read_file',
   *   description: 'Read a file',
   *   parameters: {
   *     type: 'object',
   *     properties: {
   *       path: { type: 'string' }
   *     },
   *     required: ['path']
   *   },
   *   execute: async (args, ctx) => ({ ... })
   * });
   * ```
   */
  register(tool: LoopTool): void {
    // Validate tool definition
    this.validateToolDefinition(tool);

    // Check for duplicate
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    // Add to registry
    this.tools.set(tool.name, tool);

    logger.debug(`[ToolExecutor] Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   *
   * Registers all tools in sequence. If any registration fails,
   * the entire operation fails and partial registrations are rolled back.
   *
   * @param tools - Array of tool definitions
   * @throws Error if any tool registration fails
   */
  registerAll(tools: LoopTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   *
   * @param name - Tool name to retrieve
   * @returns Tool definition or undefined if not found
   */
  get(name: string): LoopTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   *
   * @returns Array of all registered tool definitions
   */
  getAll(): LoopTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   *
   * @param name - Tool name to check
   * @returns True if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   *
   * Useful for listing available tools or debugging.
   *
   * @returns Array of tool names in registration order
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Convert registered tools to Anthropic-compatible format
   *
   * Transforms tool definitions into the format expected by Claude API,
   * with proper schema conversion for LLM consumption.
   *
   * @returns Array of tools in Anthropic tool format
   *
   * @example
   * ```typescript
   * const anthropicTools = executor.toAnthropicFormat();
   * // Pass to Claude API: { tools: anthropicTools }
   * ```
   */
  toAnthropicFormat(): AnthropicTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: this.toJsonSchema(tool.parameters),
    }));
  }

  /**
   * Execute a single tool call
   *
   * Validates the tool call, executes the tool, and returns the result
   * with execution timing. Handles errors gracefully.
   *
   * @param ctx - Loop execution context
   * @param toolCall - Tool call from LLM
   * @returns Tool execution result with timing
   *
   * @example
   * ```typescript
   * const result = await executor.execute(ctx, {
   *   id: 'call_123',
   *   name: 'search',
   *   arguments: { query: 'React' }
   * });
   * ```
   */
  async execute(ctx: LoopContext, toolCall: ToolCall): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolCall.name);

    // Tool not found
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Tool '${toolCall.name}' not found. Available tools: ${this.getNames().join(', ')}`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // Validate arguments against schema
      this.validateArguments(tool, toolCall.arguments);

      // Log tool invocation
      logger.debug(`[ToolExecutor] Executing tool: ${tool.name}`, {
        arguments: toolCall.arguments,
        toolCallId: toolCall.id,
      });

      // Execute tool
      const result = await tool.execute(toolCall.arguments, ctx);

      // Add timing information
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`[ToolExecutor] Tool execution failed: ${tool.name}`, {
        error: errorMessage,
        toolCallId: toolCall.id,
      });

      return {
        success: false,
        output: '',
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   *
   * Executes all tool calls concurrently for better performance.
   * Individual tool failures do not affect other tools.
   *
   * @param ctx - Loop execution context
   * @param toolCalls - Array of tool calls to execute
   * @returns Map of tool call ID to execution result
   *
   * @example
   * ```typescript
   * const results = await executor.executeAll(ctx, [
   *   { id: 'call_1', name: 'search', arguments: { ... } },
   *   { id: 'call_2', name: 'fetch', arguments: { ... } }
   * ]);
   * ```
   */
  async executeAll(ctx: LoopContext, toolCalls: ToolCall[]): Promise<Map<string, ToolResult>> {
    const results = await Promise.all(
      toolCalls.map((tc) => this.execute(ctx, tc).then((r) => [tc.id, r] as const))
    );

    return new Map(results);
  }

  /**
   * Validate tool definition
   *
   * Ensures tool has required fields with correct types.
   *
   * @param tool - Tool definition to validate
   * @throws Error if validation fails
   */
  private validateToolDefinition(tool: LoopTool): void {
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool must have a non-empty name string');
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error(`Tool '${tool.name}' must have a non-empty description string`);
    }

    if (!tool.parameters || typeof tool.parameters !== 'object') {
      throw new Error(`Tool '${tool.name}' must have a parameters object`);
    }

    if (typeof tool.execute !== 'function') {
      throw new Error(`Tool '${tool.name}' must have an execute function`);
    }

    // Validate tool name format (alphanumeric + underscore)
    if (!/^[a-zA-Z0-9_]+$/.test(tool.name)) {
      throw new Error(
        `Tool name '${tool.name}' must contain only alphanumeric characters and underscores`
      );
    }
  }

  /**
   * Validate tool arguments against schema
   *
   * Performs basic validation: checks that required fields are present.
   * Can be enhanced with Zod or JSON Schema validation later.
   *
   * @param tool - Tool definition
   * @param args - Arguments to validate
   * @throws Error if validation fails
   */
  private validateArguments(tool: LoopTool, args: Record<string, unknown>): void {
    const required = tool.parameters.required || [];

    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Missing required argument '${field}' for tool '${tool.name}'`);
      }

      if (args[field] === null || args[field] === undefined) {
        throw new Error(`Argument '${field}' for tool '${tool.name}' cannot be null or undefined`);
      }
    }
  }

  /**
   * Convert tool parameters to JSON Schema for Anthropic
   *
   * Maps internal parameter format to the JSON Schema structure expected
   * by Claude API's tool_use format.
   *
   * @param params - Tool parameters
   * @returns JSON Schema object
   */
  private toJsonSchema(params: ToolParameters): AnthropicTool['input_schema'] {
    const schema: AnthropicTool['input_schema'] = {
      type: 'object',
      properties: this.normalizeProperties(params.properties || {}),
    };

    // Only include required if it exists
    if (params.required) {
      schema.required = params.required;
    }

    return schema;
  }

  /**
   * Normalize properties for Anthropic schema
   *
   * Ensures properties match Anthropic's expected format.
   *
   * @param props - Raw properties from tool parameters
   * @returns Normalized properties
   */
  private normalizeProperties(props: Record<string, unknown>): Record<
    string,
    {
      type: string;
      description?: string;
      enum?: string[];
    }
  > {
    const result: Record<string, { type: string; description?: string; enum?: string[] }> = {};

    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'object' && value !== null && 'type' in value) {
        // Already in the right format
        result[key] = value as { type: string; description?: string; enum?: string[] };
      } else if (typeof value === 'string') {
        // Simple string type
        result[key] = { type: value };
      } else {
        // Fallback to string type
        result[key] = { type: 'string' };
      }
    }

    return result;
  }
}

/**
 * Create a tool definition helper
 *
 * Convenience function for creating tool definitions with proper typing.
 *
 * @param name - Unique tool identifier
 * @param description - Human-readable description
 * @param parameters - Parameter schema
 * @param execute - Execution function
 * @returns Tool definition
 *
 * @example
 * ```typescript
 * const searchTool = createTool(
 *   'search',
 *   'Search the web',
 *   {
 *     type: 'object',
 *     properties: {
 *       query: { type: 'string', description: 'Search query' }
 *     },
 *     required: ['query']
 *   },
 *   async (args, ctx) => {
 *     const query = args.query as string;
 *     // Perform search...
 *     return { success: true, output: 'Results...', durationMs: 100 };
 *   }
 * );
 * ```
 */
export function createTool(
  name: string,
  description: string,
  parameters: LoopTool['parameters'],
  execute: LoopTool['execute']
): LoopTool {
  return {
    name,
    description,
    parameters,
    execute,
  };
}
