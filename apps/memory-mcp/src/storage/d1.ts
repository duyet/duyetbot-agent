import type { D1Database } from '@cloudflare/workers-types';
import type { Session, SessionToken, User } from '../types.js';

export class D1Storage {
  constructor(private db: D1Database) {}

  // User operations
  async getUser(id: string): Promise<User | null> {
    const result = await this.db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
    return result || null;
  }

  async getUserByGitHubId(githubId: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE github_id = ?')
      .bind(githubId)
      .first<User>();
    return result || null;
  }

  async createUser(user: User): Promise<User> {
    await this.db
      .prepare(
        `INSERT INTO users (id, github_id, github_login, email, name, avatar_url, created_at, updated_at)
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
      .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  // Session operations
  async getSession(id: string): Promise<Session | null> {
    const result = await this.db
      .prepare('SELECT * FROM sessions WHERE id = ?')
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

    let countQuery = 'SELECT COUNT(*) as count FROM sessions WHERE user_id = ?';
    let selectQuery = 'SELECT * FROM sessions WHERE user_id = ?';
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
        `INSERT INTO sessions (id, user_id, title, state, created_at, updated_at, metadata)
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
      .prepare(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
  }

  // Token operations
  async getToken(token: string): Promise<SessionToken | null> {
    const result = await this.db
      .prepare('SELECT * FROM session_tokens WHERE token = ?')
      .bind(token)
      .first<SessionToken>();
    return result || null;
  }

  async createToken(token: SessionToken): Promise<SessionToken> {
    await this.db
      .prepare(
        `INSERT INTO session_tokens (token, user_id, expires_at, created_at)
         VALUES (?, ?, ?, ?)`
      )
      .bind(token.token, token.user_id, token.expires_at, token.created_at)
      .run();
    return token;
  }

  async deleteToken(token: string): Promise<void> {
    await this.db.prepare('DELETE FROM session_tokens WHERE token = ?').bind(token).run();
  }

  async deleteExpiredTokens(): Promise<void> {
    await this.db.prepare('DELETE FROM session_tokens WHERE expires_at < ?').bind(Date.now()).run();
  }
}
