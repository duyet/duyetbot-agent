/**
 * Duyet MCP Tool for Agentic Loop
 *
 * Provides access to Duyet's personal information via the MCP server at mcp.duyet.net.
 * This tool handles queries about blog posts, CV, skills, experience, and contact info.
 *
 * Unlike the DuyetInfoAgent (DO-based), this tool executes within workflow steps
 * and is stateless - each call establishes a new MCP connection.
 *
 * @example
 * ```typescript
 * const result = await duyetMcpTool.execute(
 *   { query: 'latest blog posts' },
 *   ctx
 * );
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { LoopTool, ToolResult } from '../types.js';

/**
 * MCP Server configuration
 */
const DUYET_MCP_URL = 'https://mcp.duyet.net/sse';

/**
 * Timeouts for MCP operations (conservative to fit in 30s workflow step)
 */
const TIMEOUTS = {
  /** Tool execution timeout */
  execution: 10000, // 10s
  /** Connect timeout for SSE */
  connect: 5000, // 5s
} as const;

/**
 * Filter function to identify relevant Duyet tools from MCP server
 *
 * Matches tools related to:
 * - Blog content (posts, articles, tags, categories)
 * - Personal info (CV, bio, contact, skills, experience)
 */
export function duyetToolFilter(toolName: string): boolean {
  const patterns = [
    // Blog tools
    /blog/i,
    /post/i,
    /article/i,
    /tag/i,
    /categor/i,
    /feed/i,
    /rss/i,
    /content/i,
    /search.*blog/i,
    /latest/i,
    /recent/i,
    // Info tools
    /about/i,
    /cv/i,
    /contact/i,
    /info/i,
    /bio/i,
    /profile/i,
    /experience/i,
    /skill/i,
    /education/i,
    /certificate/i,
  ];
  return patterns.some((pattern) => pattern.test(toolName));
}

/**
 * Infer the most appropriate MCP tool based on the query
 *
 * Maps natural language queries to specific MCP tool names.
 *
 * @param query - User's query about Duyet
 * @returns Inferred MCP tool name
 */
export function inferMcpToolFromQuery(query: string): string {
  const lower = query.toLowerCase();

  // Blog-related queries
  if (/blog|post|article|latest|recent|write|wrote/.test(lower)) {
    return 'get_latest_posts';
  }

  // CV/experience queries
  if (/cv|resume|experience|work|job|career|employment/.test(lower)) {
    return 'get_cv';
  }

  // Skills queries
  if (/skill|expertise|know|tech|technology|programming|language/.test(lower)) {
    return 'get_skills';
  }

  // Contact queries
  if (/contact|email|reach|connect|social|linkedin|github/.test(lower)) {
    return 'get_contact';
  }

  // Bio/about queries
  if (/who|about|bio|introduce|background/.test(lower)) {
    return 'get_about';
  }

  // Education queries
  if (/education|school|university|degree|study/.test(lower)) {
    return 'get_education';
  }

  // Default: general search
  return 'search';
}

/**
 * Fallback responses when MCP is unavailable
 */
const FALLBACK_RESPONSES = {
  blog: `I couldn't fetch the latest blog posts right now. You can visit blog.duyet.net directly for the most recent articles.`,
  cv: `I'm unable to retrieve the CV information at the moment. Please visit duyet.net/cv for the full resume.`,
  skills: `I couldn't access the skills information. Duyet has expertise in Data Engineering, Apache Spark, Python, TypeScript, and cloud platforms.`,
  contact: `I couldn't retrieve the contact information. You can reach Duyet via:
- Blog: blog.duyet.net
- GitHub: github.com/duyet
- LinkedIn: linkedin.com/in/duyet`,
  about: `I'm having trouble accessing the bio. Duyet is a Data Engineer with experience in building scalable data pipelines and infrastructure.`,
  default: `I'm experiencing difficulties connecting to the personal information service. Please try again later or visit duyet.net directly.`,
} as const;

/**
 * Get appropriate fallback response based on query type
 */
function getFallbackResponse(query: string): string {
  const lower = query.toLowerCase();

  if (/blog|post|article|latest|recent/.test(lower)) {
    return FALLBACK_RESPONSES.blog;
  }
  if (/cv|resume|experience|work/.test(lower)) {
    return FALLBACK_RESPONSES.cv;
  }
  if (/skill|expertise|tech/.test(lower)) {
    return FALLBACK_RESPONSES.skills;
  }
  if (/contact|email|reach/.test(lower)) {
    return FALLBACK_RESPONSES.contact;
  }
  if (/who|about|bio/.test(lower)) {
    return FALLBACK_RESPONSES.about;
  }

  return FALLBACK_RESPONSES.default;
}

/**
 * MCP tool definition from server
 */
interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * MCP tool call response
 */
interface McpToolResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: string;
}

/**
 * Call MCP server to list available tools
 *
 * Uses HTTP POST to the MCP endpoint with JSON-RPC style request.
 * Falls back gracefully on connection issues.
 */
