import type { MCPServerConfig } from '../types.js';

/**
 * Local Memory MCP Server configuration
 *
 * Provides in-memory storage and retrieval capabilities:
 * - Short-term memory (session-based)
 * - Long-term memory (persistent)
 * - Semantic search across memories
 * - Memory categorization and tagging
 *
 * This server runs locally on Cloudflare Workers with D1 database backing.
 */
export const localMemoryMcp: MCPServerConfig = {
  name: 'local-memory-mcp',
  url: 'http://localhost:9222/sse', // Local development
  requiresAuth: false,
  getOptions: (env) => ({
    client: {
      name: 'duyetbot-agent',
      version: '1.0.0',
    },
    transport: {
      type: 'sse',
      headers: {
        'X-Session-ID': (env.SESSION_ID as string) || 'default',
      },
    },
  }),
};

/**
 * Local Search MCP Server configuration
 *
 * Provides search capabilities:
 * - Web search integration
 * - Local document search
 * - Semantic search across conversations
 * - Query expansion and refinement
 */
export const localSearchMcp: MCPServerConfig = {
  name: 'local-search-mcp',
  url: 'http://localhost:9223/sse', // Local development
  requiresAuth: false,
  getOptions: (env) => ({
    client: {
      name: 'duyetbot-agent',
      version: '1.0.0',
    },
    transport: {
      type: 'sse',
      headers: {
        'X-Search-Source': (env.SEARCH_SOURCE as string) || 'local',
      },
    },
  }),
};

/**
 * Local Tools MCP Server configuration
 *
 * Provides built-in tool implementations:
 * - File system operations (read, write, list)
 * - Shell command execution
 * - Git operations
 * - GitHub API integration
 * - Code analysis tools
 */
export const localToolsMcp: MCPServerConfig = {
  name: 'local-tools-mcp',
  url: 'http://localhost:9224/sse', // Local development
  requiresAuth: true, // Tools can be dangerous
  getOptions: (env) => ({
    client: {
      name: 'duyetbot-agent',
      version: '1.0.0',
    },
    transport: {
      type: 'sse',
      headers: {
        Authorization: `Bearer ${env.TOOLS_API_KEY || 'insecure-dev-key'}`,
        'X-Tool-Permissions': (env.TOOL_PERMISSIONS as string) || 'read,write,execute',
      },
    },
  }),
};

/**
 * Production Memory MCP Server configuration
 *
 * Points to the deployed memory-mcp Cloudflare Worker.
 * Used in production instead of local development server.
 */
export const productionMemoryMcp: MCPServerConfig = {
  name: 'production-memory-mcp',
  url: 'https://memory-mcp.duyetbot.workers.dev/sse',
  requiresAuth: true,
  getOptions: (env) => ({
    client: {
      name: 'duyetbot-agent',
      version: '1.0.0',
    },
    transport: {
      type: 'sse',
      headers: {
        Authorization: `Bearer ${env.MEMORY_API_KEY || env.API_KEY}`,
        'X-Session-ID': (env.SESSION_ID as string) || 'default',
      },
    },
  }),
};

/**
 * Environment-aware Memory MCP selector
 *
 * Returns the appropriate memory MCP server based on environment:
 * - Development: local-memory-mcp
 * - Production: production-memory-mcp
 */
export function getMemoryMcp(env: Record<string, unknown> = {}): MCPServerConfig {
  const isDevelopment = env.NODE_ENV === 'development' || env.CF_PAGES !== '1';

  if (isDevelopment) {
    return localMemoryMcp;
  }

  return productionMemoryMcp;
}

/**
 * Available local MCP servers for development
 */
export const localMcpServers = [localMemoryMcp, localSearchMcp, localToolsMcp] as const;

/** Local MCP server names */
export type LocalMcpServerName = (typeof localMcpServers)[number]['name'];
