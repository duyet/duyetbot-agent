/**
 * Routing Monitoring Utilities
 *
 * Functions for formatting, analyzing, and exporting routing statistics.
 */
/**
 * Format routing stats for display
 */
export function formatRoutingStats(stats) {
  const lines = [];
  lines.push('📊 Routing Statistics');
  lines.push(`Total Requests: ${stats.totalRouted}`);
  lines.push(`Average Duration: ${stats.avgDurationMs.toFixed(2)}ms`);
  lines.push('');
  lines.push('By Target:');
  const sortedTargets = Object.entries(stats.byTarget).sort(([, a], [, b]) => b - a);
  for (const [target, count] of sortedTargets) {
    const percentage = ((count / stats.totalRouted) * 100).toFixed(1);
    lines.push(`  ${target}: ${count} (${percentage}%)`);
  }
  return lines.join('\n');
}
/**
 * Calculate enhanced statistics from routing history
 */
export function calculateEnhancedStats(history) {
  if (history.length === 0) {
    return {
      totalRouted: 0,
      byTarget: {},
      avgDurationMs: 0,
      byType: {},
      byCategory: {},
      byComplexity: {},
      medianDurationMs: 0,
      p95DurationMs: 0,
      successRate: 100,
      timeRange: {
        earliest: 0,
        latest: 0,
      },
    };
  }
  const byTarget = {};
  const byType = {};
  const byCategory = {};
  const byComplexity = {};
  const durations = [];
  for (const entry of history) {
    // Target distribution
    byTarget[entry.routedTo] = (byTarget[entry.routedTo] || 0) + 1;
    // Type distribution
    byType[entry.classification.type] = (byType[entry.classification.type] || 0) + 1;
    // Category distribution
    byCategory[entry.classification.category] =
      (byCategory[entry.classification.category] || 0) + 1;
    // Complexity distribution
    byComplexity[entry.classification.complexity] =
      (byComplexity[entry.classification.complexity] || 0) + 1;
    // Duration tracking
    durations.push(entry.durationMs);
  }
  // Calculate duration metrics
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const avgDurationMs = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const medianIdx = Math.floor(sortedDurations.length / 2);
  const medianDurationMs = sortedDurations[medianIdx] || 0;
  const p95Idx = Math.floor(sortedDurations.length * 0.95);
  const p95DurationMs = sortedDurations[p95Idx] || 0;
  // Time range
  const timestamps = history.map((h) => h.timestamp);
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  return {
    totalRouted: history.length,
    byTarget,
    avgDurationMs,
    byType,
    byCategory,
    byComplexity,
    medianDurationMs,
    p95DurationMs,
    successRate: 100, // TODO: Track failures in history
    timeRange: {
      earliest,
      latest,
    },
  };
}
/**
 * Calculate accuracy metrics from routing history
 */
export function calculateAccuracyMetrics(history) {
  if (history.length === 0) {
    return {
      totalClassifications: 0,
      avgConfidence: 0,
      confidenceDistribution: {
        high: 0,
        medium: 0,
        low: 0,
      },
      targetDistribution: {},
    };
  }
  let totalConfidence = 0;
  const confidenceDistribution = {
    high: 0,
    medium: 0,
    low: 0,
  };
  const targetDistribution = {};
  for (const entry of history) {
    const confidence = entry.classification.confidence || 0;
    totalConfidence += confidence;
    // Confidence buckets
    if (confidence >= 0.8) {
      confidenceDistribution.high++;
    } else if (confidence >= 0.5) {
      confidenceDistribution.medium++;
    } else {
      confidenceDistribution.low++;
    }
    // Target distribution
    targetDistribution[entry.routedTo] = (targetDistribution[entry.routedTo] || 0) + 1;
  }
  return {
    totalClassifications: history.length,
    avgConfidence: totalConfidence / history.length,
    confidenceDistribution,
    targetDistribution: targetDistribution,
  };
}
/**
 * Export routing history as JSON
 */
export function exportRoutingHistoryJSON(history) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: history.length,
      entries: history.map((entry) => ({
        timestamp: new Date(entry.timestamp).toISOString(),
        query: entry.query,
        classification: {
          type: entry.classification.type,
          category: entry.classification.category,
          complexity: entry.classification.complexity,
          confidence: entry.classification.confidence,
          reasoning: entry.classification.reasoning,
        },
        routedTo: entry.routedTo,
        durationMs: entry.durationMs,
      })),
    },
    null,
    2
  );
}
/**
 * Export routing history as CSV
 */
export function exportRoutingHistoryCSV(history) {
  const headers = [
    'timestamp',
    'query',
    'type',
    'category',
    'complexity',
    'confidence',
    'routedTo',
    'durationMs',
  ];
  const rows = history.map((entry) => [
    new Date(entry.timestamp).toISOString(),
    `"${entry.query.replace(/"/g, '""')}"`, // Escape quotes in CSV
    entry.classification.type,
    entry.classification.category,
    entry.classification.complexity,
    entry.classification.confidence?.toFixed(2) || '0',
    entry.routedTo,
    entry.durationMs.toString(),
  ]);
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}
/**
 * Format accuracy metrics for display
 */
export function formatAccuracyMetrics(metrics) {
  const lines = [];
  lines.push('🎯 Classification Accuracy Metrics');
  lines.push(`Total Classifications: ${metrics.totalClassifications}`);
  lines.push(`Average Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('Confidence Distribution:');
  lines.push(`  High (≥80%): ${metrics.confidenceDistribution.high}`);
  lines.push(`  Medium (50-80%): ${metrics.confidenceDistribution.medium}`);
  lines.push(`  Low (<50%): ${metrics.confidenceDistribution.low}`);
  return lines.join('\n');
}
/**
 * Format enhanced stats for display
 */
export function formatEnhancedStats(stats) {
  const lines = [];
  lines.push('📊 Enhanced Routing Statistics');
  lines.push(`Total Requests: ${stats.totalRouted}`);
  lines.push(`Success Rate: ${stats.successRate.toFixed(1)}%`);
  lines.push('');
  lines.push('Performance Metrics:');
  lines.push(`  Average Duration: ${stats.avgDurationMs.toFixed(2)}ms`);
  lines.push(`  Median Duration: ${stats.medianDurationMs.toFixed(2)}ms`);
  lines.push(`  P95 Duration: ${stats.p95DurationMs.toFixed(2)}ms`);
  lines.push('');
  lines.push('By Target:');
  const sortedTargets = Object.entries(stats.byTarget).sort(([, a], [, b]) => b - a);
  for (const [target, count] of sortedTargets) {
    const percentage = ((count / stats.totalRouted) * 100).toFixed(1);
    lines.push(`  ${target}: ${count} (${percentage}%)`);
  }
  lines.push('');
  lines.push('By Complexity:');
  const sortedComplexity = Object.entries(stats.byComplexity).sort(([, a], [, b]) => b - a);
  for (const [complexity, count] of sortedComplexity) {
    const percentage = ((count / stats.totalRouted) * 100).toFixed(1);
    lines.push(`  ${complexity}: ${count} (${percentage}%)`);
  }
  if (stats.timeRange.earliest > 0) {
    lines.push('');
    lines.push('Time Range:');
    lines.push(`  First Request: ${new Date(stats.timeRange.earliest).toISOString()}`);
    lines.push(`  Latest Request: ${new Date(stats.timeRange.latest).toISOString()}`);
  }
  return lines.join('\n');
}
