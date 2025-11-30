import type { D1Database } from '@cloudflare/workers-types';
import type { LLMMessage, Session, SessionToken, User } from '../types.js';

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
}
