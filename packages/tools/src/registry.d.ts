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
export declare class ToolRegistry {
  private tools;
  /**
   * Register a tool
   */
  register(tool: Tool, options?: RegisterOptions): void;
  /**
   * Register multiple tools at once
   */
  registerAll(tools: Tool[], options?: RegisterOptions): void;
  /**
   * Get a tool by name
   */
  get(name: string): Tool;
  /**
   * Get all registered tools
   */
  getAll(): Tool[];
  /**
   * Check if a tool is registered
   */
  has(name: string): boolean;
  /**
   * List all registered tool names
   */
  list(): string[];
  /**
   * Unregister a tool
   */
  unregister(name: string): void;
  /**
   * Clear all tools
   */
  clear(): void;
  /**
   * Execute a tool by name
   */
  execute(name: string, input: ToolInput): Promise<ToolOutput>;
  /**
   * Validate input for a tool
   */
  validate(name: string, input: ToolInput): boolean;
  /**
   * Filter tools by predicate
   */
  filter(predicate: (tool: Tool) => boolean): Tool[];
  /**
   * Find tool by predicate
   */
  find(predicate: (tool: Tool) => boolean): Tool | undefined;
  /**
   * Get tool metadata
   */
  getMetadata(name: string): ToolMetadata;
  /**
   * Get metadata for all tools
   */
  getAllMetadata(): ToolMetadata[];
}
/**
 * Create and export singleton instance
 */
export declare const toolRegistry: ToolRegistry;
//# sourceMappingURL=registry.d.ts.map
