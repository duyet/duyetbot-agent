import { logger } from '@duyetbot/hono-middleware';
import type { Agent, AgentNamespace } from 'agents';
import type { CloudflareEnv } from '../core/types.js';
import type {
  CompleteBatchParams,
  HeartbeatParams,
  RegisterBatchParams,
} from './state-reporting/index.js';

/**
 * Adapter for reporting state to the centralized State Durable Object.
 * Uses a fire-and-forget pattern to avoid blocking the main agent flow.
 */
export class StateDOReporter<TEnv extends CloudflareEnv> {
  constructor(private getEnv: () => TEnv) {}

  /**
   * Get the State DO stub from the environment
   */
  private getStateDOStub(): {
    registerBatch: (p: RegisterBatchParams) => Promise<void>;
    heartbeat: (p: HeartbeatParams) => Promise<void>;
    completeBatch: (p: CompleteBatchParams) => Promise<void>;
  } | null {
    const env = this.getEnv();
    // NOTE: Legacy code using deleted RouterAgentEnv
    const envWithState = env as unknown as {
      StateDO?: AgentNamespace<Agent<CloudflareEnv, unknown>>;
    };

    if (!envWithState.StateDO) {
      return null;
    }

    // Use a single global instance for State DO
    const id = envWithState.StateDO.idFromName('global');
    return envWithState.StateDO.get(id) as unknown as {
      registerBatch: (p: RegisterBatchParams) => Promise<void>;
      heartbeat: (p: HeartbeatParams) => Promise<void>;
      completeBatch: (p: CompleteBatchParams) => Promise<void>;
    };
  }

  /**
   * Report to State DO (fire-and-forget pattern)
   * Does not block on errors - State DO reporting is non-critical
   */
  reportToStateDO(
    method: 'registerBatch' | 'heartbeat' | 'completeBatch',
    params: RegisterBatchParams | HeartbeatParams | CompleteBatchParams
  ): void {
    try {
      const stateDO = this.getStateDOStub();
      if (!stateDO) {
        return;
      }

      // Fire-and-forget: don't await, catch any errors
      void (async () => {
        try {
          if (method === 'registerBatch') {
            await stateDO.registerBatch(params as RegisterBatchParams);
          } else if (method === 'heartbeat') {
            await stateDO.heartbeat(params as HeartbeatParams);
          } else if (method === 'completeBatch') {
            await stateDO.completeBatch(params as CompleteBatchParams);
          }
        } catch (err) {
          logger.warn(`[CloudflareAgent][StateDO] ${method} failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      })();
    } catch (err) {
      logger.warn('[CloudflareAgent][StateDO] Report failed', {
        method,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
