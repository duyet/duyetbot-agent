/**
 * MCP Registry Module
 *
 * Exports the complete MCP Registry infrastructure for managing
 * Model Context Protocol servers and tools.
 */

// Types (export first for re-export compatibility)
import type { MCPToolDefinition } from './types.js';

export type {
  DiscoveryResult,
  DiscoveryStatus,
  MCPRegistryOptions,
  MCPServerConfig,
  MCPToolDefinition,
} from './types.js';
export { MCP_SEPARATOR } from './types.js';

// List commands
export {
  formatListCommandHelp,
  formatMcpList,
  formatToolDetails,
  formatToolList,
} from './list-commands.js';
// Naming utilities
export {
  formatMcpToolName,
  isBuiltinTool,
  isMcpTool,
  isValidMcpName,
  isValidPrefixedMcpName,
  isValidToolName,
  parseMcpToolName,
} from './naming.js';

// Registry
export { createMCPRegistry, MCPRegistry } from './registry.js';
export type { MCPClient } from './tool-adapter.js';

// Tool adapter
export {
  createFailingMCPClient,
  createMcpToolWrapper,
  createMcpToolWrappers,
  createMockMCPClient,
} from './tool-adapter.js';

// Type alias for backwards compatibility with list-commands expectations
export type MCPTool = MCPToolDefinition;
