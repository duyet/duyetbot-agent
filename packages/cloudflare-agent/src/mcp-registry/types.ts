/**
 * MCP Registry Type Definitions
 *
 * Provides core type definitions for the MCP (Model Context Protocol) registry system including:
 * - Server configuration and discovery
 * - Tool definitions with MCP sourcing
 * - Tool naming conventions
 *
 * The MCP Registry implements a standardized naming convention for MCP-sourced tools:
 * Format: <mcp>__<tool> (e.g., "duyet__get_cv", "memory__fetch_user_data")
 */

import type { ToolParameters } from '../agentic-loop/types.js';

/** Separator used in MCP tool naming convention */
export const MCP_SEPARATOR = '__';

/**
 * Configuration for an MCP Server
 *
 * Defines how a Model Context Protocol server is configured,
 * connected to, and used within the agent system.
 *
 * @example
 * ```typescript
 * const config: MCPServerConfig = {
 *   name: 'duyet',
 *   displayName: 'Duyet Personal Info',
 *   url: 'http://localhost:3000',
 *   enabled: true,
 *   description: 'Personal information and knowledge base',
 *   requiresAuth: true
 * };
 * ```
 */
export interface MCPServerConfig {
  /** Unique identifier for the MCP server (lowercase, no underscores) */
  name: string;
  /** Human-readable display name for the server */
  displayName: string;
  /** Connection URL or endpoint for the MCP server */
  url: string;
  /** Whether this server is enabled and available for tool discovery */
  enabled: boolean;
  /** Optional description of what this server provides */
  description?: string;
  /** Whether this server requires authentication to access */
  requiresAuth?: boolean;
}

/**
 * Tool definition sourced from an MCP Server
 *
 * Represents a tool imported from a Model Context Protocol server,
 * with metadata tracking its source and prefixed naming.
 *
 * @example
 * ```typescript
 * const tool: MCPToolDefinition = {
 *   mcpName: 'duyet',
 *   originalName: 'get_cv',
 *   prefixedName: 'duyet__get_cv',
 *   description: 'Retrieve Duyet\'s CV document',
 *   parameters: {
 *     type: 'object',
 *     properties: { format: { type: 'string', enum: ['json', 'markdown'] } },
 *     required: []
 *   }
 * };
 * ```
 */
export interface MCPToolDefinition {
  /** Name of the source MCP server */
  mcpName: string;
  /** Original tool name from the MCP server */
  originalName: string;
  /** Prefixed tool name for agent use (e.g., "duyet__get_cv") */
  prefixedName: string;
  /** Description of what this tool does */
  description: string;
  /** Parameter schema for tool arguments (JSON Schema format) */
  parameters: ToolParameters;
}

/**
 * Status of MCP tool discovery from a server
 *
 * Tracks whether tool discovery from an MCP server has completed,
 * succeeded, or failed.
 */
export type DiscoveryStatus = 'pending' | 'success' | 'failed';

/**
 * Result of discovering tools from an MCP server
 *
 * Provides information about the discovery process including status,
 * discovered tools, and any errors encountered.
 *
 * @example
 * ```typescript
 * const result: DiscoveryResult = {
 *   status: 'success',
 *   mcpName: 'duyet',
 *   tools: [
 *     { prefixedName: 'duyet__get_cv', ... },
 *     { prefixedName: 'duyet__get_notes', ... }
 *   ],
 *   discoveredAt: Date.now(),
 *   durationMs: 234
 * };
 * ```
 */
export interface DiscoveryResult {
  /** Current discovery status */
  status: DiscoveryStatus;
  /** Name of the MCP server that was discovered */
  mcpName: string;
  /** Tools discovered from this server */
  tools: MCPToolDefinition[];
  /** Timestamp when discovery completed */
  discoveredAt: number;
  /** Duration of discovery process in milliseconds */
  durationMs: number;
  /** Error message if discovery failed */
  error?: string;
}

/**
 * Options for creating an MCP Registry
 *
 * Customizes registry behavior including server configurations
 * and discovery settings.
 *
 * @example
 * ```typescript
 * const options: MCPRegistryOptions = {
 *   servers: [
 *     {
 *       name: 'duyet',
 *       displayName: 'Duyet Info',
 *       url: 'http://localhost:3000'
 *     }
 *   ],
 *   enableAutoDiscovery: true,
 *   discoveryTimeoutMs: 5000
 * };
 * ```
 */
export interface MCPRegistryOptions {
  /** Initial list of MCP servers to register */
  servers?: MCPServerConfig[];
  /** Whether to automatically discover tools on registration */
  enableAutoDiscovery?: boolean;
  /** Timeout in milliseconds for tool discovery */
  discoveryTimeoutMs?: number;
}
