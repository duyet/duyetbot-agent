import { logger } from '@duyetbot/hono-middleware';
import {
  type AgentStep,
  type Classification,
  type D1Database,
  ObservabilityStorage,
} from '@duyetbot/observability';

export interface ObservabilityData {
  status?: 'pending' | 'processing' | 'success' | 'error';
  completedAt?: number;
  durationMs?: number;
  responseText?: string;
  errorType?: string;
  errorMessage?: string;
  classification?: Classification;
  agents?: AgentStep[];
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
}

/**
 * Adapter for upserting observability events to D1.
 * Uses fire-and-forget pattern.
 */
export class ObservabilityAdapter {
  constructor(private db: D1Database | undefined) {}

  /**
   * Upsert observability event on any lifecycle change (fire-and-forget).
   */
  upsertEvent(eventId: string, data: ObservabilityData): void {
    if (!this.db) {
      return;
    }

    const storage = new ObservabilityStorage(this.db);

    void (async () => {
      try {
        await storage.upsertEvent({
          eventId,
          ...data,
        });
        logger.debug('[CloudflareAgent][OBSERVABILITY] Event upserted', {
          eventId,
          status: data.status,
        });
      } catch (err) {
        logger.warn('[CloudflareAgent][OBSERVABILITY] Upsert failed', {
          eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Update multiple events with completion data.
   */
  updateEvents(
    eventIds: string[],
    completion: {
      status: 'success' | 'error';
      durationMs: number;
      responseText?: string;
      errorMessage?: string;
    }
  ): void {
    const completedAt = Date.now();
    for (const eventId of eventIds) {
      this.upsertEvent(eventId, {
        status: completion.status,
        completedAt,
        durationMs: completion.durationMs,
        ...(completion.responseText !== undefined && { responseText: completion.responseText }),
        ...(completion.errorMessage !== undefined && { errorMessage: completion.errorMessage }),
      });
    }
  }
}
