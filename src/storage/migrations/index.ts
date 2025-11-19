/**
 * D1 Migration Runner
 *
 * Manages database schema migrations for Cloudflare D1
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Migration, MigrationFile, MigrationResult, MigrationRunner } from './types';

export class D1MigrationRunner implements MigrationRunner {
  private migrations: MigrationFile[] = [];

  constructor(private db: D1Database) {
    this.loadMigrations();
  }

  /**
   * Load migration files
   */
  private loadMigrations(): void {
    // Migration files are embedded at build time
    // In production, these would be loaded from the migrations directory
    this.migrations = [
      {
        id: 1,
        name: '001_initial_schema',
        up: this.loadMigrationFile('001_initial_schema.sql'),
      },
      {
        id: 2,
        name: '002_add_indexes',
        up: this.loadMigrationFile('002_add_indexes.sql'),
      },
    ];
  }

  /**
   * Load migration file content
   * Note: In production, this would read from filesystem or embed at build time
   */
  private loadMigrationFile(filename: string): string {
    // For now, return placeholder
    // In production build, these files would be embedded using esbuild or similar
    return `-- Migration: ${filename}`;
  }

  /**
   * Initialize migrations table
   */
  private async initMigrationsTable(): Promise<void> {
    await this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          executed_at INTEGER NOT NULL
        )`
      )
      .run();
  }

  /**
   * Get list of executed migrations
   */
  async getExecuted(): Promise<Migration[]> {
    await this.initMigrationsTable();

    const result = await this.db.prepare('SELECT * FROM migrations ORDER BY id ASC').all();

    return (result.results || []).map((row: unknown) => {
      const migrationRow = row as { id: number; name: string; executed_at: number };
      return {
        id: migrationRow.id,
        name: migrationRow.name,
        executed_at: migrationRow.executed_at,
      };
    });
  }

  /**
   * Get list of pending migrations
   */
  async getPending(): Promise<MigrationFile[]> {
    const executed = await this.getExecuted();
    const executedIds = new Set(executed.map((m) => m.id));

    return this.migrations.filter((m) => !executedIds.has(m.id));
  }

  /**
   * Run all pending migrations
   */
  async up(): Promise<MigrationResult[]> {
    const pending = await this.getPending();
    const results: MigrationResult[] = [];

    for (const migration of pending) {
      try {
        // Execute migration SQL
        await this.executeMigration(migration.up);

        // Record migration
        await this.db
          .prepare('INSERT INTO migrations (id, name, executed_at) VALUES (?, ?, ?)')
          .bind(migration.id, migration.name, Date.now())
          .run();

        results.push({
          id: migration.id,
          name: migration.name,
          status: 'success',
          executedAt: new Date(),
        });
      } catch (error) {
        results.push({
          id: migration.id,
          name: migration.name,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          executedAt: new Date(),
        });
        // Stop on first error
        break;
      }
    }

    return results;
  }

  /**
   * Rollback the last migration
   */
  async down(): Promise<MigrationResult> {
    const executed = await this.getExecuted();
    if (executed.length === 0) {
      throw new Error('No migrations to rollback');
    }

    const lastMigration = executed[executed.length - 1]!;
    const migrationFile = this.migrations.find((m) => m.id === lastMigration.id);

    if (!migrationFile) {
      throw new Error(`Migration file not found: ${lastMigration.name}`);
    }

    if (!migrationFile.down) {
      throw new Error(`No down migration for: ${lastMigration.name}`);
    }

    try {
      // Execute down migration
      await this.executeMigration(migrationFile.down);

      // Remove migration record
      await this.db.prepare('DELETE FROM migrations WHERE id = ?').bind(lastMigration.id).run();

      return {
        id: lastMigration.id,
        name: lastMigration.name,
        status: 'success',
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        id: lastMigration.id,
        name: lastMigration.name,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        executedAt: new Date(),
      };
    }
  }

  /**
   * Execute migration SQL (supports multiple statements)
   */
  private async executeMigration(sql: string): Promise<void> {
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      await this.db.prepare(statement).run();
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    executed: number;
    pending: number;
    migrations: Array<{
      id: number;
      name: string;
      status: 'executed' | 'pending';
    }>;
  }> {
    const executed = await this.getExecuted();
    const pending = await this.getPending();
    const executedIds = new Set(executed.map((m) => m.id));

    const migrations = this.migrations.map((m) => ({
      id: m.id,
      name: m.name,
      status: executedIds.has(m.id) ? ('executed' as const) : ('pending' as const),
    }));

    return {
      executed: executed.length,
      pending: pending.length,
      migrations,
    };
  }
}

/**
 * Create migration runner
 */
export function createMigrationRunner(db: D1Database): MigrationRunner {
  return new D1MigrationRunner(db);
}

export * from './types';
