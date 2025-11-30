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

// Extend Hono context to include observability
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
export function observabilityMiddleware<E extends ObservabilityEnv>(
  options: ObservabilityMiddlewareOptions
): MiddlewareHandler<{ Bindings: E }> {
  return async (c, next) => {
    const db = c.env.OBSERVABILITY_DB;
    const enabled = c.env.OBSERVABILITY_ENABLED !== 'false';

    // Skip if disabled or no DB
    if (!enabled || !db) {
      c.set('observabilityCollector', null);
      c.set('observabilityStorage', null);
      return next();
    }

    const storage = new ObservabilityStorage(db);
    const eventId = crypto.randomUUID();
    const startTime = Date.now();
    const eventType = options.getEventType?.(c) ?? 'unknown';

    const collector = new EventCollector({
      eventId,
      appSource: options.appSource,
      eventType,
      triggeredAt: startTime,
      requestId: eventId.slice(0, 8), // Short request ID
    });

    collector.markProcessing();

    // Set on context for downstream handlers
    c.set('observabilityCollector', collector);
    c.set('observabilityStorage', storage);

    try {
      await next();

      // Auto-complete if not already completed
      if (!collector.isCompleted()) {
        const status = c.res.status < 400 ? 'success' : 'error';
        collector.complete({ status });
      }
    } catch (error) {
      // Complete with error
      collector.complete({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });

      if (options.logErrors !== false) {
        console.error(
          `[observability] Request ${eventId} failed:`,
          error instanceof Error ? error.message : error
        );
      }

      throw error;
    } finally {
      // Write event to database (fire-and-forget)
      try {
        await storage.writeEvent(collector.toEvent());
      } catch (writeError) {
        console.error(
          `[observability] Failed to write event ${eventId}:`,
          writeError instanceof Error ? writeError.message : writeError
        );
      }
    }
  };
}

/**
 * Helper to get the collector from Hono context.
 */
export function getCollector(c: Context): EventCollector | null {
  return c.get('observabilityCollector') ?? null;
}

/**
 * Helper to get the storage from Hono context.
 */
export function getStorage(c: Context): ObservabilityStorage | null {
  return c.get('observabilityStorage') ?? null;
}
