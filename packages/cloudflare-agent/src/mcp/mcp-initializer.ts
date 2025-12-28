import { logger } from '@duyetbot/hono-middleware';
import type { Agent } from 'agents';
import type { CloudflareAgentState, MCPServerConnection } from '../cloudflare-agent.js';

/**
 * Handles initialization of MCP server connections.
 */
export class MCPInitializer<TEnv extends Cloudflare.Env> {
  constructor(
    private agent: Agent<TEnv, CloudflareAgentState>,
    private mcpServers: MCPServerConnection[],
    private getEnv: () => TEnv
  ) {}

  /**
   * Initialize MCP server connections with timeout
   * Uses the new addMcpServer() API which handles
   * registration, connection, and discovery in one call
   */
  async initialize(isInitialized: boolean): Promise<void> {
    if (isInitialized || this.mcpServers.length === 0) {
      return;
    }

    const env = this.getEnv();
    // const CONNECTION_TIMEOUT = 10000; // 10 seconds per connection (implicit in agent SDK)

    for (const server of this.mcpServers) {
      try {
        const authHeader = server.getAuthHeader?.(env as Record<string, unknown>);
        const transportOptions = authHeader
          ? {
              headers: {
                Authorization: authHeader,
              },
            }
          : undefined;

        logger.info(`[CloudflareAgent][MCP] Connecting to ${server.name} at ${server.url}`);
        logger.debug(
          `[CloudflareAgent][MCP] Auth header present: ${!!authHeader}, length: ${authHeader?.length || 0}`
        );

        // Use the new addMcpServer() API which combines registerServer() + connectToServer()
        // This is the recommended approach for agents SDK v0.2.24+
        await this.agent.addMcpServer(
          server.name,
          server.url,
          '', // callbackHost - empty string for non-OAuth servers
          '', // agentsPrefix - empty string uses default
          transportOptions ? { transport: transportOptions } : undefined
        );

        logger.info(`[CloudflareAgent][MCP] Connected to ${server.name}`);
      } catch (err) {
        logger.error(`[CloudflareAgent][MCP] Failed to connect to ${server.name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue to next server even if one fails
      }
    }
  }
}
