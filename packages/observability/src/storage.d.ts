import type { AppSource, CategoryStat, DailyMetric, ObservabilityEvent } from './types.js';
/**
 * D1 database interface (subset of Cloudflare D1Database).
 */
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
}
/**
 * ObservabilityStorage handles D1 database operations for observability events.
 */
export declare class ObservabilityStorage {
  private db;
  constructor(db: D1Database);
  /**
   * Write a completed event to the database.
   */
  writeEvent(event: ObservabilityEvent): Promise<void>;
  /**
   * Get recent events ordered by triggered_at descending.
   */
  getRecentEvents(limit?: number): Promise<ObservabilityEvent[]>;
  /**
   * Get events by app source.
   */
  getEventsBySource(appSource: AppSource, limit?: number): Promise<ObservabilityEvent[]>;
  /**
   * Get events by user ID.
   */
  getEventsByUser(userId: string, limit?: number): Promise<ObservabilityEvent[]>;
  /**
   * Get error events from the last N hours.
   */
  getRecentErrors(hours?: number, limit?: number): Promise<ObservabilityEvent[]>;
  /**
   * Get daily metrics for the last N days.
   */
  getDailyMetrics(days?: number): Promise<DailyMetric[]>;
  /**
   * Get category statistics for the last 7 days.
   */
  getCategoryStats(): Promise<CategoryStat[]>;
  /**
   * Get total token usage for a time range.
   */
  getTokenUsage(
    startTime: number,
    endTime: number
  ): Promise<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens: number;
    eventCount: number;
  }>;
  /**
   * Get a single event by ID.
   */
  getEventById(eventId: string): Promise<ObservabilityEvent | null>;
  /**
   * Update an existing event with completion data.
   *
   * Used by agents to update events that were created at webhook receipt.
   * This allows the actual agent execution results to be recorded.
   *
   * @param eventId - The event ID to update
   * @param completion - Completion data including status, response, tokens, etc.
   * @returns True if the event was updated, false if not found
   */
  updateEventCompletion(
    eventId: string,
    completion: {
      status: 'success' | 'error';
      completedAt: number;
      durationMs: number;
      responseText?: string;
      errorType?: string;
      errorMessage?: string;
      classification?: {
        type: string;
        category: string;
        complexity: string;
      };
      agents?: ObservabilityEvent['agents'];
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      cachedTokens?: number;
      reasoningTokens?: number;
    }
  ): Promise<boolean>;
  /**
   * Upsert an observability event (INSERT or UPDATE if exists).
   *
   * Uses SQLite UPSERT syntax for atomic insert-or-update operations.
   * This enables progressive updates throughout the request lifecycle:
   * - Initial insert with status='pending' when webhook received
   * - Update to status='processing' when agent starts
   * - Update with classification data after routing
   * - Update with agents array as execution progresses
   * - Final update with completion status, tokens, and response
   *
   * @param event - Partial event data to upsert (eventId is required)
   */
  upsertEvent(
    event: Partial<ObservabilityEvent> & {
      eventId: string;
    }
  ): Promise<void>;
  /**
   * Convert a database row to an ObservabilityEvent.
   * Handles exactOptionalPropertyTypes by conditionally adding optional fields.
   */
  private rowToEvent;
}
//# sourceMappingURL=storage.d.ts.map
