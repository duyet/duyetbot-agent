/**
 * Agent Tools Library
 *
 * Converts tools from @duyetbot/tools to AI SDK v6 format.
 */

import { getCloudflareTools } from '@duyetbot/tools';
import type { Tool } from '@duyetbot/types';
import { tool } from 'ai';

/**
 * Convert a package Tool to AI SDK v6 tool format
 */
function toAISDKTool(pkgTool: Tool) {
  return tool({
    description: pkgTool.description,
    inputSchema: pkgTool.inputSchema,
    execute: async (input) => pkgTool.execute(input),
  });
}

/**
 * Get Cloudflare-safe tools converted to AI SDK v6 format
 *
 * Uses getCloudflareTools() which returns tools safe for serverless environments:
 * - plan: Create structured plans for complex tasks
 * - research: Search the web for current information
 * - scratchpad: Store and retrieve temporary notes
 */
const cloudflareTools = getCloudflareTools();

/**
 * Agent tools exported as an object keyed by tool name
 *
 * Compatible with AI SDK v6 streamText() tools parameter
 */
export const agentTools = Object.fromEntries(
  cloudflareTools.map((t) => [t.name, toAISDKTool(t)])
) as Record<string, ReturnType<typeof toAISDKTool>>;

export type AgentTools = typeof agentTools;
