/**
 * Durable Object State Reporter
 *
 * Reports batch state changes to a state Durable Object for cross-session coordination.
 * Uses fire-and-forget pattern with error logging only.
 */
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
export declare class StateDOReporter implements IStateReporter {
  private stub;
  constructor(stub: StateDOStub);
  /**
   * Report batch registration to state DO (fire-and-forget)
   *
   * @param params - Batch registration parameters
   */
  reportBatchRegistered(params: RegisterBatchParams): void;
  /**
   * Report batch heartbeat to state DO (fire-and-forget)
   *
   * @param params - Heartbeat parameters
   */
  reportHeartbeat(params: HeartbeatParams): void;
  /**
   * Report batch completion to state DO (fire-and-forget)
   *
   * @param params - Batch completion parameters
   */
  reportBatchCompleted(params: CompleteBatchParams): void;
}
//# sourceMappingURL=state-do-reporter.d.ts.map
