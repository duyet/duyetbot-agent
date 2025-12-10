import type { MCPServerConfig } from './types';

/**
 * MCP Server Configuration
 *
 * Defines all MCP servers to monitor in the dashboard.
 * This configuration is used by the health checker and status API.
 */
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'github-mcp',
    displayName: 'GitHub MCP',
    url: 'https://api.githubcopilot.com/mcp/sse',
    authRequired: true,
    authEnvVar: 'GITHUB_TOKEN',
    enabled: true,
    description: 'GitHub Copilot MCP server for repository operations, PRs, issues, and workflows',
    transport: 'sse',
  },
  {
    name: 'duyet-mcp',
    displayName: 'Duyet MCP',
    url: 'https://mcp.duyet.net/sse',
    authRequired: false,
    enabled: false, // Disabled due to 30s timeout issues
    description:
      'Personal MCP server for blog posts, CV, and GitHub activity (temporarily disabled)',
    transport: 'sse',
  },
  {
    name: 'memory-mcp',
    displayName: 'Memory MCP',
    url: 'https://duyetbot-memory.workers.dev',
    healthCheckUrl: 'https://duyetbot-memory.workers.dev/health',
    authRequired: false,
    enabled: true,
    description: 'Cross-session memory storage with D1 backend for persistent context',
    transport: 'http',
  },
];

/**
 * Health check timeout in milliseconds
 */
export const HEALTH_CHECK_TIMEOUT = 3000;

/**
 * Get server configuration by name
 */
export function getServerConfig(name: string): MCPServerConfig | undefined {
  return MCP_SERVERS.find((s) => s.name === name);
}

/**
 * Get all enabled servers
 */
export function getEnabledServers(): MCPServerConfig[] {
  return MCP_SERVERS.filter((s) => s.enabled);
}

/**
 * Get all server names
 */
export function getServerNames(): string[] {
  return MCP_SERVERS.map((s) => s.name);
}
