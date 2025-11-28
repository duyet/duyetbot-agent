/**
 * xAI Tools Module
 *
 * Real-time search tools using xAI's Grok model:
 * - xai_web_search: Web search with citations
 * - xai_x_search: X (Twitter) search with citations
 *
 * These tools use the xAI Responses API with server-side tool execution.
 * Requires XAI_API_KEY environment variable.
 *
 * @see https://docs.x.ai/docs/guides/tools/search-tools
 */

import type { Tool } from '@duyetbot/types';

// Re-export everything from submodules
export * from './client.js';
export * from './web-search.js';
export * from './x-search.js';

// Import tool instances for convenience functions
import { xaiWebSearchTool } from './web-search.js';
import { xaiXSearchTool } from './x-search.js';

/**
 * Get all xAI search tools
 *
 * Returns both web search and X search tools.
 * Note: These tools require XAI_API_KEY in the ToolContext.env.
 */
export function getXAITools(): Tool[] {
  return [xaiWebSearchTool, xaiXSearchTool];
}

/**
 * Get xAI tool names
 *
 * Useful for logging and debugging.
 */
export function getXAIToolNames(): string[] {
  return getXAITools().map((tool) => tool.name);
}
