/**
 * Agentic Loop Tools Registry
 *
 * Central export for all built-in tools available in the agentic loop.
 * Provides tool exports, factory functions, and helper utilities for tool management.
 *
 * Available tools:
 * - plan: Task decomposition and planning
 * - research: Web search and information retrieval
 * - memory: Personal information lookup
 * - github: GitHub API operations
 * - subagent: Delegate independent subtasks
 * - request_approval: Request human approval
 */

// ============================================================================
// Individual Tool Imports and Exports
// ============================================================================

import { approvalTool, createApprovalRequest, formatApprovalResult } from './approval.js';
export { approvalTool, createApprovalRequest, formatApprovalResult };
export type { ApprovalRequest } from './approval.js';

import { createPlanTool, planTool } from './plan.js';
export { createPlanTool, planTool };

import { researchTool } from './research.js';
export { researchTool };

import { memoryTool } from './memory.js';
export { memoryTool };

import { createGitHubTool, githubTool } from './github.js';
export { createGitHubTool, githubTool };

import { subagentTool } from './subagent.js';
export { subagentTool };

// ============================================================================
// Type Definitions
// ============================================================================

import type { LoopTool } from '../types.js';

/**
 * MCP Client interface for tools that need external service access
 */
export interface MCPClient {
  callTool(
    server: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: string; text: string }> }>;
}

/**
 * LLM Provider interface for tools that perform reasoning
 */
export interface LLMProvider {
  generate(
    messages: Array<{ role: string; content: string }>,
    options?: Record<string, unknown>
  ): Promise<string>;
}

/**
 * Configuration for creating core tools
 */
export interface CoreToolsConfig {
  mcpClient?: MCPClient;
  provider?: LLMProvider;
  enableSubagents?: boolean;
  isSubagent?: boolean;
}

// ============================================================================
// Core Tools Factory
// ============================================================================

/**
 * Create an array of all available core tools
 *
 * Subagent tool is excluded when isSubagent=true to prevent recursion.
 *
 * @param config - Optional tool configuration
 * @returns Array of available tools
 */
export function createCoreTools(config?: CoreToolsConfig): LoopTool[] {
  const tools: LoopTool[] = [];

  tools.push(planTool);
  tools.push(researchTool);
  tools.push(memoryTool);
  tools.push(githubTool);

  if (config?.enableSubagents !== false && !config?.isSubagent) {
    tools.push(subagentTool);
  }

  tools.push(approvalTool);

  return tools;
}

// ============================================================================
// Tool Lookup Helpers
// ============================================================================

/**
 * Find a tool by name
 */
export function getToolByName(tools: LoopTool[], name: string): LoopTool | undefined {
  return tools.find((tool) => tool.name === name);
}

/**
 * Get all tool names
 */
export function getToolNames(tools: LoopTool[]): string[] {
  return tools.map((tool) => tool.name);
}

/**
 * Check if a tool exists by name
 */
export function hasToolByName(tools: LoopTool[], name: string): boolean {
  return tools.some((tool) => tool.name === name);
}

/**
 * Get multiple tools by name
 */
export function getToolsByName(tools: LoopTool[], names: string[]): LoopTool[] {
  return names
    .map((name) => getToolByName(tools, name))
    .filter((tool): tool is LoopTool => tool !== undefined);
}

/**
 * Get the count of available tools
 */
export function getToolCount(tools: LoopTool[]): number {
  return tools.length;
}

/**
 * Validate that all required tools are available
 */
export function validateRequiredTools(
  tools: LoopTool[],
  required: string[]
): { valid: boolean; missing: string[] } {
  const missing = required.filter((name) => !hasToolByName(tools, name));
  return { valid: missing.length === 0, missing };
}
