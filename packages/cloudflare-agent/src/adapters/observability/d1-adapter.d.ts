/**
 * D1-backed Observability Adapter
 *
 * Persists observability events to Cloudflare D1 database.
 * Uses fire-and-forget pattern with error logging only.
 */
import { type D1Database } from '@duyetbot/observability';
import type { IObservabilityAdapter, ObservabilityEventData } from './types.js';
/**
 * D1 observability adapter implementation
 */
export declare class D1ObservabilityAdapter implements IObservabilityAdapter {
  private storage;
  constructor(db: D1Database);
  /**
   * Upsert observability event to D1 (fire-and-forget)
   *
   * @param data - Event data to upsert
   */
  upsertEvent(data: ObservabilityEventData): void;
}
//# sourceMappingURL=d1-adapter.d.ts.map
