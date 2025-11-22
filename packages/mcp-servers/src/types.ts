/**
 * MCP Server configuration types
 */

/**
 * MCP client options matching Cloudflare Agents SDK
 */
export interface MCPClientOptions {
  client?: {
    name?: string;
    version?: string;
  };
  transport?: {
    headers?: Record<string, string>;
    type?: 'sse' | 'streamableHttp';
  };
}

export interface MCPServerConfig {
  /** Unique server name */
  name: string;
  /** Server URL (SSE or HTTP endpoint) */
  url: string;
  /** Whether authentication is required */
  requiresAuth?: boolean;
  /** Get options including headers for authenticated requests */
  getOptions?: (env: Record<string, unknown>) => MCPClientOptions;
}

/** Available MCP server names */
export type MCPServerName = 'duyet-mcp' | 'github-mcp';
