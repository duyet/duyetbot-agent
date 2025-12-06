/**
 * No-Op Observability Adapter
 *
 * Discards all observability events without any processing.
 * Useful for testing and environments without D1 database.
 */
/**
 * No-op observability adapter implementation
 */
export class NoOpObservabilityAdapter {
  /**
   * Discard observability event
   *
   * @param _data - Event data (ignored)
   */
  upsertEvent(_data) {
    // No-op
  }
}
