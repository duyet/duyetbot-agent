# API Integration Guide

This guide provides examples for integrating the dashboard API with the Cloudflare D1 database and the main agent system.

## Database Integration

### Schema Definition

Expected database tables and their integration with the API:

```sql
-- Messages table
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  visibility TEXT DEFAULT 'public',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  message_count INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  duration INTEGER,
  status TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Agent steps table
CREATE TABLE agent_steps (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  status TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration INTEGER,
  result TEXT,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (parent_id) REFERENCES agent_steps(id)
);

-- Daily aggregates table
CREATE TABLE daily_aggregates (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  messages INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, type, key)
);

-- Pricing config table
CREATE TABLE pricing_config (
  model TEXT PRIMARY KEY,
  input_price REAL NOT NULL,
  output_price REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## Database Service Layer

Create a service layer to abstract database operations. Replace the mock implementations:

```typescript
// apps/dashboard/app/api/services/messageService.ts

import type { D1Database } from '@cloudflare/workers-types';
import { Message, DailyAggregate } from '../types';

export class MessageService {
  constructor(private db: D1Database) {}

  async getById(id: string): Promise<Message | null> {
    const result = await this.db
      .prepare('SELECT * FROM messages WHERE id = ?')
      .bind(id)
      .first<any>();

    return result ? this.mapToMessage(result) : null;
  }

