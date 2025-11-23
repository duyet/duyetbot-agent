// Note: duyetMcp temporarily disabled due to 30s timeout issues
import { githubMcp } from './servers/index.js';
import type { MCPServerConfig, MCPServerName } from './types.js';

/**
 * Agent interface with MCP client capabilities
 * The addMcpServer method is available in Cloudflare Agents SDK
 */
interface AgentWithMcp {
  addMcpServer(
    serverName: string,
    url: string,
    callbackHost?: string,
    agentsPrefix?: string,
    options?: any
  ): Promise<{ id: string; authUrl: string | undefined }>;
}

/**
 * Registry of all available MCP servers
 * Note: duyet-mcp temporarily disabled due to 30s timeout issues
 */
const mcpServers: Record<MCPServerName, MCPServerConfig> = {
  // 'duyet-mcp': duyetMcp,  // Temporarily disabled - 30s timeout
  'github-mcp': githubMcp,
};

export interface RegisterMcpOptions {
  /** Callback host URL for OAuth flows (required when not in request context) */
  callbackHost?: string;
  /** Agents prefix for routing */
  agentsPrefix?: string;
}

// Global callback host setting
let globalCallbackHost: string | undefined;

/**
 * Set the global callback host for all MCP server registrations
 */
export function setMcpCallbackHost(host: string): void {
  globalCallbackHost = host;
  console.log(`[MCP] Set global callbackHost: ${host}`);
}

/**
 * Register a single MCP server with an agent
 *
 * @example
 * ```typescript
 * class MyAgent extends Agent {
 *   async onStart() {
 *     await registerMcpServer(this, 'duyet-mcp', this.env, {
 *       callbackHost: 'https://my-worker.workers.dev'
 *     });
 *     await registerMcpServer(this, 'github-mcp', this.env, {
 *       callbackHost: 'https://my-worker.workers.dev'
 *     });
 *   }
 * }
 * ```
 */
export async function registerMcpServer(
  agent: AgentWithMcp,
  serverName: MCPServerName,
  env: any,
  options?: RegisterMcpOptions
): Promise<void> {
  const config = mcpServers[serverName];
  if (!config) {
    console.warn(`[MCP] Server "${serverName}" not found in registry`);
    return;
  }

  const serverOptions = config.getOptions?.(env);
  const callbackHost = options?.callbackHost || globalCallbackHost;

  console.log(`[MCP] Registering "${config.name}" at ${config.url}`);
  console.log(`[MCP] - callbackHost: ${callbackHost || 'not set'}`);
  console.log(`[MCP] - agentsPrefix: ${options?.agentsPrefix || 'not set'}`);
  console.log('[MCP] - options:', serverOptions || 'none');

  try {
    const result = await agent.addMcpServer(
      config.name,
      config.url,
      callbackHost,
      options?.agentsPrefix,
      serverOptions
    );
    console.log(
      `[MCP] ✅ Registered "${config.name}" - id: ${result.id}, authUrl: ${result.authUrl || 'none'}`
    );
  } catch (error) {
    console.error(`[MCP] ❌ Failed to register "${config.name}":`, error);
  }
}

/**
 * Get MCP server configuration by name
 */
export function getMcpServer(name: MCPServerName): MCPServerConfig | undefined {
  return mcpServers[name];
}

/**
 * Get all available MCP server names
 */
export function getAvailableMcpServers(): MCPServerName[] {
  return Object.keys(mcpServers) as MCPServerName[];
}
