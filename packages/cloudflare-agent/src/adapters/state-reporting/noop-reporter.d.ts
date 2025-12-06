/**
 * No-Op State Reporter
 *
 * Discards all state reports without any processing.
 * Useful for testing and environments without state Durable Object.
 */
import type {
  CompleteBatchParams,
  HeartbeatParams,
  IStateReporter,
  RegisterBatchParams,
} from './types.js';
/**
 * No-op state reporter implementation
 */
export declare class NoOpStateReporter implements IStateReporter {
  /**
   * Discard batch registration report
   *
   * @param _params - Registration parameters (ignored)
   */
  reportBatchRegistered(_params: RegisterBatchParams): void;
  /**
   * Discard heartbeat report
   *
   * @param _params - Heartbeat parameters (ignored)
   */
  reportHeartbeat(_params: HeartbeatParams): void;
  /**
   * Discard batch completion report
   *
   * @param _params - Completion parameters (ignored)
   */
  reportBatchCompleted(_params: CompleteBatchParams): void;
}
//# sourceMappingURL=noop-reporter.d.ts.map
