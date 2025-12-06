/**
 * Proactive Researcher
 *
 * Background research worker that scans configured sources for content
 * relevant to @duyet's interests. Runs during quiet hours when the bot
 * has excess energy budget.
 *
 * Sources:
 * - HackerNews top/best stories
 * - ArXiv ML/Data papers (future)
 * - Configured blogs/feeds (future)
 *
 * The researcher schedules itself via SchedulerDO and uses the taste filter
 * to determine what content is worth reporting.
 */
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
/**
 * Research source configuration
 */
export interface ResearchSource {
  /** Unique source identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Source type */
  type: 'hackernews' | 'arxiv' | 'rss' | 'api';
  /** Source URL or identifier */
  url: string;
  /** How often to check (ms) */
  checkIntervalMs: number;
  /** Is this source enabled? */
  enabled: boolean;
}
/**
 * Research finding from a source
 */
export interface ResearchFinding {
  /** Unique identifier */
  id: string;
  /** Source that found this */
  sourceId: string;
  /** Title of the item */
  title: string;
  /** URL to the item */
  url: string;
  /** Brief summary/description */
  summary?: string;
  /** Relevance score 0-100 */
  relevanceScore: number;
  /** Why this is relevant */
  relevanceReason?: string;
  /** When this was found */
  foundAt: number;
  /** Metadata from source */
  metadata?: Record<string, unknown>;
}
/**
 * Taste filter configuration
 *
 * Defines what topics @duyet is interested in.
 * In the future, this could be learned from interaction patterns.
 */
export interface TasteFilter {
  /** Topics of high interest */
  interests: string[];
  /** Keywords that boost relevance */
  boostKeywords: string[];
  /** Keywords that reduce relevance */
  penaltyKeywords: string[];
  /** Minimum relevance score to report */
  minRelevanceScore: number;
}
/**
 * Default taste filter for @duyet (Data Engineer)
 */
export declare const DEFAULT_TASTE_FILTER: TasteFilter;
/**
 * Default research sources
 */
export declare const DEFAULT_RESEARCH_SOURCES: ResearchSource[];
/**
 * HackerNews item structure
 */
interface HNItem {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
  type: string;
}
/**
 * Calculate relevance score for an item based on taste filter
 *
 * @param title - Item title
 * @param tasteFilter - Taste filter configuration
 * @returns Relevance score 0-100
 */
export declare function calculateRelevance(
  title: string,
  tasteFilter?: TasteFilter
): {
  score: number;
  reason: string;
};
/**
 * Fetch HackerNews stories
 *
 * @param url - HN API URL for story list
 * @param limit - Max stories to fetch
 * @returns Array of HN items
 */
export declare function fetchHackerNewsStories(url: string, limit?: number): Promise<HNItem[]>;
/**
 * Process HackerNews stories and filter by relevance
 *
 * @param stories - HN items to process
 * @param tasteFilter - Taste filter configuration
 * @param seenIds - Set of already seen story IDs
 * @returns Filtered findings
 */
export declare function processHackerNewsStories(
  stories: HNItem[],
  tasteFilter?: TasteFilter,
  seenIds?: Set<number>
): ResearchFinding[];
/**
 * Research task payload
 */
export interface ResearchTaskPayload {
  /** Which sources to check */
  sources: string[];
  /** Taste filter override */
  tasteFilter?: TasteFilter;
  /** Target chat ID for notifications */
  notifyChatId?: string;
  /** Whether to send digest or individual notifications */
  digestMode?: boolean;
}
/**
 * Research result
 */
export interface ResearchResult {
  /** Total findings across all sources */
  totalFindings: number;
  /** Findings per source */
  bySource: Record<string, ResearchFinding[]>;
  /** Timestamp of research */
  completedAt: number;
  /** Whether notifications were sent */
  notificationsSent: boolean;
}
/**
 * Execute proactive research task
 *
 * This is the main entry point called by SchedulerDO when a research task
 * is ready to execute.
 *
 * @param payload - Research task configuration
 * @returns Research results
 */
export declare function executeResearchTask(payload: ResearchTaskPayload): Promise<ResearchResult>;
/**
 * Schedule a research task via SchedulerDO
 *
 * @param scheduler - SchedulerObject namespace
 * @param sources - Sources to check (default: all enabled)
 * @param priority - Task priority (default: 50)
 * @param scheduledFor - When to run (default: now)
 * @returns Task ID
 */
export declare function scheduleResearchTask(
  scheduler: DurableObjectNamespace,
  sources?: string[],
  priority?: number,
  scheduledFor?: number
): Promise<string>;
/**
 * Format research findings for Telegram notification
 *
 * @param findings - Research findings to format
 * @param limit - Max items to include
 * @returns Formatted message
 */
export declare function formatResearchDigest(findings: ResearchFinding[], limit?: number): string;
//# sourceMappingURL=proactive-research.d.ts.map
