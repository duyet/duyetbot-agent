/**
 * D1-backed Observability Adapter
 *
 * Persists observability events to Cloudflare D1 database.
 * Uses fire-and-forget pattern with error logging only.
 */

import { logger } from '@duyetbot/hono-middleware';
import { type D1Database, ObservabilityStorage } from '@duyetbot/observability';
import type { IObservabilityAdapter, ObservabilityEventData } from './types.js';

/**
 * D1 observability adapter implementation
 */
export class D1ObservabilityAdapter implements IObservabilityAdapter {
  private storage: ObservabilityStorage;

  constructor(db: D1Database) {
    this.storage = new ObservabilityStorage(db);
  }

  /**
   * Upsert observability event to D1 (fire-and-forget)
   *
   * @param data - Event data to upsert
   */
  upsertEvent(data: ObservabilityEventData): void {
    void (async () => {
      try {
        await this.storage.upsertEvent({
          eventId: data.eventId,
          ...(data.status !== undefined && { status: data.status }),
          ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
          ...(data.durationMs !== undefined && { durationMs: data.durationMs }),
          ...(data.responseText !== undefined && { responseText: data.responseText }),
          ...(data.errorType !== undefined && { errorType: data.errorType }),
          ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
          ...(data.classification !== undefined && { classification: data.classification }),
          ...(data.agents !== undefined && { agents: data.agents }),
          ...(data.tokenUsage?.inputTokens !== undefined && {
            inputTokens: data.tokenUsage.inputTokens,
          }),
          ...(data.tokenUsage?.outputTokens !== undefined && {
            outputTokens: data.tokenUsage.outputTokens,
          }),
          ...(data.tokenUsage?.totalTokens !== undefined && {
            totalTokens: data.tokenUsage.totalTokens,
          }),
          ...(data.tokenUsage?.cachedTokens !== undefined && {
            cachedTokens: data.tokenUsage.cachedTokens,
          }),
          ...(data.tokenUsage?.reasoningTokens !== undefined && {
            reasoningTokens: data.tokenUsage.reasoningTokens,
          }),
          ...(data.model !== undefined && { model: data.model }),
        });

        logger.debug('[D1ObservabilityAdapter] Event upserted', {
          eventId: data.eventId,
          status: data.status,
        });
      } catch (err) {
        logger.warn('[D1ObservabilityAdapter] Upsert failed', {
          eventId: data.eventId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }
}
