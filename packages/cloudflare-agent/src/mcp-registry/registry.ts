/**
 * MCP Registry
 *
 * Central registry for managing MCP (Model Context Protocol) servers
 * and their tools. Handles server registration, tool discovery,
 * and tool lookup with standardized naming.
 *
 * Features:
 * - Server registration and configuration
 * - Tool storage and retrieval with MCP prefixing
 * - Batch tool operations
 * - Discovery status tracking
 */

import { logger } from '@duyetbot/hono-middleware';
import { parseMcpToolName } from './naming.js';
import type {
  DiscoveryResult,
  MCPRegistryOptions,
  MCPServerConfig,
  MCPToolDefinition,
} from './types.js';

/**
 * MCP Registry for managing servers and tools
 *
 * Provides a centralized registry for MCP servers and their tools,
 * with support for server lifecycle management and tool discovery.
 */
export class MCPRegistry {
  private servers: Map<string, MCPServerConfig>;
  private tools: Map<string, MCPToolDefinition>;
  private discoveryResults: Map<string, DiscoveryResult>;

  /**
   * Create a new MCP Registry
   *
   * @param options - Registry configuration options
   */
  constructor(options?: MCPRegistryOptions) {
    this.servers = new Map();
    this.tools = new Map();
    this.discoveryResults = new Map();

    // Register initial servers if provided
    if (options?.servers) {
      for (const server of options.servers) {
        this.registerServer(server);
      }
    }

    logger.debug(`[MCPRegistry] Created registry with ${this.servers.size} initial servers`);
  }

  /**
   * Register an MCP server
   *
   * Adds a server to the registry. If a server with the same name
   * already exists, it will be updated with the new configuration.
   *
   * @param config - Server configuration
   * @throws Error if server name is invalid
   *
   * @example
   * ```typescript
   * registry.registerServer({
   *   name: 'duyet',
   *   displayName: 'Duyet Personal Info',
   *   url: 'http://localhost:3000',
   *   enabled: true
   * });
   * ```
   */
  registerServer(config: MCPServerConfig): void {
    // Validate server configuration
    if (!config.name || !config.name.match(/^[a-z][a-z0-9_]*$/)) {
      throw new Error(
        `Invalid server name '${config.name}': must start with lowercase letter, contain only lowercase letters, numbers, and underscores`
      );
    }

    if (!config.displayName) {
      throw new Error('Server displayName is required');
    }

    if (!config.url) {
      throw new Error('Server url is required');
    }

    this.servers.set(config.name, config);
    logger.debug(`[MCPRegistry] Registered server: ${config.name} (${config.url})`);
  }

  /**
   * Get a server configuration by name
   *
   * @param name - Server name
   * @returns Server configuration or undefined if not found
   */
  getServer(name: string): MCPServerConfig | undefined {
    return this.servers.get(name);
  }

  /**
   * List all registered servers
   *
   * @returns Array of all server configurations
   */
  listServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * List enabled servers only
   *
   * @returns Array of enabled server configurations
   */
  listEnabledServers(): MCPServerConfig[] {
    return this.listServers().filter((server) => server.enabled);
  }

  /**
   * Add a tool to the registry
   *
   * Registers a tool from an MCP server. The tool must have a valid
   * prefixed name in the format "mcpName__toolName".
   *
   * @param tool - Tool definition to register
   * @throws Error if tool name is invalid or tool already exists
   *
   * @example
   * ```typescript
   * registry.addTool({
   *   mcpName: 'duyet',
   *   originalName: 'get_cv',
   *   prefixedName: 'duyet__get_cv',
   *   description: 'Get Duyet\'s CV',
   *   parameters: { type: 'object', properties: {}, required: [] }
   * });
   * ```
   */
  addTool(tool: MCPToolDefinition): void {
    // Validate tool naming
    const parsed = parseMcpToolName(tool.prefixedName);
    if (!parsed || parsed.mcpName !== tool.mcpName || parsed.toolName !== tool.originalName) {
      throw new Error(
        `Invalid tool naming: prefixedName '${tool.prefixedName}' does not match mcpName='${tool.mcpName}' and originalName='${tool.originalName}'`
      );
    }

    // Check for duplicates
    if (this.tools.has(tool.prefixedName)) {
      throw new Error(`Tool '${tool.prefixedName}' is already registered`);
    }

    this.tools.set(tool.prefixedName, tool);
    logger.debug(`[MCPRegistry] Added tool: ${tool.prefixedName}`);
  }

