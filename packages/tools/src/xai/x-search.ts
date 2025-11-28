/**
 * xAI X (Twitter) Search Tool
 *
 * Search X/Twitter posts using xAI's Grok model.
 * Uses server-side tool execution via the Responses API.
 *
 * @see https://docs.x.ai/docs/guides/tools/search-tools
 */

import type { Tool, ToolContext, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
import {
  XAIError,
  type XAISearchResult,
  XAI_ERROR_CODES,
  type XSearchFilters,
  XSearchFiltersSchema,
  createXAIClient,
} from './client.js';

// ============================================
// Input Schema
// ============================================

const xaiXSearchInputSchema = z.union([
  // Simple string query
  z
    .string()
    .min(1, 'Query cannot be empty')
    .transform((query) => ({ query })),
  // Object with query and optional filters
  z.object({
    query: z.string().min(1, 'Query cannot be empty'),
    allowed_x_handles: z.array(z.string()).max(10, 'Maximum 10 allowed handles').optional(),
    excluded_x_handles: z.array(z.string()).max(10, 'Maximum 10 excluded handles').optional(),
    from_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    to_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    enable_image_understanding: z.boolean().optional(),
    enable_video_understanding: z.boolean().optional(),
  }),
]);

type XAIXSearchInput = z.infer<typeof xaiXSearchInputSchema>;

// ============================================
// Tool Implementation
// ============================================

/**
 * xAI X (Twitter) Search Tool
 *
 * Performs real-time X/Twitter search using xAI's Grok model.
 * Returns synthesized results with citations from X posts.
 */
export class XAIXSearchTool implements Tool {
  name = 'xai_x_search';
  description = `Search X (Twitter) posts using xAI's Grok model. Performs keyword search, semantic search, and user search on X.

Features:
- Real-time X/Twitter post search
- AI-synthesized summary of findings
- Citations with post URLs
- Filter by X handles (max 10 allowed or excluded)
- Filter by date range (YYYY-MM-DD format)
- Optional image and video understanding

Use for: social media trends, public opinions, real-time discussions, monitoring X accounts.`;

  inputSchema = xaiXSearchInputSchema;

  /**
   * Validate input before execution
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    // Additional validation: can't have both allowed and excluded handles
    const data = result.data;
    if ('allowed_x_handles' in data && 'excluded_x_handles' in data) {
      if (data.allowed_x_handles?.length && data.excluded_x_handles?.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute X search
   */
  async execute(input: ToolInput, context?: ToolContext): Promise<ToolOutput> {
    const startTime = Date.now();

    // Check for API key
    const apiKey = context?.env?.XAI_API_KEY;
    if (!apiKey) {
      return {
        status: 'error',
        content: 'XAI_API_KEY not configured',
        error: {
          message: 'XAI_API_KEY environment variable is required for xAI X search',
          code: XAI_ERROR_CODES.MISSING_API_KEY,
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Validate and parse input
    const parsed = this.inputSchema.safeParse(input.content);
    if (!parsed.success) {
      return {
        status: 'error',
        content: 'Invalid input',
        error: {
          message: parsed.error.errors[0]?.message || 'Invalid input',
          code: XAI_ERROR_CODES.INVALID_INPUT,
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const data = parsed.data as XAIXSearchInput;
    const { query, ...filterData } = data;

    // Validate filters
    const filtersResult = XSearchFiltersSchema.safeParse(filterData);
    if (!filtersResult.success) {
      return {
        status: 'error',
        content: 'Invalid filters',
        error: {
          message: filtersResult.error.errors[0]?.message || 'Invalid filters',
          code: XAI_ERROR_CODES.INVALID_INPUT,
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const filters: XSearchFilters = filtersResult.data;

    try {
      const client = createXAIClient({ apiKey });
      const result = await client.xSearch(query, filters);
      return this.formatResult(result, startTime);
    } catch (error) {
      return this.handleError(error, startTime);
    }
  }

  /**
   * Format successful result
   */
  private formatResult(result: XAISearchResult, startTime: number): ToolOutput {
    const citationsMarkdown =
      result.citations.length > 0
        ? `\n\n**X Posts:**\n${result.citations.map((c, i) => `${i + 1}. [${c.title || 'Post'}](${c.url})`).join('\n')}`
        : '';

    return {
      status: 'success',
      content: {
        summary: result.content,
        citations: result.citations,
        query: result.query,
        formatted: result.content + citationsMarkdown,
      },
      metadata: {
        duration: Date.now() - startTime,
        citationCount: result.citations.length,
        xaiDurationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown, startTime: number): ToolOutput {
    if (error instanceof XAIError) {
      return {
        status: 'error',
        content: error.message,
        error: {
          message: error.message,
          code: error.code,
          ...(error.statusCode && {
            metadata: { statusCode: error.statusCode },
          }),
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      status: 'error',
      content: message,
      error: {
        message,
        code: XAI_ERROR_CODES.XAI_API_ERROR,
      },
      metadata: {
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// Export singleton instance
export const xaiXSearchTool = new XAIXSearchTool();
