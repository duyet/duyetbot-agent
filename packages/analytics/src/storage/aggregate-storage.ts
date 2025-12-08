/**
 * Analytics Aggregate Storage
 *
 * Architecture (Centralized Data Monitoring):
 * - The `analytics_token_aggregates` table has been dropped in favor of computed views
 * - Aggregates are now computed on-demand from source tables (chat_messages, observability_events)
 * - Views available: analytics_user_daily_view, analytics_platform_daily_view, etc.
 *
 * Note: This is a trade-off of compute time for storage consistency.
 * For high-frequency dashboards, consider caching computed results.
 */

import type { AggregateType, PeriodType } from '../types.js';
import { BaseStorage } from './base.js';

/**
 * Token aggregate type
 */
export interface TokenAggregate {
  id: number;
  aggregateType: AggregateType;
  aggregateKey: string;
  periodType: PeriodType;
  periodStart: number;
  periodEnd: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  eventCount: number;
  sessionCount: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  p99DurationMs: number | null;
  estimatedCostUsd: number;
  lastComputedAt: number | null;
  computationDurationMs: number | null;
  createdAt: number;
}

/**
 * Token usage summary
 */
export interface TokenUsageSummary {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
  messageCount: number;
  eventCount: number;
  estimatedCostUsd: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesData {
  timestamp: number;
  period: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  sessionCount: number;
}

/**
 * Platform statistics
 */
export interface PlatformStats {
  platform: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  sessionCount: number;
  estimatedCostUsd: number;
  costPerSession: number;
}

/**
 * Model usage statistics
 */
export interface ModelUsageStats {
  model: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  messageCount: number;
  estimatedCostUsd: number;
  costPerMessage: number;
}

/**
 * AggregateStorage handles token aggregates for analytics.
 * Aggregates are now computed on-demand from chat_messages.
 */
export class AggregateStorage extends BaseStorage {
  /**
   * Get daily aggregates within a date range.
   * NOTE: Now computed on-demand from chat_messages.
   * @param from Start timestamp
   * @param to End timestamp
   * @param _type Optional aggregate type filter (currently ignored, all types computed together)
   * @returns Array of aggregates
   */
  async getDailyRange(from: number, to: number, _type?: AggregateType): Promise<TokenAggregate[]> {
    // Compute daily aggregates on-demand from chat_messages
    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        'daily' as aggregateType,
        date(timestamp/1000, 'unixepoch') as aggregateKey,
        'day' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch'), '+1 day') * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY date(timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [from, to]
    );
  }

