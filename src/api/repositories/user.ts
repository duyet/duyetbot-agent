/**
 * User Repository
 *
 * Database operations for user management with D1
 */

import type { CreateUserInput, OAuthProvider, UpdateUserInput, User, UserSettings } from '../types';

/**
 * User repository for D1 database operations
 */
export class UserRepository {
  constructor(private db: D1Database) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<UserRow>();

    return result ? this.rowToUser(result) : null;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE email = ?')
      .bind(email)
      .first<UserRow>();

    return result ? this.rowToUser(result) : null;
  }

  /**
   * Find user by provider and provider ID
   */
  async findByProvider(provider: OAuthProvider, providerId: string): Promise<User | null> {
    const result = await this.db
      .prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?')
      .bind(provider, providerId)
      .first<UserRow>();

    return result ? this.rowToUser(result) : null;
  }

  /**
   * Create new user
   */
  async create(input: CreateUserInput): Promise<User> {
    const id = this.generateId();
    const now = Date.now();

    const settingsJson = input.settings ? JSON.stringify(input.settings) : null;

    await this.db
      .prepare(
        `INSERT INTO users (id, email, name, picture, provider, provider_id, created_at, updated_at, settings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.email,
        input.name,
        input.picture,
        input.provider,
        input.providerId,
        now,
        now,
        settingsJson
      )
      .run();

    const user = await this.findById(id);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  /**
   * Update user
   */
  async update(id: string, input: UpdateUserInput): Promise<User> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new UserRepositoryError('User not found', 'USER_NOT_FOUND');
    }

    const now = Date.now();
    const updates: string[] = [];
    const values: unknown[] = [];

    if ('name' in input) {
      updates.push('name = ?');
      values.push(input.name);
    }

    if ('picture' in input) {
      updates.push('picture = ?');
      values.push(input.picture);
    }

    if (input.settings !== undefined) {
      const mergedSettings = {
        ...existing.settings,
        ...input.settings,
      };
      updates.push('settings = ?');
      values.push(JSON.stringify(mergedSettings));
    }

    if (updates.length === 0) {
      return existing; // No changes
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id); // For WHERE clause

    await this.db
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update user');
    }

    return updated;
  }

  /**
   * Delete user (GDPR compliance)
   */
  async delete(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  }

  /**
   * Find or create user (upsert pattern for OAuth)
   */
  async findOrCreate(
    provider: OAuthProvider,
    providerId: string,
    profile: { email: string; name: string | null; picture: string | null }
  ): Promise<User> {
    // Try to find existing user
    const existing = await this.findByProvider(provider, providerId);
    if (existing) {
      // Update profile if changed
      if (
        existing.name !== profile.name ||
        existing.picture !== profile.picture ||
        existing.email !== profile.email
      ) {
        return this.update(existing.id, {
          name: profile.name,
          picture: profile.picture,
        });
      }
      return existing;
    }

    // Create new user
    return this.create({
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      provider,
      providerId,
    });
  }

  /**
   * Generate unique user ID
   */
  private generateId(): string {
    return `user-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Convert database row to User object
   */
  private rowToUser(row: UserRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      picture: row.picture,
      provider: row.provider as OAuthProvider,
      providerId: row.provider_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      settings: row.settings ? (JSON.parse(row.settings) as UserSettings) : undefined,
    };
  }
}

/**
 * Database row type
 */
interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  provider: string;
  provider_id: string;
  created_at: number;
  updated_at: number;
  settings: string | null;
}

/**
 * User repository error
 */
export class UserRepositoryError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'UserRepositoryError';
  }
}
