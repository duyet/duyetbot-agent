/**
 * xAI Web Search Tool
 *
 * Real-time web search using xAI's Grok model.
 * Uses server-side tool execution via the Responses API.
 *
 * @see https://docs.x.ai/docs/guides/tools/search-tools
 */

import type { Tool, ToolContext, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
import {
  type WebSearchFilters,
  WebSearchFiltersSchema,
  XAIError,
  type XAISearchResult,
  XAI_ERROR_CODES,
  createXAIClient,
} from './client.js';

// ============================================
// Input Schema
// ============================================

const xaiWebSearchInputSchema = z.union([
  // Simple string query
  z
    .string()
    .min(1, 'Query cannot be empty')
    .transform((query) => ({ query })),
  // Object with query and optional filters
  z.object({
    query: z.string().min(1, 'Query cannot be empty'),
    allowed_domains: z.array(z.string()).max(5, 'Maximum 5 allowed domains').optional(),
    excluded_domains: z.array(z.string()).max(5, 'Maximum 5 excluded domains').optional(),
    enable_image_understanding: z.boolean().optional(),
  }),
]);

type XAIWebSearchInput = z.infer<typeof xaiWebSearchInputSchema>;

// ============================================
// Tool Implementation
// ============================================

/**
 * xAI Web Search Tool
 *
 * Performs real-time web search using xAI's Grok model.
 * Returns synthesized results with citations from source URLs.
 */
export class XAIWebSearchTool implements Tool {
  name = 'xai_web_search';
  description = `Real-time web search using xAI's Grok model. Searches the live web and returns synthesized results with source citations.

Features:
- Real-time search results from the web
- AI-synthesized summary of findings
- Source citations with URLs
- Optional domain filtering (max 5 allowed or excluded domains)
- Optional image understanding for visual content

Use for: current events, latest news, real-time information, fact-checking, research.`;

  inputSchema = xaiWebSearchInputSchema;

  /**
   * Validate input before execution
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    // Additional validation: can't have both allowed and excluded domains
    const data = result.data;
    if ('allowed_domains' in data && 'excluded_domains' in data) {
      if (data.allowed_domains?.length && data.excluded_domains?.length) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute web search
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
          message: 'XAI_API_KEY environment variable is required for xAI web search',
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

    const data = parsed.data as XAIWebSearchInput;
    const { query, ...filterData } = data;

    // Validate filters
    const filtersResult = WebSearchFiltersSchema.safeParse(filterData);
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

    const filters: WebSearchFilters = filtersResult.data;

    try {
      const client = createXAIClient({ apiKey });
      const result = await client.webSearch(query, filters);
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
        ? `\n\n**Sources:**\n${result.citations.map((c, i) => `${i + 1}. [${c.title || c.url}](${c.url})`).join('\n')}`
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
export const xaiWebSearchTool = new XAIWebSearchTool();
