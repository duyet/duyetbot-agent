/**
 * MCP Server Status Types
 *
 * Types for tracking the health and connection status of MCP (Model Context Protocol) servers.
 */

/**
 * Status of an individual MCP server
 */
export type MCPServerStatusType = 'online' | 'offline' | 'disabled' | 'checking';

/**
 * Authentication status for MCP servers that require auth
 */
export type MCPAuthStatus = 'valid' | 'invalid' | 'missing' | 'not-required';

/**
 * Overall health status of all MCP servers
 */
export type MCPOverallStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Configuration for an MCP server to monitor
 */
export interface MCPServerConfig {
  /** Unique identifier for the server */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Server endpoint URL */
  url: string;
  /** Optional health check URL (defaults to url for SSE, url/health for HTTP) */
  healthCheckUrl?: string;
  /** Whether authentication is required */
  authRequired: boolean;
  /** Environment variable name for auth token */
  authEnvVar?: string;
  /** Whether the server is currently enabled */
  enabled: boolean;
  /** Server description */
  description: string;
  /** Transport type: 'sse' for Server-Sent Events, 'http' for REST */
  transport: 'sse' | 'http';
}

/**
 * Status response for a single MCP server
 */
export interface MCPServerStatus {
  /** Server identifier */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Server URL */
  url: string;
  /** Current connection status */
  status: MCPServerStatusType;
  /** Response time in milliseconds */
  responseTime?: number;
  /** List of available tools (when online) */
  tools?: string[];
  /** Number of available tools */
  toolCount?: number;
  /** Whether authentication is required */
  authRequired: boolean;
  /** Current authentication status */
  authStatus?: MCPAuthStatus;
  /** Timestamp of last health check */
  lastChecked: number;
  /** Last error message if status is offline */
  lastError?: string;
  /** Server description */
  description?: string;
  /** Whether the server is enabled */
  enabled?: boolean;
}

/**
 * API response for MCP status endpoint
 */
export interface MCPStatusResponse {
  /** Status of all monitored servers */
  servers: MCPServerStatus[];
  /** Overall health status */
  overallStatus: MCPOverallStatus;
  /** Timestamp when status was last updated */
  lastUpdated: number;
}

/**
 * Result from health check operation
 */
export interface HealthCheckResult {
  /** Connection status */
  status: MCPServerStatusType;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Error message if check failed */
  error?: string;
  /** HTTP status code if applicable */
  httpStatus?: number;
}
