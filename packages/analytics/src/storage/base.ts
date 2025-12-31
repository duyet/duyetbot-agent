/**
 * Base storage class for D1 database operations
 */

/**
 * D1 database interface (subset)
 */
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: {
    duration: number;
    changes: number;
    last_row_id: number;
  };
}

export class BaseStorage {
  protected db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Execute a prepared statement
   */
  protected async prepare<T>(sql: string, params?: unknown[]): Promise<D1Result<T>> {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return stmt.bind(...params).all<T>();
    }
    return stmt.all<T>();
  }

  /**
   * Execute and get first result
   */
  protected async first<T>(sql: string, params?: unknown[]): Promise<T | undefined> {
    const result = await this.prepare<T>(sql, params);
    return result.results?.[0];
  }

  /**
   * Execute and get all results
   */
  protected async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.prepare<T>(sql, params);
    return result.results || [];
  }

  /**
   * Execute a mutation (INSERT, UPDATE, DELETE)
   */
  protected async run(sql: string, params?: unknown[]): Promise<D1Result> {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return stmt.bind(...params).run();
    }
    return stmt.run();
  }
}
