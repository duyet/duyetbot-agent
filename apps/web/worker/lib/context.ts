/**
 * Worker context utilities
 * Creates database client and provides helper functions
 */

import { createDb } from "../../lib/db";

/**
 * Get database instance from context
 */
export function getDb(c: { env: { DB: D1Database } }) {
  return createDb(c.env.DB);
}

/**
 * Create context helper - attaches db to context
 */
export async function createContext(c: any, next: any) {
  c.set("db", createDb(c.env.DB));
  await next();
}
