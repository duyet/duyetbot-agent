import type { Context, MiddlewareHandler } from 'hono';
import { EventCollector } from './collector.js';
import { type D1Database, ObservabilityStorage } from './storage.js';
import type { AppSource } from './types.js';
/**
 * Environment bindings for observability.
 */
export interface ObservabilityEnv {
  OBSERVABILITY_DB?: D1Database;
  OBSERVABILITY_ENABLED?: string;
}
/**
 * Options for the observability middleware.
 */
export interface ObservabilityMiddlewareOptions {
  /** App source identifier */
  appSource: AppSource;
  /** Function to extract event type from context */
  getEventType?: (c: Context) => string;
  /** Whether to log errors (default: true) */
  logErrors?: boolean;
}
declare module 'hono' {
  interface ContextVariableMap {
    observabilityCollector: EventCollector | null;
    observabilityStorage: ObservabilityStorage | null;
  }
}
/**
 * Create an observability middleware for Hono.
 *
 * This middleware:
 * 1. Creates an EventCollector at request start
 * 2. Sets it on context for downstream use
 * 3. Auto-completes the event on response
 * 4. Writes to D1 database
 *
 * Usage:
 * ```ts
 * app.use('*', observabilityMiddleware({
 *   appSource: 'telegram-webhook',
 *   getEventType: (c) => c.req.path.split('/').pop() || 'unknown'
 * }));
 * ```
 */
export declare function observabilityMiddleware<E extends ObservabilityEnv>(
  options: ObservabilityMiddlewareOptions
): MiddlewareHandler<{
  Bindings: E;
}>;
/**
 * Helper to get the collector from Hono context.
 */
export declare function getCollector(c: Context): EventCollector | null;
/**
 * Helper to get the storage from Hono context.
 */
export declare function getStorage(c: Context): ObservabilityStorage | null;
//# sourceMappingURL=middleware.d.ts.map
