/**
 * WebFetch Tool - URL Content Retrieval (Claude Code-style)
 *
 * Fetches content from URLs and processes it for agent consumption.
 * Converts HTML to readable text/markdown format.
 *
 * Features:
 * - Fetch and process web pages
 * - Convert HTML to markdown for easy reading
 * - Handle redirects
 * - Cache responses (15-minute TTL)
 * - Configurable timeout
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Input Schema
// =============================================================================

const webFetchInputSchema = z.object({
  /** URL to fetch content from (must be valid HTTPS URL) */
  url: z.string().url('Must be a valid URL'),
  /** Prompt describing what information to extract from the page */
  prompt: z.string().optional(),
  /** Timeout in milliseconds (default: 30000) */
  timeout: z.number().int().positive().optional(),
  /** Whether to include raw HTML (default: false, returns cleaned text) */
  raw: z.boolean().optional(),
});

type WebFetchInput = z.infer<typeof webFetchInputSchema>;

// =============================================================================
// Cache
// =============================================================================

interface CacheEntry {
  content: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get cached content if still valid
 */
function getCached(url: string): string | null {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.content;
  }
  cache.delete(url);
  return null;
}

/**
 * Store content in cache
 */
function setCache(url: string, content: string): void {
  cache.set(url, { content, timestamp: Date.now() });
}

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [url, entry] of cache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      cache.delete(url);
    }
  }
}

// =============================================================================
// HTML Processing
// =============================================================================

/**
 * Simple HTML to text converter
 * Removes scripts, styles, and converts common elements to readable text
 */
function htmlToText(html: string): string {
  // Remove scripts and styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');

  // Convert headings to markdown
  text = text
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // Convert links to markdown
  text = text.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // Convert bold and italic
  text = text
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // Convert lists
  text = text
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');

  // Convert paragraphs and line breaks
  text = text
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  // Convert code blocks
  text = text
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  // Clean up whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '')
    .trim();

  return text;
}

/**
 * Extract title from HTML
 */
function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1]?.trim() : undefined;
}

/**
 * Extract meta description from HTML
 */
function extractDescription(html: string): string | undefined {
  const match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  return match ? match[1]?.trim() : undefined;
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * WebFetch Tool - Fetch and process URL content
 *
 * Fetches content from a URL, converts HTML to readable text/markdown,
 * and returns the processed content.
 */
export class WebFetchTool implements Tool {
  name = 'web_fetch';
  description =
    'Fetch content from a URL and process it. Converts HTML to readable markdown. ' +
    'Use this when you need to retrieve and analyze web content. ' +
    'Includes a 15-minute cache for repeated requests.';
  inputSchema = webFetchInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as WebFetchInput;
      const { url, prompt, timeout = 30000, raw = false } = parsed;

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        // Upgrade HTTP to HTTPS
        if (parsedUrl.protocol === 'http:') {
          parsedUrl.protocol = 'https:';
        }
      } catch {
        return {
          status: 'error',
          content: 'Invalid URL',
          error: {
            message: 'The provided URL is not valid',
            code: 'INVALID_URL',
          },
        };
      }

      const normalizedUrl = parsedUrl.toString();

      // Check cache
      const cached = getCached(normalizedUrl);
      if (cached && !raw) {
        return {
          status: 'success',
          content: cached,
          metadata: {
            url: normalizedUrl,
            fromCache: true,
            prompt,
          },
        };
      }

      // Fetch content with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(normalizedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; DuyetBot/1.0; +https://github.com/duyet/duyetbot-agent)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
        });

        clearTimeout(timeoutId);

        // Check for redirect to different host
        const finalUrl = response.url;
        if (new URL(finalUrl).host !== parsedUrl.host) {
          return {
            status: 'success',
            content: `Redirected to different host. Please make a new request with: ${finalUrl}`,
            metadata: {
              originalUrl: normalizedUrl,
              redirectUrl: finalUrl,
              redirected: true,
            },
          };
        }

        if (!response.ok) {
          return {
            status: 'error',
            content: `HTTP error ${response.status}`,
            error: {
              message: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
              code: 'HTTP_ERROR',
            },
          };
        }

        const html = await response.text();

        if (raw) {
          return {
            status: 'success',
            content: html,
            metadata: {
              url: normalizedUrl,
              contentType: response.headers.get('content-type'),
              contentLength: html.length,
            },
          };
        }

        // Process HTML
        const title = extractTitle(html);
        const description = extractDescription(html);
        const text = htmlToText(html);

        // Build formatted content
        const lines: string[] = [];
        if (title) {
          lines.push(`# ${title}`);
          lines.push('');
        }
        if (description) {
          lines.push(`> ${description}`);
          lines.push('');
        }
        lines.push(text);

        const content = lines.join('\n');

        // Cache the result
        setCache(normalizedUrl, content);

        // Cleanup old cache entries
        cleanupCache();

        return {
          status: 'success',
          content,
          metadata: {
            url: normalizedUrl,
            title,
            description,
            contentLength: content.length,
            prompt,
          },
        };
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          return {
            status: 'error',
            content: 'Request timed out',
            error: {
              message: `Request timed out after ${timeout}ms`,
              code: 'TIMEOUT',
            },
          };
        }

        throw error;
      }
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to fetch URL',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'FETCH_FAILED',
        },
      };
    }
  }
}

export const webFetchTool = new WebFetchTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { WebFetchInput };