  /**
   * Add multiple tools at once
   *
   * Registers all tools in sequence. If any registration fails,
   * the entire operation fails and previously registered tools
   * in this batch are kept.
   *
   * @param tools - Array of tool definitions to register
   * @throws Error if any tool registration fails
   */
  addTools(tools: MCPToolDefinition[]): void {
    for (const tool of tools) {
      this.addTool(tool);
    }
  }

  /**
   * Get a tool by its prefixed name
   *
   * @param prefixedName - Prefixed tool name (e.g., "duyet__get_cv")
   * @returns Tool definition or undefined if not found
   */
  getTool(prefixedName: string): MCPToolDefinition | undefined {
    return this.tools.get(prefixedName);
  }

  /**
   * List all registered tools
   *
   * @returns Array of all tool definitions
   */
  listTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * List all tools from a specific MCP server
   *
   * @param mcpName - MCP server name
   * @returns Array of tools from that server
   *
   * @example
   * ```typescript
   * const duyetTools = registry.getToolsByMcp('duyet');
   * // => [{ prefixedName: 'duyet__get_cv', ... }, { prefixedName: 'duyet__get_notes', ... }]
   * ```
   */
  getToolsByMcp(mcpName: string): MCPToolDefinition[] {
    return this.listTools().filter((tool) => tool.mcpName === mcpName);
  }

  /**
   * Check if a tool is registered
   *
   * @param prefixedName - Prefixed tool name
   * @returns true if the tool exists
   */
  hasTool(prefixedName: string): boolean {
    return this.tools.has(prefixedName);
  }

  /**
   * Record the result of a tool discovery operation
   *
   * Tracks which servers have been discovered, which tools were found,
   * and whether discovery was successful.
   *
   * @param result - Discovery result to record
   *
   * @example
   * ```typescript
   * registry.recordDiscovery({
   *   status: 'success',
   *   mcpName: 'duyet',
   *   tools: [...discoveredTools],
   *   discoveredAt: Date.now(),
   *   durationMs: 234
   * });
   * ```
   */
  recordDiscovery(result: DiscoveryResult): void {
    this.discoveryResults.set(result.mcpName, result);
    logger.debug(
      `[MCPRegistry] Recorded discovery for ${result.mcpName}: ${result.status} (${result.tools.length} tools, ${result.durationMs}ms)`
    );
  }

  /**
   * Get the discovery result for a specific MCP server
   *
   * @param mcpName - MCP server name
   * @returns Discovery result or undefined if not discovered yet
   */
  getDiscoveryResult(mcpName: string): DiscoveryResult | undefined {
    return this.discoveryResults.get(mcpName);
  }

  /**
   * List all discovery results
   *
   * @returns Array of all discovery results
   */
  listDiscoveryResults(): DiscoveryResult[] {
    return Array.from(this.discoveryResults.values());
  }

  /**
   * Get discovery status for a specific server
   *
   * @param mcpName - MCP server name
   * @returns Discovery status ('pending', 'success', 'failed') or undefined if never attempted
   */
  getDiscoveryStatus(mcpName: string): string | undefined {
    return this.discoveryResults.get(mcpName)?.status;
  }

  /**
   * Clear all tools from the registry
   *
   * Useful for re-discovery or testing purposes. Note that servers
   * are not cleared, only tools.
   */
  clearTools(): void {
    const count = this.tools.size;
    this.tools.clear();
    logger.debug(`[MCPRegistry] Cleared ${count} tools`);
  }

  /**
   * Get registry statistics
   *
   * @returns Object containing counts of servers, tools, and discovery results
   */
  getStats(): {
    servers: number;
    enabledServers: number;
    tools: number;
    discoveredServers: number;
  } {
    return {
      servers: this.servers.size,
      enabledServers: this.listEnabledServers().length,
      tools: this.tools.size,
      discoveredServers: this.discoveryResults.size,
    };
  }
}

/**
 * Create a new MCP Registry factory function
 *
 * Convenience factory function for creating and initializing
 * an MCP Registry with standard configuration.
 *
 * @param options - Registry configuration options
 * @returns Initialized MCPRegistry instance
 *
 * @example
 * ```typescript
 * const registry = createMCPRegistry({
 *   servers: [
 *     {
 *       name: 'duyet',
 *       displayName: 'Duyet Personal Info',
 *       url: 'http://localhost:3000',
 *       enabled: true
 *     }
 *   ]
 * });
 * ```
 */
export function createMCPRegistry(options?: MCPRegistryOptions): MCPRegistry {
  return new MCPRegistry(options);
}