  /**
   * Get weekly aggregates within a date range.
   * NOTE: Now computed on-demand from chat_messages.
   * @param from Start timestamp
   * @param to End timestamp
   * @param _type Optional aggregate type filter
   * @returns Array of aggregates
   */
  async getWeeklyRange(from: number, to: number, _type?: AggregateType): Promise<TokenAggregate[]> {
    // Compute weekly aggregates on-demand from chat_messages
    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        'weekly' as aggregateType,
        strftime('%Y-W%W', timestamp/1000, 'unixepoch') as aggregateKey,
        'week' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'weekday 0', '-6 days')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'weekday 0', '+1 day')) * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY strftime('%Y-W%W', timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [from, to]
    );
  }

  /**
   * Get monthly aggregates within a date range.
   * NOTE: Now computed on-demand from chat_messages.
   * @param from Start timestamp
   * @param to End timestamp
   * @param _type Optional aggregate type filter
   * @returns Array of aggregates
   */
  async getMonthlyRange(
    from: number,
    to: number,
    _type?: AggregateType
  ): Promise<TokenAggregate[]> {
    // Compute monthly aggregates on-demand from chat_messages
    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        'monthly' as aggregateType,
        strftime('%Y-%m', timestamp/1000, 'unixepoch') as aggregateKey,
        'month' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'start of month')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'start of month', '+1 month')) * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY strftime('%Y-%m', timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [from, to]
    );
  }

  /**
   * Get daily aggregates for a specific type and key.
   * NOTE: Now computed on-demand from chat_messages.
   * @param type Aggregate type (user_daily, platform_daily, etc.)
   * @param key Aggregate key (user_id, platform, model name)
   * @param range Date range
   * @returns Array of aggregates
   */
  async getDailyAggregates(
    type: AggregateType,
    key: string,
    range: { startTime: number; endTime: number }
  ): Promise<TokenAggregate[]> {
    // Determine the filter column based on aggregate type
    let filterColumn = 'user_id';
    if (type.includes('platform')) {
      filterColumn = 'platform';
    } else if (type.includes('model')) {
      filterColumn = 'model';
    }

    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        ? as aggregateType,
        ? as aggregateKey,
        'day' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch'), '+1 day') * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE ${filterColumn} = ? AND timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY date(timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [type, key, key, range.startTime, range.endTime]
    );
  }

  /**
   * Get weekly aggregates for a specific type and key.
   * NOTE: Now computed on-demand from chat_messages.
   */
  async getWeeklyAggregates(
    type: AggregateType,
    key: string,
    range: { startTime: number; endTime: number }
  ): Promise<TokenAggregate[]> {
    let filterColumn = 'user_id';
    if (type.includes('platform')) {
      filterColumn = 'platform';
    } else if (type.includes('model')) {
      filterColumn = 'model';
    }

    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        ? as aggregateType,
        ? as aggregateKey,
        'week' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'weekday 0', '-6 days')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'weekday 0', '+1 day')) * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE ${filterColumn} = ? AND timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY strftime('%Y-W%W', timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [type, key, key, range.startTime, range.endTime]
    );
  }

  /**
   * Get monthly aggregates for a specific type and key.
   * NOTE: Now computed on-demand from chat_messages.
   */
  async getMonthlyAggregates(
    type: AggregateType,
    key: string,
    range: { startTime: number; endTime: number }
  ): Promise<TokenAggregate[]> {
    let filterColumn = 'user_id';
    if (type.includes('platform')) {
      filterColumn = 'platform';
    } else if (type.includes('model')) {
      filterColumn = 'model';
    }

    return this.all<TokenAggregate>(
      `SELECT
        0 as id,
        ? as aggregateType,
        ? as aggregateKey,
        'month' as periodType,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'start of month')) * 1000 as periodStart,
        strftime('%s', date(timestamp/1000, 'unixepoch', 'start of month', '+1 month')) * 1000 as periodEnd,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COALESCE(SUM(cached_tokens), 0) as cachedTokens,
        COALESCE(SUM(reasoning_tokens), 0) as reasoningTokens,
        COUNT(*) as messageCount,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as userMessageCount,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) as assistantMessageCount,
        0 as eventCount,
        COUNT(DISTINCT session_id) as sessionCount,
        0 as successCount,
        0 as errorCount,
        0 as totalDurationMs,
        0 as avgDurationMs,
        0 as minDurationMs,
        0 as maxDurationMs,
        NULL as p50DurationMs,
        NULL as p95DurationMs,
        NULL as p99DurationMs,
        0 as estimatedCostUsd,
        NULL as lastComputedAt,
        NULL as computationDurationMs,
        MAX(created_at) as createdAt
      FROM chat_messages
      WHERE ${filterColumn} = ? AND timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY strftime('%Y-%m', timestamp/1000, 'unixepoch')
      ORDER BY periodStart DESC`,
      [type, key, key, range.startTime, range.endTime]
    );
  }

  /**
   * Get token usage summary for a user or entire platform.
   * NOTE: Now computed on-demand from chat_messages.
   * @param userId Optional user ID for user-specific summary
   * @param range Optional date range
   * @returns Token usage summary
   */
  async getTokenSummary(
    userId?: string,
    range?: { startTime: number; endTime: number }
  ): Promise<TokenUsageSummary> {
    let sql = `SELECT
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
      COALESCE(SUM(cached_tokens), 0) as cached_tokens,
      COALESCE(SUM(reasoning_tokens), 0) as reasoning_tokens,
      COUNT(*) as message_count,
      COUNT(DISTINCT event_id) as event_count
    FROM chat_messages
    WHERE COALESCE(is_archived, 0) = 0`;

    const params: unknown[] = [];

    if (userId) {
      sql += ` AND user_id = ?`;
      params.push(userId);
    }

    if (range) {
      sql += ` AND timestamp >= ? AND timestamp <= ?`;
      params.push(range.startTime, range.endTime);
    }

    const result = await this.first<{
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
      cached_tokens: number;
      reasoning_tokens: number;
      message_count: number;
      event_count: number;
    }>(sql, params);

    return {
      inputTokens: result?.input_tokens ?? 0,
      outputTokens: result?.output_tokens ?? 0,
      totalTokens: result?.total_tokens ?? 0,
      cachedTokens: result?.cached_tokens ?? 0,
      reasoningTokens: result?.reasoning_tokens ?? 0,
      messageCount: result?.message_count ?? 0,
      eventCount: result?.event_count ?? 0,
      estimatedCostUsd: 0, // TODO: Calculate based on cost config
    };
  }

  /**
   * Get token timeline for visualization.
   * NOTE: Now computed on-demand from chat_messages.
   * @param granularity Time granularity (hour, day, week)
   * @param range Date range
   * @returns Array of time series data points
   */
  async getTokenTimeline(
    granularity: 'hour' | 'day' | 'week',
    range: { startTime: number; endTime: number }
  ): Promise<TimeSeriesData[]> {
    let groupExpr: string;
    if (granularity === 'hour') {
      groupExpr = "strftime('%Y-%m-%d %H:00', timestamp/1000, 'unixepoch')";
    } else if (granularity === 'week') {
      groupExpr = "strftime('%Y-W%W', timestamp/1000, 'unixepoch')";
    } else {
      groupExpr = "date(timestamp/1000, 'unixepoch')";
    }

    return this.all<TimeSeriesData>(
      `SELECT
        strftime('%s', ${groupExpr}) * 1000 as timestamp,
        ${groupExpr} as period,
        COALESCE(SUM(input_tokens), 0) as inputTokens,
        COALESCE(SUM(output_tokens), 0) as outputTokens,
        COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
        COUNT(*) as messageCount,
        COUNT(DISTINCT session_id) as sessionCount
      FROM chat_messages
      WHERE timestamp >= ? AND timestamp <= ? AND COALESCE(is_archived, 0) = 0
      GROUP BY ${groupExpr}
      ORDER BY timestamp DESC`,
      [range.startTime, range.endTime]
    );
  }

  /**
   * Get platform statistics.
   * NOTE: Now computed on-demand from chat_messages.
   * @param range Optional date range
   * @returns Array of platform stats
   */
  async getPlatformStats(range?: { startTime: number; endTime: number }): Promise<PlatformStats[]> {
    let sql = `SELECT
      platform,
      date(timestamp/1000, 'unixepoch') as date,
      COALESCE(SUM(input_tokens), 0) as inputTokens,
      COALESCE(SUM(output_tokens), 0) as outputTokens,
      COUNT(*) as messageCount,
      COUNT(DISTINCT session_id) as sessionCount,
      0 as estimatedCostUsd,
      0 as costPerSession
    FROM chat_messages
    WHERE COALESCE(is_archived, 0) = 0`;

    const params: unknown[] = [];

    if (range) {
      sql += ` AND timestamp >= ? AND timestamp <= ?`;
      params.push(range.startTime, range.endTime);
    }

    sql += ` GROUP BY platform, date(timestamp/1000, 'unixepoch')
             ORDER BY date DESC`;

    return this.all<PlatformStats>(sql, params);
  }

  /**
   * Get model usage statistics.
   * NOTE: Now computed on-demand from chat_messages.
   * @param range Optional date range
   * @returns Array of model usage stats
   */
  async getModelUsage(range?: { startTime: number; endTime: number }): Promise<ModelUsageStats[]> {
    let sql = `SELECT
      COALESCE(model, 'unknown') as model,
      date(timestamp/1000, 'unixepoch') as date,
      COALESCE(SUM(input_tokens), 0) as inputTokens,
      COALESCE(SUM(output_tokens), 0) as outputTokens,
      COUNT(*) as messageCount,
      0 as estimatedCostUsd,
      0 as costPerMessage
    FROM chat_messages
    WHERE COALESCE(is_archived, 0) = 0`;

    const params: unknown[] = [];

    if (range) {
      sql += ` AND timestamp >= ? AND timestamp <= ?`;
      params.push(range.startTime, range.endTime);
    }

    sql += ` GROUP BY model, date(timestamp/1000, 'unixepoch')
             ORDER BY date DESC`;

    return this.all<ModelUsageStats>(sql, params);
  }

  /**
   * Compute daily aggregates for a specific date.
   * NOTE: This is now a no-op since aggregates are computed on-demand.
   * Kept for API compatibility but does nothing.
   * @param _date Date to compute aggregates for (ignored)
   */
  async computeDailyAggregates(_date: Date): Promise<void> {
    // No-op: Aggregates are now computed on-demand from chat_messages
    // This method is kept for API compatibility but does nothing
    console.log('computeDailyAggregates: No-op - aggregates computed on-demand');
  }
}