async function listMcpTools(): Promise<McpToolDefinition[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.connect);

    const response = await fetch(DUYET_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {},
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('[DuyetMcpTool] Failed to list tools', {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const data = (await response.json()) as {
      result?: { tools?: McpToolDefinition[] };
      error?: { message: string };
    };

    if (data.error) {
      logger.warn('[DuyetMcpTool] MCP error listing tools', {
        error: data.error.message,
      });
      return [];
    }

    return data.result?.tools ?? [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[DuyetMcpTool] Exception listing tools', { error: errorMessage });
    return [];
  }
}

/**
 * Call a specific MCP tool
 *
 * @param toolName - Name of the MCP tool to call
 * @param args - Arguments to pass to the tool
 * @returns Tool response or error message
 */
async function callMcpTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; output: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.execution);

    logger.debug('[DuyetMcpTool] Calling MCP tool', { toolName, args });

    const response = await fetch(DUYET_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn('[DuyetMcpTool] MCP tool call failed', {
        toolName,
        status: response.status,
      });
      return {
        success: false,
        output: `MCP server returned error: ${response.status} ${response.statusText}`,
      };
    }

    const data = (await response.json()) as {
      result?: McpToolResponse;
      error?: { message: string };
    };

    if (data.error) {
      return {
        success: false,
        output: `MCP error: ${data.error.message}`,
      };
    }

    // Extract text content from response
    const textContent = data.result?.content
      ?.filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text)
      .join('\n');

    if (!textContent) {
      return {
        success: true,
        output: 'No results found.',
      };
    }

    return {
      success: true,
      output: textContent,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for abort (timeout)
    if (errorMessage.includes('abort') || errorMessage.includes('timeout')) {
      logger.warn('[DuyetMcpTool] MCP tool call timed out', { toolName });
      return {
        success: false,
        output: `Tool ${toolName} timed out after ${TIMEOUTS.execution}ms`,
      };
    }

    logger.error('[DuyetMcpTool] Exception calling MCP tool', {
      toolName,
      error: errorMessage,
    });
    return {
      success: false,
      output: `Failed to call tool ${toolName}: ${errorMessage}`,
    };
  }
}

/**
 * Duyet MCP Tool
 *
 * Provides access to Duyet's personal information via the MCP server.
 * Handles blog posts, CV, skills, experience, contact info, and more.
 *
 * The tool automatically infers the appropriate MCP tool to call based on
 * the query, but also accepts an explicit toolName parameter for precision.
 */
export const duyetMcpTool: LoopTool = {
  name: 'duyet_info',
  description:
    'Get information about Duyet including blog posts, CV, skills, experience, and contact info. Use for any queries about Duyet, his blog at blog.duyet.net, or personal/professional information.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'The information to look up (e.g., "latest blog posts", "skills", "cv", "contact info", "who is duyet")',
      },
      toolName: {
        type: 'string',
        description:
          'Optional: specific MCP tool to call if known (e.g., "get_latest_posts", "get_cv", "get_skills")',
      },
    },
    required: ['query'],
  },

  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();
    const query = args.query as string;
    const explicitToolName = args.toolName as string | undefined;

    const traceId = ctx.executionContext?.traceId ?? 'unknown';

    logger.debug('[DuyetMcpTool] Executing', {
      query,
      explicitToolName,
      traceId,
      iteration: ctx.iteration,
    });

    try {
      // Step 1: Determine which MCP tool to call
      let targetTool = explicitToolName;

      if (!targetTool) {
        // Try to list available tools and find the best match
        const availableTools = await listMcpTools();

        if (availableTools.length > 0) {
          // Filter to relevant tools
          const relevantTools = availableTools.filter((t) => duyetToolFilter(t.name));

          logger.debug('[DuyetMcpTool] Available tools', {
            total: availableTools.length,
            relevant: relevantTools.length,
            names: relevantTools.map((t) => t.name),
          });

          // Infer best tool from query
          const inferredTool = inferMcpToolFromQuery(query);

          // Check if inferred tool exists in available tools
          const matchingTool = relevantTools.find(
            (t) => t.name === inferredTool || t.name.includes(inferredTool.replace('get_', ''))
          );

          targetTool = matchingTool?.name ?? relevantTools[0]?.name;
        }

        // Fallback to inferred tool if no tools discovered
        if (!targetTool) {
          targetTool = inferMcpToolFromQuery(query);
        }
      }

      logger.debug('[DuyetMcpTool] Target tool selected', {
        targetTool,
        traceId,
      });

      // Step 2: Call the MCP tool
      const result = await callMcpTool(targetTool, { query });

      const durationMs = Date.now() - startTime;

      if (result.success) {
        logger.debug('[DuyetMcpTool] Success', {
          toolName: targetTool,
          durationMs,
          outputLength: result.output.length,
          traceId,
        });

        return {
          success: true,
          output: result.output,
          durationMs,
        };
      }

      // MCP call failed - return fallback
      logger.warn('[DuyetMcpTool] MCP call failed, using fallback', {
        toolName: targetTool,
        error: result.output,
        traceId,
      });

      return {
        success: true, // Mark as success so agent can continue
        output: getFallbackResponse(query),
        durationMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      logger.error('[DuyetMcpTool] Execution error', {
        error: errorMessage,
        query,
        traceId,
      });

      // Return graceful fallback instead of failing
      return {
        success: true, // Mark as success so agent can continue reasoning
        output: getFallbackResponse(query),
        durationMs,
      };
    }
  },
};

/**
 * Export the tool filter for testing
 */
export { getFallbackResponse };
