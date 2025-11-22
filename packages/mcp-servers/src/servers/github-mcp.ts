import type { MCPServerConfig } from '../types.js';

/**
 * GitHub MCP Server configuration
 * Requires GITHUB_TOKEN in environment
 */
export const githubMcp: MCPServerConfig = {
  name: 'github-mcp',
  url: 'https://api.githubcopilot.com/mcp/sse',
  requiresAuth: true,
  getOptions: (env) => ({
    transport: {
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN || ''}`,
      },
    },
  }),
};
