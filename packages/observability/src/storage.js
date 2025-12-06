/**
 * ObservabilityStorage handles D1 database operations for observability events.
 */
export class ObservabilityStorage {
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Write a completed event to the database.
   */
  async writeEvent(event) {
    const stmt = this.db.prepare(`
      INSERT INTO observability_events (
        event_id, request_id, app_source, event_type,
        user_id, username, chat_id, repo,
        triggered_at, completed_at, duration_ms,
        status, error_type, error_message,
        input_text, response_text,
        classification_type, classification_category, classification_complexity,
        agents,
        input_tokens, output_tokens, total_tokens, cached_tokens, reasoning_tokens,
        model, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt
      .bind(
        event.eventId,
        event.requestId ?? null,
        event.appSource,
        event.eventType,
        event.userId ?? null,
        event.username ?? null,
        event.chatId ?? null,
        event.repo ?? null,
        event.triggeredAt,
        event.completedAt ?? null,
        event.durationMs ?? null,
        event.status,
        event.errorType ?? null,
        event.errorMessage ?? null,
        event.inputText ?? null,
        event.responseText ?? null,
        event.classification?.type ?? null,
        event.classification?.category ?? null,
        event.classification?.complexity ?? null,
        JSON.stringify(event.agents),
        event.inputTokens,
        event.outputTokens,
        event.totalTokens,
        event.cachedTokens,
        event.reasoningTokens,
        event.model ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null
      )
      .run();
  }
  /**
   * Get recent events ordered by triggered_at descending.
   */
  async getRecentEvents(limit = 50) {
    const result = await this.db
      .prepare(`
      SELECT * FROM observability_events
      ORDER BY triggered_at DESC
      LIMIT ?
    `)
      .bind(limit)
      .all();
    return (result.results ?? []).map(this.rowToEvent);
  }
  /**
   * Get events by app source.
   */
  async getEventsBySource(appSource, limit = 50) {
    const result = await this.db
      .prepare(`
      SELECT * FROM observability_events
      WHERE app_source = ?
      ORDER BY triggered_at DESC
      LIMIT ?
    `)
      .bind(appSource, limit)
      .all();
    return (result.results ?? []).map(this.rowToEvent);
  }
  /**
   * Get events by user ID.
   */
  async getEventsByUser(userId, limit = 50) {
    const result = await this.db
      .prepare(`
      SELECT * FROM observability_events
      WHERE user_id = ?
      ORDER BY triggered_at DESC
      LIMIT ?
    `)
      .bind(userId, limit)
      .all();
    return (result.results ?? []).map(this.rowToEvent);
  }
  /**
   * Get error events from the last N hours.
   */
  async getRecentErrors(hours = 24, limit = 50) {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const result = await this.db
      .prepare(`
      SELECT * FROM observability_events
      WHERE status = 'error' AND triggered_at > ?
      ORDER BY triggered_at DESC
      LIMIT ?
    `)
      .bind(cutoff, limit)
      .all();
    return (result.results ?? []).map(this.rowToEvent);
  }
  /**
   * Get daily metrics for the last N days.
   */
  async getDailyMetrics(days = 7) {
    const result = await this.db
      .prepare(`
      SELECT * FROM observability_daily_metrics
      WHERE date >= date('now', '-' || ? || ' days')
      ORDER BY date DESC
    `)
      .bind(days)
      .all();
    return (result.results ?? []).map((row) => ({
      date: row.date,
      appSource: row.app_source,
      totalEvents: row.total_events,
      successful: row.successful,
      failed: row.failed,
      avgDurationMs: row.avg_duration_ms,
      totalTokens: row.total_tokens,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
    }));
  }
  /**
   * Get category statistics for the last 7 days.
   */
  async getCategoryStats() {
    const result = await this.db.prepare('SELECT * FROM observability_category_stats').all();
    return (result.results ?? []).map((row) => ({
      classificationCategory: row.classification_category,
      total: row.total,
      avgDurationMs: row.avg_duration_ms,
      totalTokens: row.total_tokens,
    }));
  }
  /**
   * Get total token usage for a time range.
   */
  async getTokenUsage(startTime, endTime) {
    const result = await this.db
      .prepare(`
      SELECT
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(cached_tokens), 0) as cached_tokens,
        COUNT(*) as event_count
      FROM observability_events
      WHERE triggered_at >= ? AND triggered_at <= ?
    `)
      .bind(startTime, endTime)
      .first();
    return {
      inputTokens: result?.input_tokens ?? 0,
      outputTokens: result?.output_tokens ?? 0,
      totalTokens: result?.total_tokens ?? 0,
      cachedTokens: result?.cached_tokens ?? 0,
      eventCount: result?.event_count ?? 0,
    };
  }
  /**
   * Get a single event by ID.
   */
  async getEventById(eventId) {
    const result = await this.db
      .prepare('SELECT * FROM observability_events WHERE event_id = ?')
      .bind(eventId)
      .first();
    return result ? this.rowToEvent(result) : null;
  }
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
  async updateEventCompletion(eventId, completion) {
    const stmt = this.db.prepare(`
      UPDATE observability_events SET
        status = ?,
        completed_at = ?,
        duration_ms = ?,
        response_text = COALESCE(?, response_text),
        error_type = COALESCE(?, error_type),
        error_message = COALESCE(?, error_message),
        classification_type = COALESCE(?, classification_type),
        classification_category = COALESCE(?, classification_category),
        classification_complexity = COALESCE(?, classification_complexity),
        agents = COALESCE(?, agents),
        input_tokens = COALESCE(?, input_tokens),
        output_tokens = COALESCE(?, output_tokens),
        total_tokens = COALESCE(?, total_tokens),
        cached_tokens = COALESCE(?, cached_tokens),
        reasoning_tokens = COALESCE(?, reasoning_tokens)
      WHERE event_id = ?
    `);
    const result = await stmt
      .bind(
        completion.status,
        completion.completedAt,
        completion.durationMs,
        completion.responseText ?? null,
        completion.errorType ?? null,
        completion.errorMessage ?? null,
        completion.classification?.type ?? null,
        completion.classification?.category ?? null,
        completion.classification?.complexity ?? null,
        completion.agents ? JSON.stringify(completion.agents) : null,
        completion.inputTokens ?? null,
        completion.outputTokens ?? null,
        completion.totalTokens ?? null,
        completion.cachedTokens ?? null,
        completion.reasoningTokens ?? null,
        eventId
      )
      .run();
    return (result.meta?.changes ?? 0) > 0;
  }
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
  async upsertEvent(event) {
    const stmt = this.db.prepare(`
      INSERT INTO observability_events (
        event_id, request_id, app_source, event_type,
        user_id, username, chat_id, repo,
        triggered_at, completed_at, duration_ms,
        status, error_type, error_message,
        input_text, response_text,
        classification_type, classification_category, classification_complexity,
        agents,
        input_tokens, output_tokens, total_tokens, cached_tokens, reasoning_tokens,
        model, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        request_id = COALESCE(excluded.request_id, request_id),
        app_source = COALESCE(excluded.app_source, app_source),
        event_type = COALESCE(excluded.event_type, event_type),
        user_id = COALESCE(excluded.user_id, user_id),
        username = COALESCE(excluded.username, username),
        chat_id = COALESCE(excluded.chat_id, chat_id),
        repo = COALESCE(excluded.repo, repo),
        triggered_at = COALESCE(excluded.triggered_at, triggered_at),
        input_text = COALESCE(excluded.input_text, input_text),
        status = COALESCE(excluded.status, status),
        completed_at = COALESCE(excluded.completed_at, completed_at),
        duration_ms = COALESCE(excluded.duration_ms, duration_ms),
        response_text = COALESCE(excluded.response_text, response_text),
        error_type = COALESCE(excluded.error_type, error_type),
        error_message = COALESCE(excluded.error_message, error_message),
        classification_type = COALESCE(excluded.classification_type, classification_type),
        classification_category = COALESCE(excluded.classification_category, classification_category),
        classification_complexity = COALESCE(excluded.classification_complexity, classification_complexity),
        agents = COALESCE(excluded.agents, agents),
        input_tokens = CASE WHEN excluded.input_tokens > 0 THEN excluded.input_tokens ELSE input_tokens END,
        output_tokens = CASE WHEN excluded.output_tokens > 0 THEN excluded.output_tokens ELSE output_tokens END,
        total_tokens = CASE WHEN excluded.total_tokens > 0 THEN excluded.total_tokens ELSE total_tokens END,
        cached_tokens = CASE WHEN excluded.cached_tokens > 0 THEN excluded.cached_tokens ELSE cached_tokens END,
        reasoning_tokens = CASE WHEN excluded.reasoning_tokens > 0 THEN excluded.reasoning_tokens ELSE reasoning_tokens END,
        model = COALESCE(excluded.model, model),
        metadata = COALESCE(excluded.metadata, metadata)
    `);
    await stmt
      .bind(
        event.eventId,
        event.requestId ?? null,
        event.appSource ?? 'telegram-webhook',
        event.eventType ?? 'message',
        event.userId ?? null,
        event.username ?? null,
        event.chatId ?? null,
        event.repo ?? null,
        event.triggeredAt ?? Date.now(),
        event.completedAt ?? null,
        event.durationMs ?? null,
        event.status ?? 'pending',
        event.errorType ?? null,
        event.errorMessage ?? null,
        event.inputText ?? null,
        event.responseText ?? null,
        event.classification?.type ?? null,
        event.classification?.category ?? null,
        event.classification?.complexity ?? null,
        event.agents ? JSON.stringify(event.agents) : null,
        event.inputTokens ?? 0,
        event.outputTokens ?? 0,
        event.totalTokens ?? 0,
        event.cachedTokens ?? 0,
        event.reasoningTokens ?? 0,
        event.model ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null
      )
      .run();
  }
  /**
   * Convert a database row to an ObservabilityEvent.
   * Handles exactOptionalPropertyTypes by conditionally adding optional fields.
   */
  rowToEvent = (row) => {
    const event = {
      eventId: row.event_id,
      appSource: row.app_source,
      eventType: row.event_type,
      triggeredAt: row.triggered_at,
      status: row.status,
      agents: row.agents ? JSON.parse(row.agents) : [],
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      totalTokens: row.total_tokens,
      cachedTokens: row.cached_tokens,
      reasoningTokens: row.reasoning_tokens,
    };
    // Conditionally add optional properties (exactOptionalPropertyTypes)
    if (row.request_id !== null) {
      event.requestId = row.request_id;
    }
    if (row.user_id !== null) {
      event.userId = row.user_id;
    }
    if (row.username !== null) {
      event.username = row.username;
    }
    if (row.chat_id !== null) {
      event.chatId = row.chat_id;
    }
    if (row.repo !== null) {
      event.repo = row.repo;
    }
    if (row.completed_at !== null) {
      event.completedAt = row.completed_at;
    }
    if (row.duration_ms !== null) {
      event.durationMs = row.duration_ms;
    }
    if (row.error_type !== null) {
      event.errorType = row.error_type;
    }
    if (row.error_message !== null) {
      event.errorMessage = row.error_message;
    }
    if (row.input_text !== null) {
      event.inputText = row.input_text;
    }
    if (row.response_text !== null) {
      event.responseText = row.response_text;
    }
    if (row.model !== null) {
      event.model = row.model;
    }
    if (row.metadata !== null) {
      event.metadata = JSON.parse(row.metadata);
    }
    if (row.classification_type && row.classification_category) {
      event.classification = {
        type: row.classification_type,
        category: row.classification_category,
        complexity: row.classification_complexity ?? 'unknown',
      };
    }
    return event;
  };
}
