/**
 * Research Tool for Agentic Loop
 *
 * Performs web research using search APIs to find current information,
 * news, documentation, and research topics. Replaces LeadResearcherAgent functionality.
 *
 * Features:
 * - Web search with configurable result count
 * - Multiple search sources (web, news, documentation)
 * - Formatted result aggregation
 * - Stub implementation with integration points for search providers
 *
 * @example
 * ```typescript
 * const result = await researchTool.execute(
 *   {
 *     query: 'latest React hooks best practices',
 *     maxResults: 5,
 *     source: 'docs'
 *   },
 *   ctx
 * );
 *
 * // Returns formatted search results for LLM consumption
 * ```
 */

import type { LoopTool, ToolResult } from '../types.js';

/**
 * Research tool definition for web search and information retrieval
 *
 * Currently returns stub responses. Integration points for actual search providers:
 * - Tavily API: tavily.com/api
 * - Serper API: serper.dev/api
 * - Perplexity: perplexity.ai/api
 * - Custom implementation using edge runtime APIs
 */
export const researchTool: LoopTool = {
  name: 'research',
  description:
    'Search the web for current information. Use for queries requiring up-to-date information, news, documentation, or research topics.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to research',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5, max: 20)',
      },
      source: {
        type: 'string',
        enum: ['web', 'news', 'docs'],
        description:
          'Type of search to perform (web: general search, news: current events, docs: documentation)',
      },
    },
    required: ['query'],
  },
  execute: async (args, ctx): Promise<ToolResult> => {
    const startTime = Date.now();

    try {
      // Extract and validate parameters
      const query = String(args.query || '').trim();
      const maxResults = Math.min(Number(args.maxResults) || 5, 20);
      const source = (args.source as string) || 'web';

      // Validate query
      if (!query) {
        return {
          success: false,
          output: 'Error: Search query cannot be empty',
          error: 'Empty query provided',
          durationMs: Date.now() - startTime,
        };
      }

      // Validate source parameter
      if (!['web', 'news', 'docs'].includes(source)) {
        return {
          success: false,
          output: `Error: Invalid source "${source}". Must be one of: web, news, docs`,
          error: 'Invalid source parameter',
          durationMs: Date.now() - startTime,
        };
      }

      // Log search parameters for debugging
      const logContext = {
        query,
        maxResults,
        source,
        iteration: ctx.iteration,
        timestamp: new Date().toISOString(),
      };

      // TODO: Integrate actual search provider
      // Implementation options:
      // 1. Tavily API: https://tavily.com/api
      //    - Best for research/news: POST /search with query
      //    - Returns: url, title, snippet, published_date
      // 2. Serper API: https://www.serper.dev/api
      //    - Generic search: POST /search with q
      //    - News: POST /news with q
      //    - Returns: title, snippet, link, date (news)
      // 3. Perplexity AI: https://www.perplexity.ai/api
      //    - Built-in research capability
      // 4. Custom implementation using Cloudflare Workers KV + scheduled jobs
      //    - Maintain local search index for common topics
      //    - Update via scheduled worker

      // Stub response format
      const stubResults = generateStubResults(query, source, maxResults);

      return {
        success: true,
        output: stubResults,
        data: {
          query,
          source,
          resultCount: 0, // Update when actual search is implemented
          searchContext: logContext,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during research';

      return {
        success: false,
        output: `Error during research: ${errorMessage}`,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  },
};

/**
 * Generate stub search results in LLM-consumable format
 *
 * Provides formatted placeholder results that mimic real search API responses.
 * This allows testing the agentic loop while actual search integration is in progress.
 *
 * @param query - Search query
 * @param source - Type of search (web, news, docs)
 * @param maxResults - Number of results to generate
 * @returns Formatted stub results string
 *
 * @internal
 */
function generateStubResults(query: string, source: string, maxResults: number): string {
  // Build source-specific message
  let sourceLabel = 'web';
  let sourceDescription = '';

  switch (source) {
    case 'news':
      sourceLabel = 'news';
      sourceDescription = ' (current events and news)';
      break;
    case 'docs':
      sourceLabel = 'documentation';
      sourceDescription = ' (technical documentation)';
      break;
    case 'web':
      sourceLabel = 'web';
      sourceDescription = ' (general web search)';
      break;
  }

  // Format stub response
  const response = [
    `Search Results${sourceDescription}`,
    `Query: "${query}"`,
    `Source: ${sourceLabel}`,
    `Max Results Requested: ${maxResults}`,
    '',
    'STUB RESPONSE - Search API Integration In Progress',
    '='.repeat(50),
    '',
    'This is a placeholder response while search provider integration is being configured.',
    '',
    'Ready to integrate with:',
    '- Tavily API (research/news focused)',
    '- Serper API (fast, reliable search)',
    '- Perplexity AI (built-in research)',
    '- Custom Cloudflare Workers implementation',
    '',
    'To implement actual search:',
    '1. Choose a search provider',
    '2. Set API key in environment variables',
    '3. Implement fetch/POST logic in this tool',
    '4. Parse and format provider response',
    '5. Return results in searchResult[] format',
    '',
    'Expected result format per query:',
    '- title: Result heading',
    '- url: Source link',
    '- snippet: Brief excerpt (100-200 chars)',
    '- date: Publication date (for news)',
    '- relevance: Relevance score 0-1',
  ];

  return response.join('\n');
}

/**
 * Search result type for reference
 *
 * When implementing actual search, results should follow this structure:
 * This type documents the expected format of search results from providers.
 */
export interface SearchResult {
  /** Result heading or title */
  title: string;
  /** Link to source */
  url: string;
  /** Preview text (100-300 chars) */
  snippet: string;
  /** Publication date (ISO 8601 or friendly format) */
  date?: string;
  /** Relevance score 0-1 (higher = more relevant) */
  relevance?: number;
  /** Source identifier (e.g., 'github', 'npm', 'mdn') */
  source?: string;
}
