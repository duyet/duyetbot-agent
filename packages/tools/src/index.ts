/**
 * Tools Module
 *
 * Built-in tools for agent operations:
 * - bash: Execute shell commands
 * - git: Git operations
 * - research: Web research
 * - plan: Task planning
 * - sleep: Delay execution
 */

import type { Tool } from '@duyetbot/types';
import { bashTool } from './bash.js';
import { gitTool } from './git.js';
import { planTool } from './plan.js';
import { researchTool } from './research.js';
import { scratchpadTool } from './scratchpad.js';
import { sleepTool } from './sleep.js';

export * from './sleep.js';
export * from './plan.js';
export * from './bash.js';
export * from './git.js';
export * from './research.js';
export * from './registry.js';
export * from './github.js';
export * from './scratchpad.js';

/**
 * Get all built-in tools
 *
 * Returns the standard set of tools that don't require external context.
 * Note: github tool requires Octokit instance, use createGitHubTool() separately.
 */
export function getAllBuiltinTools(): Tool[] {
  return [bashTool, gitTool, planTool, researchTool, scratchpadTool, sleepTool];
}
