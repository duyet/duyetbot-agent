import type { D1Database } from '@cloudflare/workers-types';
import type {
  LLMMessage,
  LongTermMemoryItem,
  Session,
  SessionToken,
  ShortTermMemoryItem,
  User,
} from '../types.js';

export class D1Storage {
  constructor(private db: D1Database) {}

  // User operations
  async getUser(id: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM memory_users WHERE id = ?')
      .bind(id)
      .first<User>();
    return result || null;
  }

  async getUserByGitHubId(githubId: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM memory_users WHERE github_id = ?')
      .bind(githubId)
      .first<User>();
    return result || null;
  }

  async createUser(user: User): Promise<User> {
    await this.db
      .prepare(
        `INSERT INTO memory_users (id, github_id, github_login, email, name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        user.id,
        user.github_id,
        user.github_login,
        user.email,
        user.name,
        user.avatar_url,
        user.created_at,
        user.updated_at
      )
      .run();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    await this.db
      .prepare(`UPDATE memory_users SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // Session operations
  async getSession(id: string): Promise<Session | null> {
    const result = await this.db
      .prepare('SELECT * FROM memory_sessions WHERE id = ?')
      .bind(id)
      .first<Session & { metadata: string }>();

    if (!result) {
      return null;
    }

    return {
      ...result,
      metadata: result.metadata ? JSON.parse(result.metadata) : null,
    };
  }

  async listSessions(
    userId: string,
    options: { limit?: number; offset?: number; state?: string } = {}
  ): Promise<{ sessions: Session[]; total: number }> {
    const { limit = 20, offset = 0, state } = options;

    let countQuery = 'SELECT COUNT(*) as count FROM memory_sessions WHERE user_id = ?';
    let selectQuery = 'SELECT * FROM memory_sessions WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (state) {
      countQuery += ' AND state = ?';
      selectQuery += ' AND state = ?';
      params.push(state);
    }

    selectQuery += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';

    const [countResult, sessions] = await Promise.all([
      this.db
        .prepare(countQuery)
        .bind(...params)
        .first<{ count: number }>(),
      this.db
        .prepare(selectQuery)
        .bind(...params, limit, offset)
        .all<Session & { metadata: string }>(),
    ]);

    return {
      sessions: sessions.results.map((s) => ({
        ...s,
        metadata: s.metadata ? JSON.parse(s.metadata) : null,
      })),
      total: countResult?.count || 0,
    };
  }

  async createSession(session: Session): Promise<Session> {
    await this.db
      .prepare(
        `INSERT INTO memory_sessions (id, user_id, title, state, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        session.id,
        session.user_id,
        session.title,
        session.state,
        session.created_at,
        session.updated_at,
        session.metadata ? JSON.stringify(session.metadata) : null
      )
      .run();
    return session;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && value !== undefined) {
        if (key === 'metadata') {
          fields.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    await this.db
      .prepare(`UPDATE memory_sessions SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM memory_sessions WHERE id = ?').bind(id).run();
  }

  // Token operations
  async getToken(token: string): Promise<SessionToken | null> {
    const result = await this.db
      .prepare('SELECT * FROM memory_session_tokens WHERE token = ?')
      .bind(token)
      .first<SessionToken>();
    return result || null;
  }

  async createToken(token: SessionToken): Promise<SessionToken> {
    await this.db
      .prepare(
        `INSERT INTO memory_session_tokens (token, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(token.token, token.user_id, token.expires_at, token.created_at)
      .run();
    return token;
  }

  async deleteToken(token: string): Promise<void> {
    await this.db.prepare('DELETE FROM memory_session_tokens WHERE token = ?').bind(token).run();
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.db
      .prepare('DELETE FROM memory_session_tokens WHERE expires_at < ?')
      .bind(Date.now())
      .run();
  }

  // Message operations
  async getMessages(
    sessionId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<LLMMessage[]> {
    const { limit, offset = 0 } = options;

    let query =
      'SELECT role, content, timestamp, metadata FROM memory_messages WHERE session_id = ? ORDER BY timestamp ASC';
    const params: unknown[] = [sessionId];

    if (limit !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    } else if (offset > 0) {
      query += ' LIMIT -1 OFFSET ?';
      params.push(offset);
    }

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all<{
        role: string;
        content: string;
        timestamp: number;
        metadata: string | null;
      }>();

    return result.results.map((row) => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
      timestamp: row.timestamp,
      ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
    }));
  }

  async saveMessages(sessionId: string, messages: LLMMessage[]): Promise<number> {
    if (messages.length === 0) {
      return 0;
    }

    // Delete existing messages and insert new ones in a batch
    const statements = [
      this.db.prepare('DELETE FROM memory_messages WHERE session_id = ?').bind(sessionId),
    ];

    for (const msg of messages) {
      statements.push(
        this.db
          .prepare(
            'INSERT INTO memory_messages (session_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(
            sessionId,
            msg.role,
            msg.content,
            msg.timestamp || Date.now(),
            msg.metadata ? JSON.stringify(msg.metadata) : null
          )
      );
    }

    await this.db.batch(statements);
    return messages.length;
  }

  async appendMessages(sessionId: string, newMessages: LLMMessage[]): Promise<number> {
    if (newMessages.length === 0) {
      return 0;
    }

    const statements = newMessages.map((msg) =>
      this.db
        .prepare(
          'INSERT INTO memory_messages (session_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(
          sessionId,
          msg.role,
          msg.content,
          msg.timestamp || Date.now(),
          msg.metadata ? JSON.stringify(msg.metadata) : null
        )
    );

    await this.db.batch(statements);
    return newMessages.length;
  }

  async deleteMessages(sessionId: string): Promise<void> {
    await this.db.prepare('DELETE FROM memory_messages WHERE session_id = ?').bind(sessionId).run();
  }

  async getMessageCount(sessionId: string): Promise<number> {
    const result = await this.db
      .prepare('SELECT COUNT(*) as count FROM memory_messages WHERE session_id = ?')
      .bind(sessionId)
      .first<{ count: number }>();
    return result?.count || 0;
  }

  async searchMessages(
    userId: string,
    query: string,
    options: {
      sessionId?: string;
      dateRange?: { start: number; end: number };
      limit?: number;
    } = {}
  ): Promise<
    Array<{
      sessionId: string;
      message: LLMMessage;
      messageIndex: number;
    }>
  > {
    const { sessionId, dateRange, limit = 100 } = options;

    let sql = `
      SELECT m.session_id, m.role, m.content, m.timestamp, m.metadata,
             ROW_NUMBER() OVER (PARTITION BY m.session_id ORDER BY m.timestamp ASC) - 1 as msg_index
      FROM memory_messages m
      JOIN memory_sessions s ON m.session_id = s.id
      WHERE s.user_id = ? AND m.content LIKE ?
    `;
    const params: unknown[] = [userId, `%${query}%`];

    if (sessionId) {
      sql += ' AND m.session_id = ?';
      params.push(sessionId);
    }

    if (dateRange) {
      sql += ' AND m.timestamp >= ? AND m.timestamp <= ?';
      params.push(dateRange.start, dateRange.end);
    }

    sql += ' ORDER BY m.timestamp DESC LIMIT ?';
    params.push(limit);

    const result = await this.db
      .prepare(sql)
      .bind(...params)
      .all<{
        session_id: string;
        role: string;
        content: string;
        timestamp: number;
        metadata: string | null;
        msg_index: number;
      }>();

    return result.results.map((row) => ({
      sessionId: row.session_id,
      message: {
        role: row.role as 'user' | 'assistant' | 'system',
        content: row.content,
        timestamp: row.timestamp,
        ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
      },
      messageIndex: row.msg_index,
    }));
  }

  // Short-term memory operations
  /**
   * Set a short-term memory item with optional TTL
   */
  async setShortTermMemory(
    sessionId: string,
    userId: string,
    key: string,
    value: string,
    ttlSeconds: number = 86400 // 24 hours default
  ): Promise<ShortTermMemoryItem> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + ttlSeconds * 1000;

    await this.db
      .prepare(
        `INSERT INTO memory_short_term (id, session_id, user_id, key, value, expires_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id, key) DO UPDATE SET value = ?, expires_at = ?, updated_at = ?`
      )
      .bind(id, sessionId, userId, key, value, expiresAt, now, now, value, expiresAt, now)
      .run();

    return {
      id,
      session_id: sessionId,
      user_id: userId,
      key,
      value,
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Get a short-term memory item
   */
  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryItem | null> {
    const now = Date.now();

    const result = await this.db
      .prepare(
        `SELECT * FROM memory_short_term WHERE session_id = ? AND key = ? AND expires_at > ?`
      )
      .bind(sessionId, key, now)
      .first<ShortTermMemoryItem>();

    return result || null;
  }

  /**
   * List all short-term memory items for a session
   */
  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryItem[]> {
    const now = Date.now();

    const result = await this.db
      .prepare(
        `SELECT * FROM memory_short_term WHERE session_id = ? AND expires_at > ? ORDER BY updated_at DESC`
      )
      .bind(sessionId, now)
      .all<ShortTermMemoryItem>();

    return result.results || [];
  }

  /**
   * Delete a short-term memory item
   */
  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    const result = await this.db
      .prepare(`DELETE FROM memory_short_term WHERE session_id = ? AND key = ?`)
      .bind(sessionId, key)
      .run();

    return result.success;
  }

  /**
   * Clean up expired short-term memory items
   */
  async cleanupExpiredShortTermMemory(): Promise<number> {
    const now = Date.now();

    const result = await this.db
      .prepare(`DELETE FROM memory_short_term WHERE expires_at <= ?`)
      .bind(now)
      .run();

    return result.meta.changes || 0;
  }

  // Long-term memory operations
  /**
   * Save or update a long-term memory item
   */
  async saveLongTermMemory(
    userId: string,
    category: string,
    key: string,
    value: string,
    options?: {
      importance?: number;
      sourceSessionId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<LongTermMemoryItem> {
    const id = crypto.randomUUID();
    const now = Date.now();
    const importance = options?.importance || 5;
    const sourceSessionId = options?.sourceSessionId || null;
    const metadata = options?.metadata ? JSON.stringify(options.metadata) : null;

    // Try to insert, but if it exists, update it instead
    const existing = await this.db
      .prepare(`SELECT id FROM memory_long_term WHERE user_id = ? AND category = ? AND key = ?`)
      .bind(userId, category, key)
      .first<{ id: string }>();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE memory_long_term SET value = ?, importance = ?, metadata = ?, updated_at = ?, accessed_at = ?, access_count = access_count + 1
           WHERE id = ?`
        )
        .bind(value, importance, metadata, now, now, existing.id)
        .run();

      return this.getLongTermMemory(existing.id) as Promise<LongTermMemoryItem>;
    }

    await this.db
      .prepare(
        `INSERT INTO memory_long_term (id, user_id, category, key, value, importance, source_session_id, metadata, created_at, updated_at, accessed_at, access_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        userId,
        category,
        key,
        value,
        importance,
        sourceSessionId,
        metadata,
        now,
        now,
        now,
        1
      )
      .run();

    return {
      id,
      user_id: userId,
      category: category as any,
      key,
      value,
      importance,
      source_session_id: sourceSessionId,
      metadata: options?.metadata || null,
      created_at: now,
      updated_at: now,
      accessed_at: now,
      access_count: 1,
    };
  }

  /**
   * Get a long-term memory item by ID
   */
  async getLongTermMemory(id: string): Promise<LongTermMemoryItem | null> {
    const result = await this.db
      .prepare(`SELECT * FROM memory_long_term WHERE id = ?`)
      .bind(id)
      .first<any>();

    if (!result) {
      return null;
    }

    // Update access timestamp
    await this.db
      .prepare(
        `UPDATE memory_long_term SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?`
      )
      .bind(Date.now(), id)
      .run();

    return {
      ...result,
      metadata: result.metadata ? JSON.parse(result.metadata) : null,
    };
  }

  /**
   * List long-term memory items by user and optional category
   */
  async listLongTermMemory(
    userId: string,
    options?: {
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: LongTermMemoryItem[]; total: number }> {
    const { category, limit = 50, offset = 0 } = options || {};

    let countQuery = `SELECT COUNT(*) as count FROM memory_long_term WHERE user_id = ?`;
    let selectQuery = `SELECT * FROM memory_long_term WHERE user_id = ?`;
    const params: unknown[] = [userId];

    if (category) {
      countQuery += ` AND category = ?`;
      selectQuery += ` AND category = ?`;
      params.push(category);
    }

    selectQuery += ` ORDER BY accessed_at DESC LIMIT ? OFFSET ?`;

    const [countResult, itemsResult] = await Promise.all([
      this.db
        .prepare(countQuery)
        .bind(...params)
        .first<{ count: number }>(),
      this.db
        .prepare(selectQuery)
        .bind(...params, limit, offset)
        .all<any>(),
    ]);

    return {
      items: (itemsResult.results || []).map((item) => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : null,
      })),
      total: countResult?.count || 0,
    };
  }

  /**
   * Update a long-term memory item
   */
  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.value !== undefined) {
      fields.push(`value = ?`);
      values.push(updates.value);
    }

    if (updates.importance !== undefined) {
      fields.push(`importance = ?`);
      values.push(updates.importance);
    }

    if (updates.metadata !== undefined) {
      fields.push(`metadata = ?`);
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return true;
    }

    fields.push(`updated_at = ?`);
    values.push(Date.now());
    values.push(id);

    const result = await this.db
      .prepare(`UPDATE memory_long_term SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return result.success;
  }

  /**
   * Delete a long-term memory item
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    const result = await this.db
      .prepare(`DELETE FROM memory_long_term WHERE id = ?`)
      .bind(id)
      .run();

    return result.success;
  }

  /**
   * Search long-term memory using FTS5
   * Falls back to LIKE query if FTS5 not available
   */
  async searchLongTermMemory(
    userId: string,
    query: string,
    options?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<LongTermMemoryItem[]> {
    const { categories, limit = 20 } = options || {};

    try {
      // Try FTS5 first
      let ftsQuery = `SELECT memory_id FROM memory_search WHERE user_id = ? AND content MATCH ?`;
      const ftsParams: unknown[] = [userId, query];

      if (categories && categories.length > 0) {
        ftsQuery += ` AND category IN (${categories.map(() => '?').join(',')})`;
        ftsParams.push(...categories);
      }

      ftsQuery += ` LIMIT ?`;
      ftsParams.push(limit);

      const ftsResults = await this.db
        .prepare(ftsQuery)
        .bind(...ftsParams)
        .all<{ memory_id: string }>();

      const memoryIds = ftsResults.results?.map((r) => r.memory_id) || [];

      if (memoryIds.length === 0) {
        return [];
      }

      const placeholders = memoryIds.map(() => '?').join(',');
      const items = await this.db
        .prepare(`SELECT * FROM memory_long_term WHERE id IN (${placeholders})`)
        .bind(...memoryIds)
        .all<any>();

      return (items.results || []).map((item) => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : null,
      }));
    } catch {
      // Fallback to LIKE query if FTS5 fails
      let likeQuery = `SELECT * FROM memory_long_term WHERE user_id = ? AND (key LIKE ? OR value LIKE ?)`;
      const likeParams: unknown[] = [userId, `%${query}%`, `%${query}%`];

      if (categories && categories.length > 0) {
        likeQuery += ` AND category IN (${categories.map(() => '?').join(',')})`;
        likeParams.push(...categories);
      }

      likeQuery += ` ORDER BY importance DESC, accessed_at DESC LIMIT ?`;
      likeParams.push(limit);

      const results = await this.db
        .prepare(likeQuery)
        .bind(...likeParams)
        .all<any>();

      return (results.results || []).map((item) => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : null,
      }));
    }
  }

  /**
   * Index a long-term memory item for semantic search
   */
  async indexMemoryForSearch(
    memoryId: string,
    userId: string,
    content: string,
    category: string
  ): Promise<void> {
    try {
      await this.db
        .prepare(
          `INSERT INTO memory_search (memory_id, user_id, content, category) VALUES (?, ?, ?, ?)`
        )
        .bind(memoryId, userId, content, category)
        .run();
    } catch {
      // Ignore errors if FTS5 is not available
    }
  }
}
