import type { MCPServerConfig } from '../types.js';

/**
 * Duyet MCP Server configuration
 *
 * Provides tools for:
 * - About/CV information
 * - Blog posts from blog.duyet.net
 * - GitHub activity
 * - Web search and fetch
 * - Contact/messaging
 *
 * @see https://github.com/duyet/duyet-mcp-server
 */
export const duyetMcp: MCPServerConfig = {
  name: 'duyet-mcp',
  url: 'https://mcp.duyet.net/sse',
  requiresAuth: false,
};
