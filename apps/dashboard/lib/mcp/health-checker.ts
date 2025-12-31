import { HEALTH_CHECK_TIMEOUT } from './config';
import type { HealthCheckResult, MCPServerConfig, MCPServerStatus } from './types';

/**
 * MCP Server Health Checker
 *
 * Checks the health status of MCP servers using different strategies:
 * - SSE servers: Fetch with timeout, check for successful connection
 * - HTTP servers: Call /health endpoint
 * - Disabled servers: Return 'disabled' status immediately
 */

/**
 * Check health of an SSE-based MCP server
 * Attempts to connect with a short timeout to verify the server is responding
 */
async function checkSseHealth(url: string, headers?: HeadersInit): Promise<HealthCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'online',
        responseTime,
        httpStatus: response.status,
      };
    }

    // Check for auth issues
    if (response.status === 401 || response.status === 403) {
      return {
        status: 'offline',
        responseTime,
        error: `Authentication failed (HTTP ${response.status})`,
        httpStatus: response.status,
      };
    }

    return {
      status: 'offline',
      responseTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
      httpStatus: response.status,
    };
  } catch (error) {
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          status: 'offline',
          responseTime,
          error: `Connection timeout (${HEALTH_CHECK_TIMEOUT}ms)`,
        };
      }
      return {
        status: 'offline',
        responseTime,
        error: error.message,
      };
    }

    return {
      status: 'offline',
      responseTime,
      error: 'Unknown error',
    };
  }
}

/**
 * Check health of an HTTP-based MCP server
 * Calls the /health endpoint and expects a 200 response
 */
async function checkHttpHealth(url: string): Promise<HealthCheckResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'online',
        responseTime,
        httpStatus: response.status,
      };
    }

    return {
      status: 'offline',
      responseTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
      httpStatus: response.status,
    };
  } catch (error) {
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          status: 'offline',
          responseTime,
          error: `Connection timeout (${HEALTH_CHECK_TIMEOUT}ms)`,
        };
      }
      return {
        status: 'offline',
        responseTime,
        error: error.message,
      };
    }

    return {
      status: 'offline',
      responseTime,
      error: 'Unknown error',
    };
  }
}

/**
 * Check health of a single MCP server
 *
 * @param config Server configuration
 * @param authToken Optional authentication token for servers that require auth
 */
export async function checkServerHealth(
  config: MCPServerConfig,
  authToken?: string
): Promise<MCPServerStatus> {
  const now = Date.now();

  // Disabled servers return immediately
  if (!config.enabled) {
    return {
      name: config.name,
      displayName: config.displayName,
      url: config.url,
      status: 'disabled',
      authRequired: config.authRequired,
      authStatus: config.authRequired ? 'not-required' : 'not-required',
      lastChecked: now,
      description: config.description,
      enabled: false,
    };
  }

  // Determine auth status
  let authStatus: MCPServerStatus['authStatus'] = 'not-required';
  let authHeaders: HeadersInit | undefined;

  if (config.authRequired) {
    if (authToken) {
      authStatus = 'valid'; // Assume valid, will be updated if check fails
      authHeaders = { Authorization: `Bearer ${authToken}` };
    } else {
      authStatus = 'missing';
    }
  }

  // Perform health check based on transport type
  let result: HealthCheckResult;

  if (config.transport === 'sse') {
    result = await checkSseHealth(config.url, authHeaders);
  } else {
    const healthUrl = config.healthCheckUrl || `${config.url}/health`;
    result = await checkHttpHealth(healthUrl);
  }

  // Update auth status based on result
  if (config.authRequired && result.httpStatus === 401) {
    authStatus = 'invalid';
  }

  return {
    name: config.name,
    displayName: config.displayName,
    url: config.url,
    status: result.status,
    responseTime: result.responseTime,
    authRequired: config.authRequired,
    authStatus,
    lastChecked: now,
    lastError: result.error,
    description: config.description,
    enabled: config.enabled,
  };
}
