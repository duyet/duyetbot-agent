/**
 * Tool Registry
 *
 * Manages registration and execution of tools
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';

/**
 * Registration options
 */
interface RegisterOptions {
  override?: boolean;
}

/**
 * Tool metadata
 */
interface ToolMetadata {
  name: string;
  description: string;
  inputSchema: unknown;
}

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>();

  /**
   * Register a tool
   */
  register(tool: Tool, options?: RegisterOptions): void {
    if (this.tools.has(tool.name) && !options?.override) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }

    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools at once
   */
  registerAll(tools: Tool[], options?: RegisterOptions): void {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered`);
    }
    return tool;
  }

  /**
   * Get all registered tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * List all registered tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, input: ToolInput): Promise<ToolOutput> {
    const tool = this.get(name);
    return tool.execute(input);
  }

  /**
   * Validate input for a tool
   */
  validate(name: string, input: ToolInput): boolean {
    const tool = this.get(name);

    // If tool doesn't have validate method, assume valid
    if (!tool.validate) {
      return true;
    }

    return tool.validate(input);
  }

  /**
   * Filter tools by predicate
   */
  filter(predicate: (tool: Tool) => boolean): Tool[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Find tool by predicate
   */
  find(predicate: (tool: Tool) => boolean): Tool | undefined {
    return this.getAll().find(predicate);
  }

  /**
   * Get tool metadata
   */
  getMetadata(name: string): ToolMetadata {
    const tool = this.get(name);
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    };
  }

  /**
   * Get metadata for all tools
   */
  getAllMetadata(): ToolMetadata[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }
}

/**
 * Create and export singleton instance
 */
export const toolRegistry = new ToolRegistry();
