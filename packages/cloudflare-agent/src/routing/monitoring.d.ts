/**
 * Routing Monitoring Utilities
 *
 * Functions for formatting, analyzing, and exporting routing statistics.
 */
import type { QueryClassification, RouteTarget } from './schemas.js';
/**
 * Routing history entry
 */
export interface RoutingHistoryEntry {
  query: string;
  classification: QueryClassification;
  routedTo: RouteTarget;
  timestamp: number;
  durationMs: number;
}
/**
 * Enhanced routing statistics
 */
export interface EnhancedRoutingStats {
  totalRouted: number;
  byTarget: Record<string, number>;
  avgDurationMs: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  byComplexity: Record<string, number>;
  medianDurationMs: number;
  p95DurationMs: number;
  successRate: number;
  timeRange: {
    earliest: number;
    latest: number;
  };
}
/**
 * Accuracy metrics for classification
 */
export interface AccuracyMetrics {
  totalClassifications: number;
  avgConfidence: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  targetDistribution: Record<RouteTarget, number>;
}
/**
 * Format routing stats for display
 */
export declare function formatRoutingStats(stats: {
  totalRouted: number;
  byTarget: Record<string, number>;
  avgDurationMs: number;
}): string;
/**
 * Calculate enhanced statistics from routing history
 */
export declare function calculateEnhancedStats(
  history: RoutingHistoryEntry[]
): EnhancedRoutingStats;
/**
 * Calculate accuracy metrics from routing history
 */
export declare function calculateAccuracyMetrics(history: RoutingHistoryEntry[]): AccuracyMetrics;
/**
 * Export routing history as JSON
 */
export declare function exportRoutingHistoryJSON(history: RoutingHistoryEntry[]): string;
/**
 * Export routing history as CSV
 */
export declare function exportRoutingHistoryCSV(history: RoutingHistoryEntry[]): string;
/**
 * Format accuracy metrics for display
 */
export declare function formatAccuracyMetrics(metrics: AccuracyMetrics): string;
/**
 * Format enhanced stats for display
 */
export declare function formatEnhancedStats(stats: EnhancedRoutingStats): string;
//# sourceMappingURL=monitoring.d.ts.map
