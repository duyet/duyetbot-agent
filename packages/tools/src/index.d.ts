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
 */
import type { Tool } from '@duyetbot/types';
export * from './bash.js';
export * from './git.js';
export * from './github.js';
export * from './plan.js';
export * from './registry.js';
export * from './research.js';
export * from './scratchpad.js';
export * from './sleep.js';
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
export declare function getAllBuiltinTools(): Tool[];
/**
 * Get tools that are safe for serverless/cloudflare workers environments
 *
 * Excludes tools that require:
 * - Shell access (bash)
 * - Local git installation (git)
 * - Long-running processes (sleep)
 */
export declare function getCloudflareTools(): Tool[];
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
export declare function getPlatformTools(platform: AgentPlatform): Tool[];
/**
 * Get tool names for a specific platform
 *
 * Useful for logging and debugging
 */
export declare function getPlatformToolNames(platform: AgentPlatform): string[];
//# sourceMappingURL=index.d.ts.map
