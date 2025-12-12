/**
 * Memory Tool for Agentic Loop
 *
 * Wraps the Duyet MCP server (mcp.duyet.net) for personal information queries.
 * Provides access to blog posts, CV, contact info, skills, and other personal data.
 *
 * This tool handles queries about Duyet including:
 * - Blog posts and articles
 * - CV and professional experience
 * - Skills and expertise
 * - Contact information
 * - Bio and background
 *
 * @example
 * ```typescript
 * const result = await memoryTool.execute(
 *   { query: 'latest blog posts', action: 'get_blog_posts' },
 *   ctx
 * );
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopContext, LoopTool, ToolResult } from '../types.js';

/**
 * Memory tool for retrieving personal information about Duyet
 *
 * Uses the MCP server when available, falls back to stub responses during development.
 * The tool gracefully handles MCP server unavailability with fallback messages.
 */
export const memoryTool: LoopTool = {
  name: 'memory',
  description:
    'Retrieve personal information about Duyet including blog posts, CV, skills, experience, and contact info. Use for queries about "who is duyet", "duyet\'s blog", "your CV", "your skills", etc.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The information to look up (e.g., "latest blog posts", "cv", "contact info", "skills", "about duyet")',
      },
      action: {
        type: 'string',
        enum: ['search', 'get_blog_posts', 'get_cv', 'get_contact', 'get_skills'],
        description: 'Specific action to perform when provided',
      },
    },
    required: ['query'],
  },

  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();
    const query = args.query as string;
    const action = (args.action as string) || 'search';

    try {
      logger.debug('[MemoryTool] Executing memory lookup', {
        query,
        action,
        traceId: ctx.executionContext.traceId,
      });

      // TODO: Wire up MCP client integration
      // When MCP is available, extract the client from ctx:
      // const mcpClient = ctx.executionContext.mcp;
      // if (!mcpClient) {
      //   return createFallbackResponse(query, action, startTime);
      // }
      //
      // Call the appropriate MCP tool based on action:
      // - 'get_blog_posts' -> call blogs_list or search_blogs
      // - 'get_cv' -> call get_profile or get_cv
      // - 'get_contact' -> call get_contact or get_email
      // - 'get_skills' -> call get_skills or get_expertise
      // - 'search' (default) -> call search or general_search
      //
      // Example MCP call:
      // const result = await mcpClient.call_tool({
      //   name: 'duyet_blog_search',
      //   arguments: { query }
      // });

      // Stub response - matches the request format
      const fallbackResponse = generateFallbackResponse(query, action);

      return {
        success: true,
        output: fallbackResponse,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('[MemoryTool] Memory lookup failed', {
        error: errorMessage,
        query,
        action,
        traceId: ctx.executionContext.traceId,
      });

      // Return a graceful error response instead of failing the tool
      // This allows the agent to continue reasoning even if memory is unavailable
      return {
        success: false,
        output: `Memory lookup unavailable for: "${query}". The personal information service is currently unavailable. Please try again later.`,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Generate a fallback response when MCP is unavailable
 *
 * Creates a reasonable response based on the action type and query.
 * This allows the agent to continue reasoning during development.
 *
 * @param query - The user's query
 * @param action - The requested action
 * @returns A formatted fallback response
 */
function generateFallbackResponse(query: string, action: string): string {
  switch (action) {
    case 'get_blog_posts':
      return `Blog posts lookup for: "${query}" (stub - MCP not yet configured)`;

    case 'get_cv':
      return `CV lookup for: "${query}" (stub - MCP not yet configured)`;

    case 'get_contact':
      return `Contact information lookup for: "${query}" (stub - MCP not yet configured)`;

    case 'get_skills':
      return `Skills lookup for: "${query}" (stub - MCP not yet configured)`;

    case 'search':
    default:
      return `Memory lookup for: "${query}" (stub - MCP not yet configured)`;
  }
}

/**
 * Convert memory tool action to MCP tool name
 *
 * Maps the standardized action names to actual MCP tool names.
 * This provides a layer of abstraction for future MCP integration.
 *
 * @param action - The action from tool arguments
 * @returns MCP tool name to call
 *
 * @example
 * ```typescript
 * const mcpToolName = actionToMcpTool('get_blog_posts');
 * // Returns: 'duyet_blog_search'
 * ```
 */
export function actionToMcpTool(action: string): string {
  switch (action) {
    case 'get_blog_posts':
      return 'duyet_blog_search';
    case 'get_cv':
      return 'duyet_profile';
    case 'get_contact':
      return 'duyet_contact';
    case 'get_skills':
      return 'duyet_skills';
    case 'search':
    default:
      return 'duyet_search';
  }
}

/**
 * Type guard to check if MCP client is available in execution context
 *
 * Used to safely check for MCP availability before attempting calls.
 *
 * @param ctx - The loop context
 * @returns True if MCP client is available
 */
export function hasMcpClient(ctx: LoopContext): boolean {
  return (
    ctx.executionContext !== undefined &&
    'mcp' in ctx.executionContext &&
    ctx.executionContext.mcp !== undefined &&
    ctx.executionContext.mcp !== null
  );
}
