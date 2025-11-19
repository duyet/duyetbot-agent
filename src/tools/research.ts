/**
 * Research Tool
 *
 * Web research and information gathering tool with search and URL fetching capabilities
 */

import { z } from 'zod';
import type { Tool, ToolInput, ToolOutput } from './types';

// Maximum results allowed
const MAX_RESULTS = 20;

// Default number of results
const DEFAULT_RESULTS = 5;

// Cache for search results (simple in-memory cache)
const searchCache = new Map<string, { timestamp: number; results: unknown }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Input schema for research tool
const researchInputSchema = z.union([
  // String query
  z
    .string()
    .min(1, 'Query cannot be empty')
    .transform((query) => ({ query })),
  // Object with query
  z.object({
    query: z.string().min(1, 'Query cannot be empty').optional(),
    url: z.string().url('Invalid URL').optional(),
    maxResults: z
      .number()
      .int()
      .positive()
      .max(MAX_RESULTS, `Max results cannot exceed ${MAX_RESULTS}`)
      .optional(),
  }),
]);

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance?: number;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
}

/**
 * Research tool implementation
 */
export class ResearchTool implements Tool {
  name = 'research';
  description =
    'Research and gather information from the web. Supports web search and URL content fetching. Returns search results with citations or extracted content from URLs.';
  inputSchema = researchInputSchema;

  /**
   * Validate input
   */
  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    const data = result.data;

    // Check maxResults is within limits
    if ('maxResults' in data && data.maxResults !== undefined) {
      if (data.maxResults < 1 || data.maxResults > MAX_RESULTS) {
        return false;
      }
    }

    // Must have either query or url
    if (!('query' in data && data.query) && !('url' in data && data.url)) {
      return false;
    }

    return true;
  }

  /**
   * Execute research operation
   */
  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      // Validate and parse input
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: parsed.error.errors[0]?.message || 'Invalid input',
            code: 'INVALID_INPUT',
          },
          metadata: {
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const data = parsed.data;

      // Handle URL fetching
      if ('url' in data && data.url) {
        return await this.fetchUrl(data.url, startTime);
      }

      // Handle search query
      if ('query' in data && data.query) {
        const maxResults =
          'maxResults' in data && data.maxResults ? data.maxResults : DEFAULT_RESULTS;
        return await this.search(data.query, maxResults, startTime);
      }

      return {
        status: 'error',
        content: 'Either query or url must be provided',
        error: {
          message: 'Either query or url must be provided',
          code: 'MISSING_PARAMETER',
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: error instanceof Error ? error.message : 'Unknown error occurred',
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'EXECUTION_ERROR',
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Perform web search
   */
  private async search(query: string, maxResults: number, startTime: number): Promise<ToolOutput> {
    try {
      // Check cache
      const cacheKey = `search:${query}:${maxResults}`;
      const cached = searchCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          status: 'success',
          content: cached.results as Record<string, unknown>,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            cached: true,
          },
        };
      }

      // Perform search using DuckDuckGo HTML scraping (no API key required)
      const results = await this.searchDuckDuckGo(query, maxResults);

      const responseData = {
        query,
        results,
        totalResults: results.length,
      };

      // Cache results
      searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: responseData,
      });

      return {
        status: 'success',
        content: responseData,
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          cached: false,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: error instanceof Error ? error.message : 'Search failed',
        error: {
          message: error instanceof Error ? error.message : 'Search failed',
          code: 'SEARCH_ERROR',
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Search using DuckDuckGo HTML scraping
   */
  private async searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        return [];
      }

      const html = await response.text();

      // Parse HTML to extract results
      const results: SearchResult[] = [];

      // Simple regex-based extraction (more robust than full HTML parsing for this use case)
      const resultRegex =
        /<div class="result__body">[\s\S]*?<a.*?href="([^"]*)"[\s\S]*?<\/a>[\s\S]*?<\/div>/g;
      const titleRegex = /<a.*?class="result__a"[^>]*>(.*?)<\/a>/;
      const snippetRegex = /<a class="result__snippet"[^>]*>(.*?)<\/a>/;

      let match: RegExpExecArray | null = resultRegex.exec(html);
      let count = 0;
      while (match !== null && count < maxResults) {
        const block = match[0];
        const urlMatch = block.match(/href="([^"]*)"/);
        const titleMatch = block.match(titleRegex);
        const snippetMatch = block.match(snippetRegex);

        if (urlMatch?.[1] && titleMatch?.[1]) {
          const resultUrl = urlMatch[1];
          // Skip DuckDuckGo tracking URLs
          if (!resultUrl.includes('duckduckgo.com')) {
            results.push({
              title: this.cleanHtml(titleMatch[1]),
              url: resultUrl,
              snippet: snippetMatch?.[1] ? this.cleanHtml(snippetMatch[1]) : '',
              relevance: 1 - count / maxResults, // Simple relevance score based on position
            });
            count++;
          }
        }
        match = resultRegex.exec(html);
      }

      return results;
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  /**
   * Fetch and extract content from URL
   */
  private async fetchUrl(url: string, startTime: number): Promise<ToolOutput> {
    try {
      // Validate URL
      try {
        new URL(url);
      } catch {
        return {
          status: 'error',
          content: 'Invalid URL format',
          error: {
            message: 'Invalid URL format',
            code: 'INVALID_URL',
          },
          metadata: {
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Fetch URL
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          status: 'error',
          content: `Failed to fetch URL: ${response.status} ${response.statusText}`,
          error: {
            message: `Failed to fetch URL: ${response.status} ${response.statusText}`,
            code: 'FETCH_ERROR',
          },
          metadata: {
            duration: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? this.cleanHtml(titleMatch[1] || '') : 'Untitled';

      // Extract content (remove scripts, styles, and extract text)
      let content = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Limit content length
      const MAX_CONTENT_LENGTH = 10000;
      if (content.length > MAX_CONTENT_LENGTH) {
        content = `${content.substring(0, MAX_CONTENT_LENGTH)}... [truncated]`;
      }

      return {
        status: 'success',
        content: {
          url,
          title,
          content,
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: error instanceof Error ? error.message : 'Failed to fetch URL',
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch URL',
          code: 'FETCH_ERROR',
        },
        metadata: {
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Clean HTML entities and tags
   */
  private cleanHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export tool instance
export const researchTool = new ResearchTool();
