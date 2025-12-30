/**
 * Event Bridge
 *
 * Central event bus for cross-agent communication in the DuyetBot ecosystem.
 * Persists events to D1 for durability and provides pub/sub capabilities.
 *
 * @module events/event-bridge
 */

import { logger } from '@duyetbot/hono-middleware';
import type {
  AgentEvent,
  DeliveryStatus,
  EventBridgeStats,
  EventCategory,
  EventPriority,
  EventQueryOptions,
  EventSource,
  EventSubscription,
} from './types.js';
import { DEFAULT_TTL, PRIORITY_WEIGHTS } from './types.js';

/**
 * Event Bridge configuration options.
 */
export interface EventBridgeConfig {
  /** D1 database binding */
  db: D1Database;

  /** This agent's identifier */
  agentId: EventSource;

  /** Maximum events to keep in memory cache */
  maxCacheSize?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event handler callback type.
 */
export type EventHandler = (event: AgentEvent) => Promise<void>;

/**
 * Event Bridge - Central hub for cross-agent communication.
 *
 * Features:
 * - Publish events to D1 event stream
 * - Subscribe to events by category/type
 * - Query historical events
 * - Track delivery status
 * - Automatic TTL expiration
 *
 * @example
 * ```typescript
 * const bridge = new EventBridge({
 *   db: env.OBSERVABILITY_DB,
 *   agentId: 'telegram-bot',
 * });
 *
 * // Publish an event
 * await bridge.publish({
 *   category: 'github',
 *   type: 'pr.opened',
 *   priority: 'normal',
 *   payload: { repo: 'owner/repo', prNumber: 123 },
 * });
 *
 * // Subscribe to events
 * bridge.subscribe(['github'], async (event) => {
 *   console.log('Received:', event);
 * });
 *
 * // Process pending events
 * await bridge.processPending();
 * ```
 */
export class EventBridge {
  private db: D1Database;
  private agentId: EventSource;
  private handlers: Map<string, EventHandler[]> = new Map();
  private subscription: EventSubscription | null = null;
  private debug: boolean;

  constructor(config: EventBridgeConfig) {
    this.db = config.db;
    this.agentId = config.agentId;
    this.debug = config.debug ?? false;
  }

  /**
   * Initialize the event bridge (create tables if needed).
   */
  async initialize(): Promise<void> {
    try {
      await this.db.batch([
        // Events table
        this.db.prepare(`
          CREATE TABLE IF NOT EXISTS agent_events (
            id TEXT PRIMARY KEY,
            sequence INTEGER UNIQUE,
            category TEXT NOT NULL,
            type TEXT NOT NULL,
            source TEXT NOT NULL,
            priority TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            ttl INTEGER NOT NULL,
            payload TEXT NOT NULL,
            correlation_id TEXT,
            targets TEXT,
            delivery_attempts INTEGER DEFAULT 0,
            last_attempt_at INTEGER,
            delivery_status TEXT DEFAULT '{}'
          )
        `),
        // Sequence counter
        this.db.prepare(`
          CREATE TABLE IF NOT EXISTS event_sequence (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            current_value INTEGER NOT NULL DEFAULT 0
          )
        `),
        // Subscriptions table
        this.db.prepare(`
          CREATE TABLE IF NOT EXISTS event_subscriptions (
            subscriber_id TEXT PRIMARY KEY,
            categories TEXT NOT NULL,
            types TEXT NOT NULL,
            min_priority TEXT NOT NULL,
            last_sequence INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
          )
        `),
        // Indexes
        this.db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_events_category ON agent_events(category)
        `),
        this.db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_events_created ON agent_events(created_at)
        `),
        this.db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_events_sequence ON agent_events(sequence)
        `),
        // Initialize sequence if empty
        this.db.prepare(`
          INSERT OR IGNORE INTO event_sequence (id, current_value) VALUES (1, 0)
        `),
      ]);

      this.log('Event bridge initialized');
    } catch (error) {
      logger.error('[EventBridge] Failed to initialize', { error: String(error) });
      throw error;
    }
  }

  /**
   * Publish an event to the event stream.
   */
  async publish(
    event: Omit<AgentEvent, 'id' | 'sequence' | 'createdAt' | 'source' | 'ttl'> & {
      source?: EventSource;
      ttl?: number;
    }
  ): Promise<AgentEvent> {
    const id = crypto.randomUUID();
    const now = Date.now();

    // Get next sequence number
    const sequenceResult = await this.db
      .prepare(
        'UPDATE event_sequence SET current_value = current_value + 1 WHERE id = 1 RETURNING current_value'
      )
      .first<{ current_value: number }>();

    const sequence = sequenceResult?.current_value ?? 1;

    const fullEvent: AgentEvent = {
      id,
      sequence,
      category: event.category,
      type: event.type,
      source: event.source ?? this.agentId,
      priority: event.priority,
      createdAt: now,
      ttl: event.ttl ?? DEFAULT_TTL[event.category],
      payload: event.payload,
    };

    // Only add optional fields if defined
    if (event.correlationId) {
      fullEvent.correlationId = event.correlationId;
    }
    if (event.targets) {
      fullEvent.targets = event.targets;
    }

    // Insert into D1
    await this.db
      .prepare(
        `INSERT INTO agent_events
         (id, sequence, category, type, source, priority, created_at, ttl, payload, correlation_id, targets)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fullEvent.id,
        fullEvent.sequence,
        fullEvent.category,
        fullEvent.type,
        fullEvent.source,
        fullEvent.priority,
        fullEvent.createdAt,
        fullEvent.ttl,
        JSON.stringify(fullEvent.payload),
        fullEvent.correlationId ?? null,
        fullEvent.targets ? JSON.stringify(fullEvent.targets) : null
      )
      .run();

    this.log(`Published event: ${fullEvent.category}/${fullEvent.type}`, { id, sequence });

    return fullEvent;
  }

  /**
   * Subscribe to events by category.
   */
  subscribe(
    categories: EventCategory[],
    handler: EventHandler,
    options?: {
      types?: string[];
      minPriority?: EventPriority;
    }
  ): void {
    const key = `${categories.join(',')}:${options?.types?.join(',') ?? '*'}`;

    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }

    this.handlers.get(key)!.push(handler);

    // Update subscription in database
    this.updateSubscription(categories, options?.types ?? [], options?.minPriority ?? 'low');

    this.log(`Subscribed to: ${key}`);
  }

