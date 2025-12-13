/**
 * MCP Tool Naming Utilities
 *
 * Provides utilities for handling the standardized MCP tool naming convention:
 * Format: <mcp>__<tool> (e.g., "duyet__get_cv", "memory__fetch_user_data")
 *
 * This module ensures consistent naming across the MCP registry system,
 * distinguishes between builtin and MCP-sourced tools, and provides
 * bidirectional conversion between prefixed and unprefixed names.
 */

import { MCP_SEPARATOR } from './types.js';

/**
 * Format an MCP tool name into the standard prefixed format
 *
 * Combines MCP server name and tool name with the standard separator.
 * Validates input to ensure both parts are valid identifiers.
 *
 * @param mcpName - Name of the MCP server (e.g., "duyet", "memory")
 * @param toolName - Original tool name from the MCP server (e.g., "get_cv")
 * @returns Prefixed tool name (e.g., "duyet__get_cv")
 * @throws Error if mcpName or toolName is invalid
 *
 * @example
 * ```typescript
 * formatMcpToolName('duyet', 'get_cv') // => 'duyet__get_cv'
 * formatMcpToolName('memory', 'fetch_notes') // => 'memory__fetch_notes'
 * ```
 */
export function formatMcpToolName(mcpName: string, toolName: string): string {
  if (!isValidMcpName(mcpName)) {
    throw new Error(
      `Invalid MCP name '${mcpName}': must be lowercase letters, numbers, and underscores`
    );
  }

  if (!isValidToolName(toolName)) {
    throw new Error(
      `Invalid tool name '${toolName}': must be lowercase letters, numbers, and underscores`
    );
  }

  return `${mcpName}${MCP_SEPARATOR}${toolName}`;
}

/**
 * Parse a prefixed MCP tool name into its component parts
 *
 * Splits a prefixed tool name back into the MCP server name and original tool name.
 * Returns null if the name is not in the standard MCP format.
 *
 * @param prefixedName - Prefixed tool name (e.g., "duyet__get_cv")
 * @returns Object with mcpName and toolName, or null if not a valid MCP tool name
 *
 * @example
 * ```typescript
 * parseMcpToolName('duyet__get_cv') // => { mcpName: 'duyet', toolName: 'get_cv' }
 * parseMcpToolName('memory__fetch_notes') // => { mcpName: 'memory', toolName: 'fetch_notes' }
 * parseMcpToolName('read_file') // => null (not an MCP tool)
 * ```
 */
export function parseMcpToolName(
  prefixedName: string
): { mcpName: string; toolName: string } | null {
  const parts = prefixedName.split(MCP_SEPARATOR);

  // Must have exactly 2 parts
  if (parts.length !== 2) {
    return null;
  }

  const mcpName = parts[0];
  const toolName = parts[1];

  // Validate both parts - ensure they exist and are non-empty
  if (!mcpName || !toolName || !isValidMcpName(mcpName) || !isValidToolName(toolName)) {
    return null;
  }

  return { mcpName, toolName };
}

/**
 * Check if a tool name follows the MCP naming convention
 *
 * Determines whether a tool name is an MCP-sourced tool
 * (has the mcp__tool format) or a builtin tool.
 *
 * @param name - Tool name to check
 * @returns true if the name follows MCP naming convention
 *
 * @example
 * ```typescript
 * isMcpTool('duyet__get_cv') // => true
 * isMcpTool('memory__fetch_notes') // => true
 * isMcpTool('read_file') // => false
 * isMcpTool('search') // => false
 * ```
 */
export function isMcpTool(name: string): boolean {
  return parseMcpToolName(name) !== null;
}

/**
 * Check if a tool name is a builtin tool (not MCP-sourced)
 *
 * Determines whether a tool name is a builtin agent tool
 * rather than one sourced from an MCP server.
 *
 * @param name - Tool name to check
 * @returns true if the tool is NOT an MCP-sourced tool
 *
 * @example
 * ```typescript
 * isBuiltinTool('read_file') // => true
 * isBuiltinTool('search') // => true
 * isBuiltinTool('duyet__get_cv') // => false
 * isBuiltinTool('memory__fetch_notes') // => false
 * ```
 */
export function isBuiltinTool(name: string): boolean {
  return !isMcpTool(name);
}

/**
 * Validate an MCP server name
 *
 * Checks if a name is a valid MCP server identifier.
 * Valid names are lowercase letters, numbers, and underscores,
 * starting with a letter.
 *
 * @param name - Name to validate
 * @returns true if the name is a valid MCP server name
 *
 * @example
 * ```typescript
 * isValidMcpName('duyet') // => true
 * isValidMcpName('memory') // => true
 * isValidMcpName('my_server') // => true
 * isValidMcpName('MyServer') // => false (uppercase)
 * isValidMcpName('my-server') // => false (hyphens)
 * isValidMcpName('123') // => false (starts with number)
 * ```
 */
export function isValidMcpName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * Validate a tool name
 *
 * Checks if a tool name is valid for use in MCP naming.
 * Valid names are lowercase letters, numbers, and underscores,
 * starting with a letter.
 *
 * @param name - Name to validate
 * @returns true if the name is a valid tool name
 *
 * @example
 * ```typescript
 * isValidToolName('get_cv') // => true
 * isValidToolName('fetch_notes') // => true
 * isValidToolName('read_file') // => true
 * isValidToolName('GetCV') // => false (uppercase)
 * isValidToolName('get-cv') // => false (hyphens)
 * isValidToolName('123abc') // => false (starts with number)
 * ```
 */
export function isValidToolName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name);
}

/**
 * Validate a prefixed MCP tool name
 *
 * Checks if a name is a valid prefixed MCP tool name.
 *
 * @param name - Name to validate
 * @returns true if the name is a valid prefixed MCP tool name
 *
 * @example
 * ```typescript
 * isValidPrefixedMcpName('duyet__get_cv') // => true
 * isValidPrefixedMcpName('memory__fetch_notes') // => true
 * isValidPrefixedMcpName('read_file') // => false (not prefixed)
 * isValidPrefixedMcpName('duyet__GetCV') // => false (uppercase)
 * ```
 */
export function isValidPrefixedMcpName(name: string): boolean {
  const parsed = parseMcpToolName(name);
  return parsed !== null;
}
