/**
 * Refresh Token Repository
 *
 * Database operations for refresh tokens with D1
 */

import type { RefreshToken } from '../types';

/**
 * Refresh token repository
 */
export class RefreshTokenRepository {
  constructor(private db: D1Database) {}

  /**
   * Create new refresh token
   */
  async create(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    const id = this.generateId();
    const now = Date.now();

    await this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(id, userId, token, expiresAt.getTime(), now)
      .run();

    return {
      id,
      userId,
      token,
      expiresAt,
      createdAt: new Date(now),
    };
  }

  /**
   * Find refresh token by token string
   */
  async findByToken(token: string): Promise<RefreshToken | null> {
    const result = await this.db
      .prepare('SELECT * FROM refresh_tokens WHERE token = ?')
      .bind(token)
      .first<RefreshTokenRow>();

    return result ? this.rowToRefreshToken(result) : null;
  }

  /**
   * Find all refresh tokens for a user
   */
  async findByUserId(userId: string): Promise<RefreshToken[]> {
    const results = await this.db
      .prepare('SELECT * FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all<RefreshTokenRow>();

    return results.results.map((row) => this.rowToRefreshToken(row));
  }

  /**
   * Delete refresh token
   */
  async delete(token: string): Promise<void> {
    await this.db.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(token).run();
  }

  /**
   * Delete all refresh tokens for a user
   */
  async deleteByUserId(userId: string): Promise<void> {
    await this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(userId).run();
  }

  /**
   * Delete expired tokens (cleanup)
   */
  async deleteExpired(): Promise<void> {
    const now = Date.now();
    await this.db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').bind(now).run();
  }

  /**
   * Check if token is valid (exists and not expired)
   */
  async isValid(token: string): Promise<boolean> {
    const refreshToken = await this.findByToken(token);
    if (!refreshToken) {
      return false;
    }

    return refreshToken.expiresAt > new Date();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `rt-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Convert database row to RefreshToken object
   */
  private rowToRefreshToken(row: RefreshTokenRow): RefreshToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  }
}

/**
 * Database row type
 */
interface RefreshTokenRow {
  id: string;
  user_id: string;
  token: string;
  expires_at: number;
  created_at: number;
}
