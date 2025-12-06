/**
 * Utility for detecting and handling stuck batch states
 *
 * Implements heartbeat-based detection to identify batches that appear to be
 * hung or stuck during processing. Used to prevent stuck batches from blocking
 * future message processing.
 */
import { type BatchState } from './types.js';
/**
 * Utility for detecting stuck batches based on heartbeat timestamps
 *
 * A batch is considered stuck if:
 * - Status is 'processing' AND
 * - Last heartbeat was more than maxHeartbeatAgeMs ago (default: 20s)
 *
 * This is commonly used to detect:
 * - LLM API calls that hang indefinitely
 * - Cloudflare DO worker crashes during processing
 * - Network timeouts on backend calls
 *
 * @example
 * ```typescript
 * const detector = new StuckDetector(30000); // 30s threshold
 *
 * if (detector.isStuck(activeBatch)) {
 *   logger.warn('Batch is stuck, clearing to allow new processing');
 *   clearActiveBatch();
 * }
 * ```
 */
export declare class StuckDetector {
  private heartbeatThresholdMs;
  /**
   * Create a StuckDetector instance
   *
   * @param heartbeatThresholdMs - Max time since last heartbeat before stuck (ms)
   *                               Default: 20000 (20 seconds)
   */
  constructor(heartbeatThresholdMs?: number);
  /**
   * Check if a batch is stuck based on heartbeat timeout
   *
   * @param batch - Batch state to check (undefined returns false)
   * @returns True if batch is stuck and processing
   */
  isStuck(batch: BatchState | undefined): boolean;
  /**
   * Get the stuck duration in milliseconds if batch is stuck
   *
   * @param batch - Batch state to check
   * @returns Duration in ms since last heartbeat, or null if not stuck
   */
  getStuckDuration(batch: BatchState | undefined): number | null;
  /**
   * Perform full stuck detection check
   *
   * @param batch - Batch state to check
   * @returns StuckCheckResult with isStuck flag and optional reason
   * @internal
   */
  private check;
}
//# sourceMappingURL=stuck-detector.d.ts.map
