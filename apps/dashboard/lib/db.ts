/**
 * Database Connection Helper
 * Provides initialized storage classes bound to D1 database
 */

import {
  AgentStepStorage,
  AggregateStorage,
  AnalyticsMessageStorage,
  ConversationStorage,
  CostConfigStorage,
} from '@duyetbot/analytics';

// D1Database interface for Cloudflare Workers D1
// This mirrors the Cloudflare Workers D1 database interface
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    served_by: string;
  };
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  dump(): Promise<ArrayBuffer>;
}

export interface Env {
  DB: D1Database;
}

export function getDB(env: Env) {
  return {
    messages: new AnalyticsMessageStorage(env.DB),
    steps: new AgentStepStorage(env.DB),
    aggregates: new AggregateStorage(env.DB),
    conversations: new ConversationStorage(env.DB),
    costs: new CostConfigStorage(env.DB),
  };
}

export type DB = ReturnType<typeof getDB>;
