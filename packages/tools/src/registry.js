/**
 * Tool Registry
 *
 * Manages registration and execution of tools
 */
/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  tools = new Map();
  /**
   * Register a tool
   */
  register(tool, options) {
    if (this.tools.has(tool.name) && !options?.override) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }
  /**
   * Register multiple tools at once
   */
  registerAll(tools, options) {
    for (const tool of tools) {
      this.register(tool, options);
    }
  }
  /**
   * Get a tool by name
   */
  get(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered`);
    }
    return tool;
  }
  /**
   * Get all registered tools
   */
  getAll() {
    return Array.from(this.tools.values());
  }
  /**
   * Check if a tool is registered
   */
  has(name) {
    return this.tools.has(name);
  }
  /**
   * List all registered tool names
   */
  list() {
    return Array.from(this.tools.keys());
  }
  /**
   * Unregister a tool
   */
  unregister(name) {
    this.tools.delete(name);
  }
  /**
   * Clear all tools
   */
  clear() {
    this.tools.clear();
  }
  /**
   * Execute a tool by name
   */
  async execute(name, input) {
    const tool = this.get(name);
    return tool.execute(input);
  }
  /**
   * Validate input for a tool
   */
  validate(name, input) {
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
  filter(predicate) {
    return this.getAll().filter(predicate);
  }
  /**
   * Find tool by predicate
   */
  find(predicate) {
    return this.getAll().find(predicate);
  }
  /**
   * Get tool metadata
   */
  getMetadata(name) {
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
  getAllMetadata() {
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
