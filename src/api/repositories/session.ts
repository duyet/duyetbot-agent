/**
 * Session Repository
 *
 * Data access layer for session metadata in D1
 */

import type { SessionState } from '@/agent/session';
import type { D1Database } from '@cloudflare/workers-types';

export interface SessionRow {
  id: string;
  user_id: string;
  state: SessionState;
  title: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

export interface CreateSessionInput {
  id: string;
  userId: string;
  state: SessionState;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  state?: SessionState;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  userId: string;
  state?: SessionState;
  limit?: number;
  offset?: number;
}

export class SessionRepository {
  constructor(private db: D1Database) {}

  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<SessionRow> {
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, state, title, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        input.id,
        input.userId,
        input.state,
        input.title || null,
        now,
        now,
        input.metadata ? JSON.stringify(input.metadata) : null
      )
      .run();

    return {
      id: input.id,
      user_id: input.userId,
      state: input.state,
      title: input.title || null,
      created_at: now,
      updated_at: now,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    };
  }

  /**
   * Get session by ID for a specific user
   */
  async get(userId: string, sessionId: string): Promise<SessionRow | null> {
    const result = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .first();

    return result ? (result as unknown as SessionRow) : null;
  }

  /**
   * Update session
   */
  async update(
    userId: string,
    sessionId: string,
    input: UpdateSessionInput
  ): Promise<SessionRow | null> {
    const updates: string[] = [];
    const values: unknown[] = [];

    if ('state' in input) {
      updates.push('state = ?');
      values.push(input.state);
    }

    if ('title' in input) {
      updates.push('title = ?');
      values.push(input.title);
    }

    if ('metadata' in input) {
      updates.push('metadata = ?');
      values.push(input.metadata ? JSON.stringify(input.metadata) : null);
    }

    if (updates.length === 0) {
      return this.get(userId, sessionId);
    }

    // Add updated_at
    updates.push('updated_at = ?');
    values.push(Date.now());

    // Add WHERE clause values
    values.push(sessionId);
    values.push(userId);

    await this.db
      .prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...values)
      .run();

    return this.get(userId, sessionId);
  }

  /**
   * Delete session
   */
  async delete(userId: string, sessionId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .run();
  }

  /**
   * List sessions for a user
   */
  async list(options: ListSessionsOptions): Promise<SessionRow[]> {
    const { userId, state, limit = 100, offset = 0 } = options;

    let query = 'SELECT * FROM sessions WHERE user_id = ?';
    const values: unknown[] = [userId];

    if (state) {
      query += ' AND state = ?';
      values.push(state);
    }

    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    values.push(limit, offset);

    const result = await this.db
      .prepare(query)
      .bind(...values)
      .all();

    return (result.results || []) as unknown as SessionRow[];
  }

  /**
   * Count sessions for a user
   */
  async count(userId: string, state?: SessionState): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM sessions WHERE user_id = ?';
    const values: unknown[] = [userId];

    if (state) {
      query += ' AND state = ?';
      values.push(state);
    }

    const result = await this.db
      .prepare(query)
      .bind(...values)
      .first();

    return result ? (result.count as number) : 0;
  }

  /**
   * Delete all sessions for a user (GDPR compliance)
   */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }
}

/**
 * Create session repository
 */
export function createSessionRepository(db: D1Database): SessionRepository {
  return new SessionRepository(db);
}
