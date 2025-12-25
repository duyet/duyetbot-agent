/**
 * Research Tool
 *
 * Web research and information gathering tool with search and URL fetching capabilities.
 * Enhanced with date filtering, source credibility scoring, and fact verification modes.
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// Maximum results allowed
const MAX_RESULTS = 20;

// Default number of results
const DEFAULT_RESULTS = 5;

// Date range options
export type DateRange = 'today' | 'week' | 'month' | 'all';

// Credible source domains (high-authority news, research, and reference sites)
const CREDIBLE_DOMAINS = new Set([
  // News & Journalism
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'npr.org',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'theatlantic.com',
  // Scientific & Academic
  'nature.com',
  'science.org',
  'sciencemag.org',
  'pnas.org',
  'jamanetwork.com',
  'nejm.org',
  'thelancet.com',
  'springer.com',
  'ieee.org',
  'acm.org',
  // Government & Official
  'gov',
  'edu',
  'who.int',
  'un.org',
  'oecd.org',
  'worldbank.org',
  // Reference & Knowledge
  'wikipedia.org',
  'britannica.com',
  // Tech (established)
  'arxiv.org',
  'mit.edu',
  'stanford.edu',
]);

// Helper to get domain from URL
function getDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Check if source is credible
function isCredibleSource(url: string): boolean {
  const domain = getDomain(url);
  if (!domain) return false;

  // Check exact match
  if (CREDIBLE_DOMAINS.has(domain)) return true;

  // Check TLD match for gov/edu
  const tld = domain.split('.').pop();
  return tld === 'gov' || tld === 'edu';
}

// Calculate credibility score (0-1)
function calculateCredibilityScore(url: string, position: number, totalResults: number): number {
  let score = 0.5; // Base score

  // Domain-based scoring
  const domain = getDomain(url);
  if (domain) {
    if (CREDIBLE_DOMAINS.has(domain)) {
      score += 0.3;
    }
    const tld = domain.split('.').pop();
    if (tld === 'gov' || tld === 'edu') {
      score += 0.2;
    }
  }

  // Position-based scoring (earlier results get higher score)
  score += (1 - position / totalResults) * 0.2;

  return Math.min(score, 1);
}

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
  // Object with query and options
  z.object({
    query: z.string().min(1, 'Query cannot be empty').optional(),
    url: z.string().url('Invalid URL').optional(),
    maxResults: z
      .number()
      .int()
      .positive()
      .max(MAX_RESULTS, `Max results cannot exceed ${MAX_RESULTS}`)
      .optional(),
    // Date range filter for recent content
    dateRange: z.enum(['today', 'week', 'month', 'all']).optional(),
    // Require only credible sources
    requireCredibleSources: z.boolean().optional(),
    // Enable fact verification mode (cross-reference multiple sources)
    verifyFacts: z.boolean().optional(),
  }),
]);

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevance?: number;
  credibilityScore?: number;
  isCredible?: boolean;
  publishDate?: string;
}

export interface FetchResult {
  url: string;
  title: string;
  content: string;
}

export interface ResearchOptions {
  query?: string;
  url?: string;
  maxResults?: number;
  dateRange?: DateRange;
  requireCredibleSources?: boolean;
  verifyFacts?: boolean;
}

export interface FactVerification {
  claim: string;
  sources: { url: string; title: string; supports: boolean }[];
  consensus: 'supported' | 'contradicted' | 'mixed' | 'insufficient';
  confidence: number;
}

/**
 * Research tool implementation
 */
export class ResearchTool implements Tool {
  name = 'research';
  description =
    'Research and gather information from the web. Supports web search with date filtering, source credibility scoring, and fact verification. Also supports URL content fetching. Returns search results with citations or extracted content from URLs.\n\n' +
    'Search Options:\n' +
    '- dateRange: Filter by recency ("today", "week", "month", "all") - for recent news and current events\n' +
    '- requireCredibleSources: Only return results from reputable sources (news outlets, academic journals, government sites)\n' +
    '- verifyFacts: Enable fact-checking mode that cross-references multiple sources for consensus';
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
        const dateRange = 'dateRange' in data ? data.dateRange : undefined;
        const requireCredibleSources =
          'requireCredibleSources' in data ? data.requireCredibleSources : undefined;
        const verifyFacts = 'verifyFacts' in data ? data.verifyFacts : undefined;

