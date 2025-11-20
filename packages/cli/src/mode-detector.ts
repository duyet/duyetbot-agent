/**
 * Mode Detector
 *
 * Automatically detects whether to use cloud or local mode
 * based on network connectivity and configuration
 */

import type { CLIConfig } from './config.js';

export interface ModeDetectionResult {
  mode: 'local' | 'cloud';
  reason: string;
  mcpAvailable?: boolean;
}

/**
 * Check if MCP server is reachable
 */
export async function checkMCPServer(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Detect the appropriate mode based on configuration and network
 */
export async function detectMode(config: CLIConfig): Promise<ModeDetectionResult> {
  // If mode is explicitly set to local, use it
  if (config.mode === 'local') {
    return {
      mode: 'local',
      reason: 'Mode explicitly set to local',
    };
  }

  // If no MCP server URL configured, use local
  if (!config.mcpServerUrl) {
    return {
      mode: 'local',
      reason: 'No MCP server URL configured',
    };
  }

  // If no authentication, use local
  if (!config.auth?.githubToken) {
    return {
      mode: 'local',
      reason: 'Not authenticated (no GitHub token)',
    };
  }

  // Check if MCP server is reachable
  const mcpAvailable = await checkMCPServer(config.mcpServerUrl);

  if (mcpAvailable) {
    return {
      mode: 'cloud',
      reason: 'MCP server is reachable',
      mcpAvailable: true,
    };
  }

  return {
    mode: 'local',
    reason: 'MCP server is not reachable',
    mcpAvailable: false,
  };
}

/**
 * Get mode with automatic detection if configured
 */
export async function getEffectiveMode(
  config: CLIConfig,
  options?: { forceLocal?: boolean; forceCloud?: boolean; autoDetect?: boolean }
): Promise<ModeDetectionResult> {
  // Force options take precedence
  if (options?.forceLocal) {
    return {
      mode: 'local',
      reason: 'Forced local mode via --local flag',
    };
  }

  if (options?.forceCloud) {
    if (!config.mcpServerUrl) {
      return {
        mode: 'local',
        reason: 'Forced cloud mode but no MCP server configured',
      };
    }
    return {
      mode: 'cloud',
      reason: 'Forced cloud mode via --cloud flag',
    };
  }

  // Auto-detect if requested or if mode is not explicitly set
  if (options?.autoDetect || config.mode === 'cloud') {
    return detectMode(config);
  }

  // Default to configured mode
  return {
    mode: config.mode,
    reason: `Using configured mode: ${config.mode}`,
  };
}
