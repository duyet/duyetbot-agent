/**
 * Database Migration Types
 */

export interface Migration {
  id: number;
  name: string;
  executed_at: number;
}

export interface MigrationFile {
  id: number;
  name: string;
  up: string;
  down?: string;
}

export interface MigrationResult {
  id: number;
  name: string;
  status: 'success' | 'failed';
  error?: string;
  executedAt: Date;
}

export interface MigrationRunner {
  /**
   * Run all pending migrations
   */
  up(): Promise<MigrationResult[]>;

  /**
   * Rollback the last migration
   */
  down(): Promise<MigrationResult>;

  /**
   * Get list of executed migrations
   */
  getExecuted(): Promise<Migration[]>;

  /**
   * Get list of pending migrations
   */
  getPending(): Promise<MigrationFile[]>;
}
