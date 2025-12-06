/**
 * No-Op State Reporter
 *
 * Discards all state reports without any processing.
 * Useful for testing and environments without state Durable Object.
 */
/**
 * No-op state reporter implementation
 */
export class NoOpStateReporter {
  /**
   * Discard batch registration report
   *
   * @param _params - Registration parameters (ignored)
   */
  reportBatchRegistered(_params) {
    // No-op
  }
  /**
   * Discard heartbeat report
   *
   * @param _params - Heartbeat parameters (ignored)
   */
  reportHeartbeat(_params) {
    // No-op
  }
  /**
   * Discard batch completion report
   *
   * @param _params - Completion parameters (ignored)
   */
  reportBatchCompleted(_params) {
    // No-op
  }
}
