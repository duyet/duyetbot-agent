/**
 * Context Engineering Types
 *
 * Type definitions for context management, monitoring, and compaction
 */

import type { SDKAnyMessage } from '../types.js';

/**
 * Token breakdown by component
 */
export interface ContextBreakdown {
  systemPrompt: number;
  tools: number;
  history: number;
  retrieved: number;
}

/**
 * Context usage metrics
 */
export interface ContextMetrics {
  totalTokens: number;
  utilization: number;
  breakdown: ContextBreakdown;
  messageCount: number;
  toolResultCount: number;
}

/**
 * Context engineering configuration
 */
export interface ContextConfig {
  /**
   * Maximum context tokens (default: 200000 for Claude)
   */
  maxTokens: number;

  /**
   * Trigger compaction at this utilization (default: 0.85)
   */
  compactionThreshold: number;

  /**
   * Number of recent messages to always preserve (default: 5)
   */
  preserveRecentMessages: number;

  /**
   * Prune tool results older than N turns (default: 10)
   */
  pruneToolResultsAfter: number;

  /**
   * Maximum length for individual tool results (default: 2000)
   */
  maxToolResultLength: number;

  /**
   * Enable automatic memory persistence on compaction
   */
  persistOnCompaction: boolean;
}

/**
 * Result of context compaction
 */
export interface CompactedContext {
  /**
   * Summary of compacted messages
   */
  summary: string;

  /**
   * Recent messages preserved in full
   */
  recentMessages: SDKAnyMessage[];

  /**
   * Whether compaction was performed
   */
  wasCompacted: boolean;

  /**
   * Updated metrics after compaction
   */
  metrics: ContextMetrics;

  /**
   * Pruning statistics
   */
  pruningStats?: {
    toolResultsCleared: number;
    toolResultsTruncated: number;
    messagesRemoved: number;
  };
}

/**
 * Summarizer function type
 */
export type SummarizerFn = (content: string) => Promise<string>;

/**
 * Memory persistence function type
 */
export type PersistFn = (
  sessionId: string,
  summary: string,
  metrics: ContextMetrics
) => Promise<void>;

/**
 * Default context configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  maxTokens: 200000,
  compactionThreshold: 0.85,
  preserveRecentMessages: 5,
  pruneToolResultsAfter: 10,
  maxToolResultLength: 2000,
  persistOnCompaction: true,
};

/**
 * Create context config with defaults
 */
export function createContextConfig(overrides?: Partial<ContextConfig>): ContextConfig {
  return {
    ...DEFAULT_CONTEXT_CONFIG,
    ...overrides,
  };
}
