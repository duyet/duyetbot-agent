import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { MCP_SERVERS } from '@/lib/mcp/config';
import { checkServerHealth } from '@/lib/mcp/health-checker';
import type { MCPOverallStatus, MCPStatusResponse } from '@/lib/mcp/types';
import { handleRouteError } from '../../types';

/**
 * GET /api/mcp/status
 * Returns health status of all MCP servers
 *
 * Response includes:
 * - Individual server status (online/offline/disabled)
 * - Overall health (healthy/degraded/unhealthy)
 * - Response times and error details
 */
export async function GET(): Promise<NextResponse> {
  try {
    const { env } = await getCloudflareContext();
    const githubToken = env.GITHUB_TOKEN;

    // Check all servers in parallel
    const serverStatusPromises = MCP_SERVERS.map((config) => {
      // Pass GITHUB_TOKEN for github-mcp server
      const authToken = config.name === 'github-mcp' ? githubToken : undefined;
      return checkServerHealth(config, authToken);
    });

    const servers = await Promise.all(serverStatusPromises);

    // Calculate overall status
    const enabledServers = servers.filter((s) => s.enabled);
    const onlineServers = enabledServers.filter((s) => s.status === 'online');
    const offlineServers = enabledServers.filter((s) => s.status === 'offline');

    let overallStatus: MCPOverallStatus;
    if (enabledServers.length === 0) {
      // No enabled servers = unhealthy
      overallStatus = 'unhealthy';
    } else if (offlineServers.length === 0) {
      // All enabled servers are online = healthy
      overallStatus = 'healthy';
    } else if (onlineServers.length > 0) {
      // Some online, some offline = degraded
      overallStatus = 'degraded';
    } else {
      // All enabled servers are offline = unhealthy
      overallStatus = 'unhealthy';
    }

    const response: MCPStatusResponse = {
      servers,
      overallStatus,
      lastUpdated: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleRouteError(error);
  }
}