  async list(options: {
    userId?: string;
    sessionId?: string;
    platform?: string;
    visibility?: string;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }): Promise<{ messages: Message[]; total: number }> {
    let query = 'SELECT * FROM messages WHERE 1=1';
    const params: any[] = [];

    if (options.userId) {
      query += ' AND user_id = ?';
      params.push(options.userId);
    }
    if (options.sessionId) {
      query += ' AND session_id = ?';
      params.push(options.sessionId);
    }
    if (options.platform) {
      query += ' AND platform = ?';
      params.push(options.platform);
    }
    if (options.visibility) {
      query += ' AND visibility = ?';
      params.push(options.visibility);
    }
    if (options.from) {
      query += ' AND timestamp >= ?';
      params.push(options.from);
    }
    if (options.to) {
      query += ' AND timestamp <= ?';
      params.push(options.to);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const countResult = await this.db.prepare(countQuery).bind(...params).first<{ count: number }>();
    const total = countResult?.count || 0;

    // Get paginated results
    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(options.limit, options.offset);

    const results = await this.db
      .prepare(query)
      .bind(...params)
      .all<any>();

    return {
      messages: results.results.map((r) => this.mapToMessage(r)),
      total,
    };
  }

  async fullTextSearch(query: string, options: {
    limit: number;
    offset: number;
  }): Promise<{ messages: Message[]; total: number }> {
    // Implement full-text search using Cloudflare's built-in FTS or custom query
    // This is a simplified example
    const searchQuery = `
      SELECT * FROM messages
      WHERE content LIKE ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM messages
      WHERE content LIKE ?
    `;

    const likeQuery = `%${query}%`;

    const countResult = await this.db
      .prepare(countQuery)
      .bind(likeQuery)
      .first<{ count: number }>();
    const total = countResult?.count || 0;

    const results = await this.db
      .prepare(searchQuery)
      .bind(likeQuery, options.limit, options.offset)
      .all<any>();

    return {
      messages: results.results.map((r) => this.mapToMessage(r)),
      total,
    };
  }

  async update(id: string, updates: Partial<Message>): Promise<Message | null> {
    const setClause = Object.keys(updates)
      .map((key) => `${this.camelToSnake(key)} = ?`)
      .join(', ');

    const values = Object.values(updates);

    await this.db
      .prepare(`UPDATE messages SET ${setClause} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return this.getById(id);
  }

  private mapToMessage(row: any): Message {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      platform: row.platform,
      content: row.content,
      role: row.role,
      timestamp: row.timestamp,
      model: row.model,
      tokens: row.input_tokens
        ? {
            input: row.input_tokens,
            output: row.output_tokens,
          }
        : undefined,
      visibility: row.visibility || 'public',
      isPinned: row.is_pinned || false,
      isArchived: row.is_archived || false,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }
}
```

## Integration with Cloudflare Workers

Pass the D1 database instance to the route handlers:

```typescript
// apps/dashboard/app/api/middleware.ts

import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest, NextResponse } from 'next/server';

// Store database instance in context
const dbContext = new Map<string, D1Database>();

export function setDatabase(db: D1Database) {
  dbContext.set('db', db);
}

export function getDatabase(): D1Database {
  const db = dbContext.get('db');
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

// Middleware to attach database to request
export function withDatabase(
  handler: (req: NextRequest, db: D1Database) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const db = getDatabase();
      return await handler(req, db);
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }
  };
}
```

## Real-time Stream Integration

Connect the SSE stream to actual event sources:

```typescript
// apps/dashboard/app/api/services/eventStreamService.ts

export class EventStreamService {
  private subscribers: Map<string, Set<(event: any) => void>> = new Map();

  /**
   * Connect a subscriber to specific event types
   */
  subscribe(types: string[], callback: (event: any) => void): () => void {
    types.forEach((type) => {
      if (!this.subscribers.has(type)) {
        this.subscribers.set(type, new Set());
      }
      this.subscribers.get(type)!.add(callback);
    });

    // Return unsubscribe function
    return () => {
      types.forEach((type) => {
        const subscribers = this.subscribers.get(type);
        if (subscribers) {
          subscribers.delete(callback);
        }
      });
    };
  }

  /**
   * Publish an event to all subscribers
   */
  publish(type: string, event: any) {
    const subscribers = this.subscribers.get(type);
    if (subscribers) {
      subscribers.forEach((callback) => callback(event));
    }
  }
}

// Global instance
export const eventStream = new EventStreamService();

// Usage in agents to publish events
// eventStream.publish('message', { id: 'msg-1', content: '...' });
// eventStream.publish('event', { id: 'event-1', type: 'agent_end' });
```

## Agent Integration

Update the main agent system to publish events to the dashboard:

```typescript
// packages/cloudflare-agent/src/cloudflare-agent.ts

import { eventStream } from '../../dashboard/app/api/services/eventStreamService';

export class CloudflareChatAgent {
  async processMessage(message: string) {
    // Publish message received event
    eventStream.publish('message', {
      type: 'message',
      id: generateId(),
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Process through router and agents
    const result = await this.router.route(message);

    // Publish result event
    eventStream.publish('event', {
      type: 'event',
      id: generateId(),
      agentName: result.agent,
      status: 'completed',
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    return result;
  }
}
```

## Pricing Configuration

Initialize and update pricing in the cost service:

```typescript
// apps/dashboard/app/api/services/costService.ts

import type { D1Database } from '@cloudflare/workers-types';
import { PricingConfig, CostSummary } from '../types';

export class CostService {
  constructor(private db: D1Database) {}

  async getPricingConfig(): Promise<PricingConfig[]> {
    const results = await this.db
      .prepare('SELECT * FROM pricing_config')
      .all<any>();

    return results.results.map((r) => ({
      model: r.model,
      inputPrice: r.input_price,
      outputPrice: r.output_price,
      currency: r.currency,
    }));
  }

  async updatePricingConfig(configs: PricingConfig[]): Promise<void> {
    for (const config of configs) {
      await this.db
        .prepare(
          `INSERT OR REPLACE INTO pricing_config
           (model, input_price, output_price, currency)
           VALUES (?, ?, ?, ?)`
        )
        .bind(
          config.model,
          config.inputPrice,
          config.outputPrice,
          config.currency
        )
        .run();
    }
  }

  async calculateCost(
    tokens: { input: number; output: number },
    model: string
  ): Promise<number> {
    const configs = await this.getPricingConfig();
    const config = configs.find((c) => c.model === model);

    if (!config) {
      console.warn(`No pricing config found for model: ${model}`);
      return 0;
    }

    const inputCost = (tokens.input * config.inputPrice) / 1000;
    const outputCost = (tokens.output * config.outputPrice) / 1000;

    return inputCost + outputCost;
  }
}
```

## Aggregation Pipeline

Implement aggregation queries for analytics:

```typescript
// apps/dashboard/app/api/services/aggregateService.ts

import type { D1Database } from '@cloudflare/workers-types';
import { DailyAggregate } from '../types';

export class AggregateService {
  constructor(private db: D1Database) {}

  async getDailyByTypeAndKey(
    type: string,
    key: string,
    dateRange?: { from?: string; to?: string }
  ): Promise<DailyAggregate[]> {
    let query = `
      SELECT * FROM daily_aggregates
      WHERE type = ? AND key = ?
    `;
    const params = [type, key];

    if (dateRange?.from) {
      query += ' AND date >= ?';
      params.push(dateRange.from);
    }
    if (dateRange?.to) {
      query += ' AND date <= ?';
      params.push(dateRange.to);
    }

    query += ' ORDER BY date DESC';

    const results = await this.db.prepare(query).bind(...params).all<any>();

    return results.results.map((r) => ({
      date: r.date,
      type: r.type,
      key: r.key,
      messages: r.messages,
      tokens: {
        input: r.input_tokens,
        output: r.output_tokens,
      },
      sessions: r.sessions,
      errors: r.errors,
    }));
  }

  /**
   * Scheduled job to compute daily aggregates
   * Run this daily via Cloudflare Workers Cron Trigger
   */
  async computeDailyAggregates(date: string): Promise<void> {
    // Get all messages for the date
    const messagesQuery = `
      SELECT
        platform,
        COUNT(*) as count,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens
      FROM messages
      WHERE DATE(timestamp) = ?
      GROUP BY platform
    `;

    const messages = await this.db
      .prepare(messagesQuery)
      .bind(date)
      .all<any>();

    for (const row of messages.results) {
      await this.db
        .prepare(
          `INSERT OR REPLACE INTO daily_aggregates
           (date, type, key, messages, input_tokens, output_tokens)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(date, 'platform', row.platform, row.count, row.input_tokens, row.output_tokens)
        .run();
    }
  }
}
```

## Error Handling and Logging

Implement comprehensive error handling:

```typescript
// apps/dashboard/app/api/services/logService.ts

export class LogService {
  async logApiCall(
    path: string,
    method: string,
    status: number,
    duration: number,
    error?: string
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      path,
      method,
      status,
      duration,
      error: error || null,
    };

