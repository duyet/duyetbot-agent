/**
 * Research Tool
 *
 * Web research and information gathering tool with search and URL fetching capabilities
 */
import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
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
export declare class ResearchTool implements Tool {
  name: string;
  description: string;
  inputSchema: z.ZodUnion<
    [
      z.ZodEffects<
        z.ZodString,
        {
          query: string;
        },
        string
      >,
      z.ZodObject<
        {
          query: z.ZodOptional<z.ZodString>;
          url: z.ZodOptional<z.ZodString>;
          maxResults: z.ZodOptional<z.ZodNumber>;
        },
        'strip',
        z.ZodTypeAny,
        {
          query?: string | undefined;
          url?: string | undefined;
          maxResults?: number | undefined;
        },
        {
          query?: string | undefined;
          url?: string | undefined;
          maxResults?: number | undefined;
        }
      >,
    ]
  >;
  /**
   * Validate input
   */
  validate(input: ToolInput): boolean;
  /**
   * Execute research operation
   */
  execute(input: ToolInput): Promise<ToolOutput>;
  /**
   * Perform web search
   */
  private search;
  /**
   * Search using DuckDuckGo HTML scraping
   */
  private searchDuckDuckGo;
  /**
   * Fetch and extract content from URL
   */
  private fetchUrl;
  /**
   * Clean HTML entities and tags
   */
  private cleanHtml;
}
export declare const researchTool: ResearchTool;
//# sourceMappingURL=research.d.ts.map
