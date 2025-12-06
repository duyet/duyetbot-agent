/**
 * No-Op Observability Adapter
 *
 * Discards all observability events without any processing.
 * Useful for testing and environments without D1 database.
 */

import type { IObservabilityAdapter, ObservabilityEventData } from './types.js';

/**
 * No-op observability adapter implementation
 */
export class NoOpObservabilityAdapter implements IObservabilityAdapter {
  /**
   * Discard observability event
   *
   * @param _data - Event data (ignored)
   */
  upsertEvent(_data: ObservabilityEventData): void {
    // No-op
  }
}
