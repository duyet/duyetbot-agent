/**
 * State Reporting Adapter Types
 *
 * Provides interface definitions for batch state reporting using Dependency Injection.
 */

/**
 * Response target for state reporting
 */
export type ResponseTarget = {
  platform: string;
  type: string;
  data: Record<string, unknown>;
} | null;

/**
 * Parameters for batch registration
 */
export interface RegisterBatchParams {
  /** Session identifier */
  sessionId: string;

  /** Batch identifier */
  batchId: string;

  /** Platform (telegram, github, api, etc.) */
  platform: string;

  /** User ID on platform */
  userId: string;

  /** Chat/conversation ID on platform */
  chatId: string;

  /** Optional response target for message sending */
  responseTarget?: ResponseTarget;
}

/**
 * Parameters for batch heartbeat
 */
export interface HeartbeatParams {
  /** Session identifier */
  sessionId: string;

  /** Batch identifier */
  batchId: string;
}

/**
 * Parameters for batch completion
 */
export interface CompleteBatchParams {
  /** Session identifier */
  sessionId: string;

  /** Batch identifier */
  batchId: string;

  /** Whether batch completed successfully */
  success: boolean;

  /** Duration in milliseconds */
  durationMs: number;

  /** Optional error message if failed */
  error?: string;
}

/**
 * Interface for state reporting
 *
 * Implementations should use fire-and-forget pattern (async operations that don't block main flow).
 * Errors should be logged but not thrown.
 */
export interface IStateReporter {
  /**
   * Report batch registration
   *
   * Called when a batch starts processing. This is a fire-and-forget operation.
   *
   * @param params - Batch registration parameters
   */
  reportBatchRegistered(params: RegisterBatchParams): void;

  /**
   * Report batch heartbeat
   *
   * Called periodically to indicate batch is still processing. This is a fire-and-forget operation.
   *
   * @param params - Heartbeat parameters
   */
  reportHeartbeat(params: HeartbeatParams): void;

  /**
   * Report batch completion
   *
   * Called when a batch completes (successfully or with error). This is a fire-and-forget operation.
   *
   * @param params - Batch completion parameters
   */
  reportBatchCompleted(params: CompleteBatchParams): void;
}
