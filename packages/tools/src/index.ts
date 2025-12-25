/**
 * Tools Module
 *
 * Built-in tools for agent operations:
 * - bash: Execute shell commands
 * - git: Git operations
 * - research: Web research (DuckDuckGo)
 * - plan: Task planning
 * - sleep: Delay execution
 * - scratchpad: Temporary note storage
 * - duyet_mcp_client: Access duyet profile info via MCP server
 */

import type { Tool } from '@duyetbot/types';
import { bashTool } from './bash.js';
import { duyetMCPClientTool } from './duyet-mcp-client.js';
import { gitTool } from './git.js';
import { planTool } from './plan.js';
import { researchTool } from './research.js';
import { scratchpadTool } from './scratchpad.js';
import { sleepTool } from './sleep.js';
import { telegramForwardTool } from './telegram-forward.js';

export * from './bash.js';
export * from './duyet-mcp-client.js';
export * from './git.js';
export * from './github.js';
export * from './plan.js';
export * from './registry.js';
export * from './research.js';
export * from './scratchpad.js';
export * from './sleep.js';
export * from './telegram-forward.js';

/**
 * Agent platform types
 */
export type AgentPlatform = 'cli' | 'server' | 'telegram' | 'github';

/**
 * Get all built-in tools
 *
 * Returns the standard set of tools that don't require external context.
 * Note: github tool requires Octokit instance, use createGitHubTool() separately.
 */
export function getAllBuiltinTools(): Tool[] {
  return [
    bashTool,
    gitTool,
    planTool,
    researchTool,
    scratchpadTool,
    sleepTool,
    telegramForwardTool,
  ];
}

/**
 * Get tools that are safe for serverless/cloudflare workers environments
 *
 * Excludes tools that require:
 * - Shell access (bash)
 * - Local git installation (git)
 * - Long-running processes (sleep)
 */
export function getCloudflareTools(): Tool[] {
  return [planTool, duyetMCPClientTool, researchTool, scratchpadTool, telegramForwardTool];
}

/**
 * Get tools appropriate for a specific platform
 *
 * Platform capabilities:
 * - cli: Full access to all local tools (bash, git, etc.)
 * - server: Full access to all local tools
 * - telegram: Cloudflare Workers - no shell/git access
 * - github: Cloudflare Workers - no shell/git access
 *
 * @param platform - The agent platform type
 * @returns Array of tools appropriate for the platform
 */
export function getPlatformTools(platform: AgentPlatform): Tool[] {
  switch (platform) {
    case 'cli':
    case 'server':
      // Full access - can run bash, git, etc.
      return getAllBuiltinTools();

    case 'telegram':
    case 'github':
      // Cloudflare Workers - limited to safe tools
      // These platforms rely on MCP servers for GitHub operations
      return getCloudflareTools();

    default:
      // Default to safe tools for unknown platforms
      return getCloudflareTools();
  }
}

/**
 * Get tool names for a specific platform
 *
 * Useful for logging and debugging
 */
export function getPlatformToolNames(platform: AgentPlatform): string[] {
  return getPlatformTools(platform).map((tool) => tool.name);
}
