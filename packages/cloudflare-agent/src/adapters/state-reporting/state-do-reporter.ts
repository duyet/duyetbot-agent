/**
 * Durable Object State Reporter
 *
 * Reports batch state changes to a state Durable Object for cross-session coordination.
 * Uses fire-and-forget pattern with error logging only.
 */

import { logger } from '@duyetbot/hono-middleware';
import type {
  CompleteBatchParams,
  HeartbeatParams,
  IStateReporter,
  RegisterBatchParams,
} from './types.js';

/**
 * Interface for state Durable Object stub
 */
interface StateDOStub {
  registerBatch(params: RegisterBatchParams): Promise<void>;
  heartbeat(params: HeartbeatParams): Promise<void>;
  completeBatch(params: CompleteBatchParams): Promise<void>;
}

/**
 * State Durable Object reporter implementation
 */
export class StateDOReporter implements IStateReporter {
  constructor(private stub: StateDOStub) {}

  /**
   * Report batch registration to state DO (fire-and-forget)
   *
   * @param params - Batch registration parameters
   */
  reportBatchRegistered(params: RegisterBatchParams): void {
    void (async () => {
      try {
        await this.stub.registerBatch(params);
        logger.debug('[StateDOReporter] Batch registered', {
          sessionId: params.sessionId,
          batchId: params.batchId,
        });
      } catch (err) {
        logger.warn('[StateDOReporter] Failed to register batch', {
          sessionId: params.sessionId,
          batchId: params.batchId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Report batch heartbeat to state DO (fire-and-forget)
   *
   * @param params - Heartbeat parameters
   */
  reportHeartbeat(params: HeartbeatParams): void {
    void (async () => {
      try {
        await this.stub.heartbeat(params);
        logger.debug('[StateDOReporter] Heartbeat sent', {
          sessionId: params.sessionId,
          batchId: params.batchId,
        });
      } catch (err) {
        logger.warn('[StateDOReporter] Failed to send heartbeat', {
          sessionId: params.sessionId,
          batchId: params.batchId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Report batch completion to state DO (fire-and-forget)
   *
   * @param params - Batch completion parameters
   */
  reportBatchCompleted(params: CompleteBatchParams): void {
    void (async () => {
      try {
        await this.stub.completeBatch(params);
        logger.debug('[StateDOReporter] Batch completed', {
          sessionId: params.sessionId,
          batchId: params.batchId,
          success: params.success,
          durationMs: params.durationMs,
        });
      } catch (err) {
        logger.warn('[StateDOReporter] Failed to report batch completion', {
          sessionId: params.sessionId,
          batchId: params.batchId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }
}