    // Store in D1 or KV for analytics
    console.log(JSON.stringify(logEntry));

    // Could also send to external logging service
    // await fetch('https://logs.example.com/', { method: 'POST', body: JSON.stringify(logEntry) });
  }
}

// Middleware to measure response time
export async function measurePerformance(
  handler: () => Promise<Response>
): Promise<Response> {
  const start = Date.now();
  const response = await handler();
  const duration = Date.now() - start;

  console.log(`Request took ${duration}ms, status: ${response.status}`);

  return response;
}
```

## Testing with Real Database

Configure tests to use a test D1 instance:

```typescript
// apps/dashboard/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});

// test/setup.ts
import { beforeAll, afterAll } from 'vitest';

let testDb: any;

beforeAll(async () => {
  // Initialize test database
  // testDb = await initializeTestD1();
});

afterAll(async () => {
  // Cleanup
  // await testDb.close();
});

export { testDb };
```

## Deployment Checklist

Before deploying to production:

- [ ] Database schema is created and indexed
- [ ] Pricing configuration is seeded
- [ ] Environment variables are configured
- [ ] Error logging is enabled
- [ ] Rate limiting is implemented
- [ ] Authentication/authorization is enforced
- [ ] API documentation is up-to-date
- [ ] Aggregation jobs are scheduled
- [ ] Backup and recovery procedures are in place
- [ ] Monitoring and alerting are configured