  /**
   * Update subscription record in D1.
   */
  private async updateSubscription(
    categories: EventCategory[],
    types: string[],
    minPriority: EventPriority
  ): Promise<void> {
    const existing = await this.db
      .prepare('SELECT last_sequence FROM event_subscriptions WHERE subscriber_id = ?')
      .bind(this.agentId)
      .first<{ last_sequence: number }>();

    this.subscription = {
      subscriberId: this.agentId,
      categories,
      types,
      minPriority,
      lastSequence: existing?.last_sequence ?? 0,
      createdAt: Date.now(),
    };

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO event_subscriptions
         (subscriber_id, categories, types, min_priority, last_sequence, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        this.agentId,
        JSON.stringify(categories),
        JSON.stringify(types),
        minPriority,
        this.subscription.lastSequence,
        this.subscription.createdAt
      )
      .run();
  }

  /**
   * Process pending events for this subscriber.
   */
  async processPending(): Promise<number> {
    if (!this.subscription) {
      this.log('No subscription, skipping processPending');
      return 0;
    }

    const events = await this.query({
      categories:
        this.subscription.categories.length > 0 ? this.subscription.categories : undefined,
      types: this.subscription.types.length > 0 ? this.subscription.types : undefined,
      minPriority: this.subscription.minPriority,
      afterSequence: this.subscription.lastSequence,
      limit: 100,
    });

    let processed = 0;

    for (const event of events) {
      // Skip events from self
      if (event.source === this.agentId) {
        continue;
      }

      // Check if targeted to this agent
      if (event.targets && event.targets.length > 0 && !event.targets.includes(this.agentId)) {
        continue;
      }

      // Dispatch to handlers
      for (const [key, handlers] of this.handlers) {
        const [categories, types] = key.split(':');
        const categoryList = categories?.split(',') ?? [];
        const typeList = types === '*' ? [] : (types?.split(',') ?? []);

        // Check category match
        if (categoryList.length > 0 && !categoryList.includes(event.category)) {
          continue;
        }

        // Check type match
        if (typeList.length > 0 && !typeList.includes(event.type)) {
          continue;
        }

        for (const handler of handlers) {
          try {
            await handler(event);
            processed++;
          } catch (error) {
            logger.error('[EventBridge] Handler error', {
              event: event.id,
              error: String(error),
            });
          }
        }
      }

      // Update last sequence
      if (event.sequence && event.sequence > this.subscription.lastSequence) {
        this.subscription.lastSequence = event.sequence;
      }
    }

    // Persist last sequence
    if (processed > 0) {
      await this.db
        .prepare('UPDATE event_subscriptions SET last_sequence = ? WHERE subscriber_id = ?')
        .bind(this.subscription.lastSequence, this.agentId)
        .run();
    }

    this.log(`Processed ${processed} events`);
    return processed;
  }

  /**
   * Query events from the stream.
   */
  async query(options: EventQueryOptions = {}): Promise<AgentEvent[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.categories && options.categories.length > 0) {
      conditions.push(`category IN (${options.categories.map(() => '?').join(', ')})`);
      params.push(...options.categories);
    }

    if (options.types && options.types.length > 0) {
      conditions.push(`type IN (${options.types.map(() => '?').join(', ')})`);
      params.push(...options.types);
    }

    if (options.sources && options.sources.length > 0) {
      conditions.push(`source IN (${options.sources.map(() => '?').join(', ')})`);
      params.push(...options.sources);
    }