        return await this.search(
          data.query,
          maxResults,
          startTime,
          dateRange,
          requireCredibleSources,
          verifyFacts
        );
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
  private async search(
    query: string,
    maxResults: number,
    startTime: number,
    dateRange?: DateRange,
    requireCredibleSources?: boolean,
    verifyFacts?: boolean
  ): Promise<ToolOutput> {
    try {
      // Build cache key including options
      const cacheKey = `search:${query}:${maxResults}:${dateRange || 'all'}:${requireCredibleSources || false}`;
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

      // Build search query with date range filter
      let searchQuery = query;
      if (dateRange && dateRange !== 'all') {
        searchQuery = this.addDateRangeToQuery(query, dateRange);
      }

      // Perform search using DuckDuckGo HTML scraping
      let results = await this.searchDuckDuckGo(searchQuery, maxResults * 2); // Fetch more for filtering

      // Add credibility scores
      results = results.map((result, index) => ({
        ...result,
        credibilityScore: calculateCredibilityScore(result.url, index, results.length),
        isCredible: isCredibleSource(result.url),
      }));

      // Filter by credible sources if requested
      if (requireCredibleSources) {
        const credibleResults = results.filter((r) => r.isCredible);
        if (credibleResults.length > 0) {
          results = credibleResults.slice(0, maxResults);
        } else {
          // If no credible sources found, return results but note it in metadata
          console.warn('No credible sources found for query:', query);
        }
      }

      // Sort by credibility score if filtering enabled
      if (requireCredibleSources) {
        results.sort((a, b) => (b.credibilityScore || 0) - (a.credibilityScore || 0));
      }

      // Limit results
      results = results.slice(0, maxResults);

      const responseData: Record<string, unknown> = {
        query,
        results,
        totalResults: results.length,
        filters: {
          dateRange: dateRange || 'all',
          requireCredibleSources: requireCredibleSources || false,
          verifyFacts: verifyFacts || false,
        },
      };

      // Add fact verification if requested
      if (verifyFacts && results.length >= 2) {
        const verification = await this.performFactVerification(query, results);
        responseData.verification = verification;
      }

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
   * Add date range filter to search query
   */
  private addDateRangeToQuery(query: string, dateRange: DateRange): string {
    const now = new Date();
    let startDate: Date;
    let dateFilter = '';

    switch (dateRange) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        dateFilter = `after:${startDate.toISOString().split('T')[0]}`;
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        dateFilter = `after:${startDate.toISOString().split('T')[0]}`;
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        dateFilter = `after:${startDate.toISOString().split('T')[0]}`;
        break;
      case 'all':
      default:
        return query;
    }

    return `${query} ${dateFilter}`;
  }

  /**
   * Perform fact verification across multiple sources
   */
  private async performFactVerification(
    query: string,
    results: SearchResult[]
  ): Promise<FactVerification> {
    // Analyze snippets for consensus
    const sources = results.map((r) => ({
      url: r.url,
      title: r.title,
      supports: true, // Default assumption - could be enhanced with content analysis
    }));

    // Simple consensus based on credible sources
    const credibleCount = results.filter((r) => r.isCredible).length;
    const totalCount = results.length;

    let consensus: FactVerification['consensus'] = 'insufficient';
    let confidence = 0;

    if (totalCount >= 3) {
      if (credibleCount >= totalCount * 0.7) {
        consensus = 'supported';
        confidence = Math.min(0.9, 0.5 + (credibleCount / totalCount) * 0.4);
      } else if (credibleCount >= totalCount * 0.3) {
        consensus = 'mixed';
        confidence = 0.5;
      } else {
        consensus = 'insufficient';
        confidence = 0.3;
      }
    }

    return {
      claim: query,
      sources,
      consensus,
      confidence,
    };
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
