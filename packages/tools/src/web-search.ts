/**
 * WebSearch Tool - Web Search (Claude Code-style)
 *
 * Performs web searches and returns structured results.
 * Uses DuckDuckGo as the search provider.
 *
 * Features:
 * - Web search with structured results
 * - Domain filtering (allowed/blocked)
 * - Result caching
 * - Source attribution
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Input Schema
// =============================================================================

const webSearchInputSchema = z.object({
  /** The search query */
  query: z.string().min(2, 'Query must be at least 2 characters'),
  /** Only include results from these domains */
  allowed_domains: z.array(z.string()).optional(),
  /** Never include results from these domains */
  blocked_domains: z.array(z.string()).optional(),
  /** Maximum number of results to return (default: 10) */
  max_results: z.number().int().positive().max(20).optional(),
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

// =============================================================================
// Types
// =============================================================================

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

// =============================================================================
// Cache
// =============================================================================

interface CacheEntry {
  results: WebSearchResult[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get cache key for a search query
 */
function getCacheKey(query: string, allowedDomains?: string[], blockedDomains?: string[]): string {
  const parts = [query.toLowerCase().trim()];
  if (allowedDomains?.length) {
    parts.push(`+:${allowedDomains.sort().join(',')}`);
  }
  if (blockedDomains?.length) {
    parts.push(`-:${blockedDomains.sort().join(',')}`);
  }
  return parts.join('|');
}

/**
 * Get cached results if still valid
 */
function getCached(key: string): WebSearchResult[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.results;
  }
  cache.delete(key);
  return null;
}

/**
 * Store results in cache
 */
function setCache(key: string, results: WebSearchResult[]): void {
  cache.set(key, { results, timestamp: Date.now() });
}

// =============================================================================
// DuckDuckGo Search
// =============================================================================

/**
 * Search using DuckDuckGo HTML API
 * Note: This is a simplified implementation. For production, consider using
 * a proper search API like Brave Search, SerpAPI, or similar.
 */
async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResult[]> {
  // Use DuckDuckGo HTML search (no API key required)
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; DuyetBot/1.0; +https://github.com/duyet/duyetbot-agent)',
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const html = await response.text();
  const results: WebSearchResult[] = [];

  // Parse search results from HTML
  // Look for result divs with class "result"
  const resultPattern =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/gi;

  for (
    let match = resultPattern.exec(html);
    match !== null && results.length < maxResults;
    match = resultPattern.exec(html)
  ) {
    const [, urlEncoded, title, snippet] = match;
    if (!urlEncoded || !title) {
      continue;
    }

    // Decode the DuckDuckGo redirect URL
    let finalUrl = urlEncoded;
    try {
      const urlMatch = urlEncoded.match(/uddg=([^&]*)/);
      if (urlMatch?.[1]) {
        finalUrl = decodeURIComponent(urlMatch[1]);
      }
    } catch {
      // Keep the original URL if decoding fails
    }

    // Extract domain from URL
    let source = 'unknown';
    try {
      source = new URL(finalUrl).hostname.replace(/^www\./, '');
    } catch {
      // Keep unknown if URL parsing fails
    }

    results.push({
      title: title.trim(),
      url: finalUrl,
      snippet: snippet?.trim() || '',
      source,
    });
  }

  // Fallback: Try a simpler pattern if no results found
  if (results.length === 0) {
    const simplePattern =
      /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<span[^>]*>([^<]*)</gi;

    for (
      let simpleMatch = simplePattern.exec(html);
      simpleMatch !== null && results.length < maxResults;
      simpleMatch = simplePattern.exec(html)
    ) {
      const [, url, title, snippet] = simpleMatch;
      if (!url || !title || url.includes('duckduckgo.com')) {
        continue;
      }

      let source = 'unknown';
      try {
        source = new URL(url).hostname.replace(/^www\./, '');
      } catch {
        // Keep unknown
      }

      results.push({
        title: title.trim(),
        url,
        snippet: snippet?.trim() || '',
        source,
      });
    }
  }

  return results;
}

// =============================================================================
// Domain Filtering
// =============================================================================

/**
 * Filter results by domain
 */
function filterByDomain(
  results: WebSearchResult[],
  allowedDomains?: string[],
  blockedDomains?: string[]
): WebSearchResult[] {
  return results.filter((result) => {
    const domain = result.source.toLowerCase();

    // Check blocked domains
    if (blockedDomains?.length) {
      for (const blocked of blockedDomains) {
        if (domain.includes(blocked.toLowerCase())) {
          return false;
        }
      }
    }

    // Check allowed domains
    if (allowedDomains?.length) {
      for (const allowed of allowedDomains) {
        if (domain.includes(allowed.toLowerCase())) {
          return true;
        }
      }
      return false;
    }

    return true;
  });
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format search results for output
 */
function formatResults(results: WebSearchResult[]): string {
  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = ['## Search Results', ''];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) {
      continue;
    }

    lines.push(`### ${i + 1}. ${result.title}`);
    lines.push(`[${result.source}](${result.url})`);
    if (result.snippet) {
      lines.push('');
      lines.push(result.snippet);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Sources:**');
  for (const result of results) {
    lines.push(`- [${result.title}](${result.url})`);
  }

  return lines.join('\n');
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * WebSearch Tool - Search the web
 *
 * Performs web searches and returns structured results.
 * Always include sources in your response.
 */
export class WebSearchTool implements Tool {
  name = 'web_search';
  description =
    'Search the web and get structured results. ' +
    'IMPORTANT: After answering, include a "Sources:" section with relevant URLs as markdown links. ' +
    'Use allowed_domains to restrict to specific sites, blocked_domains to exclude sites.';
  inputSchema = webSearchInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as WebSearchInput;
      const { query, allowed_domains, blocked_domains, max_results = 10 } = parsed;

      // Check cache
      const cacheKey = getCacheKey(query, allowed_domains, blocked_domains);
      const cached = getCached(cacheKey);
      if (cached) {
        return {
          status: 'success',
          content: formatResults(cached),
          metadata: {
            query,
            resultCount: cached.length,
            fromCache: true,
          },
        };
      }

      // Perform search
      let results = await searchDuckDuckGo(query, max_results * 2); // Fetch extra for filtering

      // Apply domain filtering
      results = filterByDomain(results, allowed_domains, blocked_domains);

      // Limit results
      results = results.slice(0, max_results);

      // Cache results
      setCache(cacheKey, results);

      return {
        status: 'success',
        content: formatResults(results),
        metadata: {
          query,
          resultCount: results.length,
          allowedDomains: allowed_domains,
          blockedDomains: blocked_domains,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Search failed',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'SEARCH_FAILED',
        },
      };
    }
  }
}

export const webSearchTool = new WebSearchTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { WebSearchInput, WebSearchResult };