    if (options.minPriority) {
      const minWeight = PRIORITY_WEIGHTS[options.minPriority];
      const validPriorities = Object.entries(PRIORITY_WEIGHTS)
        .filter(([_, weight]) => weight >= minWeight)
        .map(([priority]) => priority);
      conditions.push(`priority IN (${validPriorities.map(() => '?').join(', ')})`);
      params.push(...validPriorities);
    }

    if (options.afterSequence !== undefined) {
      conditions.push('sequence > ?');
      params.push(options.afterSequence);
    }

    if (options.afterTimestamp !== undefined) {
      conditions.push('created_at > ?');
      params.push(options.afterTimestamp);
    }

    if (!options.includeExpired) {
      conditions.push('(ttl = 0 OR created_at + (ttl * 1000) > ?)');
      params.push(Date.now());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options.limit ?? 50;

    const sql = `
      SELECT id, sequence, category, type, source, priority, created_at, ttl, payload, correlation_id, targets
      FROM agent_events
      ${whereClause}
      ORDER BY sequence ASC
      LIMIT ?
    `;

    const result = await this.db
      .prepare(sql)
      .bind(...params, limit)
      .all<{
        id: string;
        sequence: number;
        category: EventCategory;
        type: string;
        source: EventSource;
        priority: EventPriority;
        created_at: number;
        ttl: number;
        payload: string;
        correlation_id: string | null;
        targets: string | null;
      }>();

    return (result.results ?? []).map((row): AgentEvent => {
      const event: AgentEvent = {
        id: row.id,
        sequence: row.sequence,
        category: row.category,
        type: row.type,
        source: row.source,
        priority: row.priority,
        createdAt: row.created_at,
        ttl: row.ttl,
        payload: JSON.parse(row.payload) as Record<string, unknown>,
      };

      if (row.correlation_id) {
        event.correlationId = row.correlation_id;
      }

      if (row.targets) {
        event.targets = JSON.parse(row.targets) as EventSource[];
      }

      return event;
    });
  }

  /**
   * Get event bridge statistics.
   */
  async getStats(): Promise<EventBridgeStats> {
    const [
      totalResult,
      categoryResult,
      priorityResult,
      subscriptionResult,
      oldestResult,
      sequenceResult,
    ] = await Promise.all([
      this.db.prepare('SELECT COUNT(*) as count FROM agent_events').first<{ count: number }>(),
      this.db
        .prepare('SELECT category, COUNT(*) as count FROM agent_events GROUP BY category')
        .all<{ category: EventCategory; count: number }>(),
      this.db
        .prepare('SELECT priority, COUNT(*) as count FROM agent_events GROUP BY priority')
        .all<{ priority: EventPriority; count: number }>(),
      this.db
        .prepare('SELECT COUNT(*) as count FROM event_subscriptions')
        .first<{ count: number }>(),
      this.db
        .prepare('SELECT MIN(created_at) as oldest FROM agent_events')
        .first<{ oldest: number | null }>(),
      this.db
        .prepare('SELECT current_value FROM event_sequence WHERE id = 1')
        .first<{ current_value: number }>(),
    ]);

    const byCategory = {} as Record<EventCategory, number>;
    for (const row of categoryResult.results ?? []) {
      byCategory[row.category] = row.count;
    }

    const byPriority = {} as Record<EventPriority, number>;
    for (const row of priorityResult.results ?? []) {
      byPriority[row.priority] = row.count;
    }

    const stats: EventBridgeStats = {
      totalEvents: totalResult?.count ?? 0,
      byCategory,
      byPriority,
      activeSubscriptions: subscriptionResult?.count ?? 0,
      currentSequence: sequenceResult?.current_value ?? 0,
    };

    if (oldestResult?.oldest !== null && oldestResult?.oldest !== undefined) {
      stats.oldestEventAt = oldestResult.oldest;
    }

    return stats;
  }

  /**
   * Acknowledge event delivery.
   */
  async acknowledge(eventId: string): Promise<void> {
    const existing = await this.db
      .prepare('SELECT delivery_status FROM agent_events WHERE id = ?')
      .bind(eventId)
      .first<{ delivery_status: string }>();

    if (!existing) {
      return;
    }

    const status = JSON.parse(existing.delivery_status) as Record<EventSource, DeliveryStatus>;
    status[this.agentId] = 'acknowledged';

    await this.db
      .prepare('UPDATE agent_events SET delivery_status = ? WHERE id = ?')
      .bind(JSON.stringify(status), eventId)
      .run();
  }

  /**
   * Clean up expired events.
   */
  async cleanup(): Promise<number> {
    const now = Date.now();

    const result = await this.db
      .prepare('DELETE FROM agent_events WHERE ttl > 0 AND created_at + (ttl * 1000) < ?')
      .bind(now)
      .run();

    const deleted = result.meta?.changes ?? 0;
    if (deleted > 0) {
      this.log(`Cleaned up ${deleted} expired events`);
    }

    return deleted;
  }

  /**
   * Log helper with debug toggle.
   */
  private log(message: string, data?: Record<string, unknown>): void {
    if (this.debug) {
      logger.info(`[EventBridge][${this.agentId}] ${message}`, data);
    }
  }
}
