/**
 * xAI Responses API Client
 *
 * Client for xAI's agentic search tools (web_search and x_search).
 * Uses the Responses API endpoint with server-side tool execution.
 *
 * @see https://docs.x.ai/docs/guides/tools/search-tools
 */

import { z } from 'zod';

// API Configuration
export const XAI_API_URL = 'https://api.x.ai/v1/responses';
export const XAI_DEFAULT_MODEL = 'grok-4-fast';
export const XAI_DEFAULT_TIMEOUT = 30000;

// ============================================
// Zod Schemas for Filter Validation
// ============================================

/**
 * Web search filter schema
 * - allowed_domains/excluded_domains: max 5 domains
 * - enable_image_understanding: analyze images in search results
 */
export const WebSearchFiltersSchema = z
  .object({
    allowed_domains: z.array(z.string()).max(5, 'Maximum 5 allowed domains').optional(),
    excluded_domains: z.array(z.string()).max(5, 'Maximum 5 excluded domains').optional(),
    enable_image_understanding: z.boolean().optional(),
  })
  .refine(
    (data) => !(data.allowed_domains?.length && data.excluded_domains?.length),
    'Cannot specify both allowed_domains and excluded_domains'
  );

/**
 * X (Twitter) search filter schema
 * - allowed_x_handles/excluded_x_handles: max 10 handles
 * - from_date/to_date: ISO8601 date format (YYYY-MM-DD)
 * - enable_image_understanding/enable_video_understanding: analyze media
 */
export const XSearchFiltersSchema = z
  .object({
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
  })
  .refine(
    (data) => !(data.allowed_x_handles?.length && data.excluded_x_handles?.length),
    'Cannot specify both allowed_x_handles and excluded_x_handles'
  );

export type WebSearchFilters = z.infer<typeof WebSearchFiltersSchema>;
export type XSearchFilters = z.infer<typeof XSearchFiltersSchema>;

// ============================================
// Response Types
// ============================================

/**
 * Citation from xAI search results
 */
export interface XAICitation {
  url: string;
  title?: string;
  snippet?: string;
}

/**
 * Parsed search result
 */
export interface XAISearchResult {
  content: string;
  citations: XAICitation[];
  query: string;
  durationMs: number;
}

/**
 * xAI API response structure
 */
interface XAIResponsesAPIResponse {
  id: string;
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  citations?: XAICitation[];
  error?: {
    message: string;
    type: string;
    code?: string;
  };
}

// ============================================
// Client Configuration
// ============================================

export interface XAIClientConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

// ============================================
// Error Codes
// ============================================

export const XAI_ERROR_CODES = {
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_INPUT: 'INVALID_INPUT',
  XAI_API_ERROR: 'XAI_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type XAIErrorCode = (typeof XAI_ERROR_CODES)[keyof typeof XAI_ERROR_CODES];

/**
 * Custom error class for xAI API errors
 */
export class XAIError extends Error {
  constructor(
    message: string,
    public code: XAIErrorCode,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'XAIError';
  }
}

// ============================================
// Client Factory
// ============================================

/**
 * Create an xAI Responses API client
 *
 * @example
 * ```typescript
 * const client = createXAIClient({ apiKey: process.env.XAI_API_KEY });
 * const result = await client.webSearch('latest news about AI');
 * console.log(result.content, result.citations);
 * ```
 */
export function createXAIClient(config: XAIClientConfig) {
  const { apiKey, model = XAI_DEFAULT_MODEL, timeout = XAI_DEFAULT_TIMEOUT } = config;

  if (!apiKey) {
    throw new XAIError('XAI_API_KEY is required', XAI_ERROR_CODES.MISSING_API_KEY);
  }

  /**
   * Make a request to the xAI Responses API
   */
  async function makeRequest(
    query: string,
    toolType: 'web_search' | 'x_search',
    filters: Record<string, unknown> = {}
  ): Promise<XAIResponsesAPIResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const tool: Record<string, unknown> = { type: toolType };

      // Add filters to the tool configuration
      if (toolType === 'web_search') {
        if (filters.allowed_domains) {
          tool.filters = { allowed_domains: filters.allowed_domains };
        }
        if (filters.excluded_domains) {
          tool.filters = { excluded_domains: filters.excluded_domains };
        }
        if (filters.enable_image_understanding) {
          tool.enable_image_understanding = true;
        }
      } else if (toolType === 'x_search') {
        if (filters.allowed_x_handles) {
          tool.allowed_x_handles = filters.allowed_x_handles;
        }
        if (filters.excluded_x_handles) {
          tool.excluded_x_handles = filters.excluded_x_handles;
        }
        if (filters.from_date) {
          tool.from_date = filters.from_date;
        }
        if (filters.to_date) {
          tool.to_date = filters.to_date;
        }
        if (filters.enable_image_understanding) {
          tool.enable_image_understanding = true;
        }
        if (filters.enable_video_understanding) {
          tool.enable_video_understanding = true;
        }
      }

      const response = await fetch(XAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [{ role: 'user', content: query }],
          tools: [tool],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429) {
        throw new XAIError('xAI API rate limit exceeded', XAI_ERROR_CODES.RATE_LIMITED, 429);
      }

      // Handle other errors
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `xAI API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new XAIError(errorMessage, XAI_ERROR_CODES.XAI_API_ERROR, response.status);
      }

      return (await response.json()) as XAIResponsesAPIResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof XAIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new XAIError(`Request timed out after ${timeout}ms`, XAI_ERROR_CODES.TIMEOUT);
        }
        throw new XAIError(error.message, XAI_ERROR_CODES.NETWORK_ERROR);
      }

      throw new XAIError('Unknown error occurred', XAI_ERROR_CODES.NETWORK_ERROR);
    }
  }

  /**
   * Parse xAI API response to extract content and citations
   */
  function parseResponse(
    data: XAIResponsesAPIResponse,
    query: string,
    startTime: number
  ): XAISearchResult {
    // Extract text content from output
    const textContent =
      data.output
        ?.filter((item) => item.type === 'message')
        .flatMap((item) => item.content?.filter((c) => c.type === 'text').map((c) => c.text) || [])
        .filter(Boolean)
        .join('\n') || '';

    return {
      content: textContent,
      citations: data.citations || [],
      query,
      durationMs: Date.now() - startTime,
    };
  }

  return {
    /**
     * Perform a web search using xAI
     *
     * @param query - Search query
     * @param filters - Optional filters (allowed_domains, excluded_domains, enable_image_understanding)
     * @returns Search result with content and citations
     */
    async webSearch(query: string, filters?: WebSearchFilters): Promise<XAISearchResult> {
      const startTime = Date.now();
      const data = await makeRequest(query, 'web_search', filters || {});
      return parseResponse(data, query, startTime);
    },

    /**
     * Perform an X (Twitter) search using xAI
     *
     * @param query - Search query
     * @param filters - Optional filters (handles, date range, media understanding)
     * @returns Search result with content and citations
     */
    async xSearch(query: string, filters?: XSearchFilters): Promise<XAISearchResult> {
      const startTime = Date.now();
      const data = await makeRequest(query, 'x_search', filters || {});
      return parseResponse(data, query, startTime);
    },
  };
}
