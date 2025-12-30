/**
 * Step Persistence Adapter
 *
 * Persists execution steps and chains to Cloudflare D1 database.
 * Provides storage for execution history with step-by-step tracking.
 *
 * ## SQL Migration
 *
 * Run this migration in your D1 database before using this adapter:
 *
 * ```sql
 * -- Migration: execution_chain_tracking
 * -- Description: Add execution tracking with step-by-step history
 *
 * -- Executions table - stores complete request-response cycles
 * CREATE TABLE IF NOT EXISTS executions (
 *   id TEXT PRIMARY KEY,
 *   session_id TEXT NOT NULL,
 *   started_at INTEGER NOT NULL,
 *   completed_at INTEGER,
 *   status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'error')),
 *   user_message TEXT NOT NULL,
 *   final_response TEXT,
 *   token_usage TEXT,
 *   model TEXT,
 *   duration INTEGER
 * );
 *
 * -- Index for session-based queries (most common)
 * CREATE INDEX IF NOT EXISTS idx_executions_session
 *   ON executions(session_id, started_at DESC);
 *
 * -- Index for status filtering
 * CREATE INDEX IF NOT EXISTS idx_executions_status
 *   ON executions(status, started_at DESC);
 *
 * -- Execution steps table - stores individual execution steps
 * CREATE TABLE IF NOT EXISTS execution_steps (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   execution_id TEXT NOT NULL,
 *   step_type TEXT NOT NULL,
 *   step_data TEXT NOT NULL,
 *   timestamp INTEGER NOT NULL,
 *   FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
 * );
 *
 * -- Index for fetching steps by execution (primary query pattern)
 * CREATE INDEX IF NOT EXISTS idx_execution_steps_execution
 *   ON execution_steps(execution_id, timestamp ASC);
 *
 * -- Index for step type filtering
 * CREATE INDEX IF NOT EXISTS idx_execution_steps_type
 *   ON execution_steps(step_type, timestamp DESC);
 * ```
 *
 * Usage:
 * ```typescript
 * const adapter = new StepPersistenceAdapter({ db });
 * await adapter.createExecution(sessionId, executionId, userMessage);
 * await adapter.persistStep(sessionId, executionId, step);
 * await adapter.completeExecution(sessionId, executionId, summary);
 * ```
 */

import { logger } from '@duyetbot/hono-middleware';
import type { D1Database } from '@duyetbot/observability';
import type {
  ExecutionChain,
  ExecutionStep,
  ExecutionStepWithTimestamp,
  ExecutionSummary,
} from '../types.js';

/**
 * Configuration for StepPersistenceAdapter
 */
export interface StepPersistenceConfig {
  /** Cloudflare D1 database binding */
  db: D1Database;
}

/**
 * Interface for step persistence operations
 * Use this for dependency injection and mocking
 */
export interface IStepPersistence {
  createExecution(sessionId: string, executionId: string, userMessage: string): Promise<void>;
  persistStep(
    sessionId: string,
    executionId: string,
    step: ExecutionStepWithTimestamp
  ): Promise<void>;
  completeExecution(
    sessionId: string,
    executionId: string,
    summary: ExecutionSummary
  ): Promise<void>;
  failExecution(sessionId: string, executionId: string, errorMessage: string): Promise<void>;
  getExecution(sessionId: string, executionId: string): Promise<ExecutionChain | null>;
  listExecutions(sessionId: string, limit?: number): Promise<ExecutionChain[]>;
}

/**
 * Type for D1 execution result
 */
type D1ExecutionResult = {
  id: string;
  session_id: string;
  started_at: number;
  completed_at: number | null;
  status: string;
  user_message: string;
  final_response: string | null;
  token_usage: string | null;
  model: string | null;
  duration: number | null;
};

/**
 * Type for D1 step result
 */
type D1StepResult = {
  step_data: string;
  timestamp: number;
};

/**
 * Adapter for persisting execution steps and chains to D1
 */
export class StepPersistenceAdapter implements IStepPersistence {
  constructor(private config: StepPersistenceConfig) {}

  /**
   * Create a new execution record
   *
   * @param sessionId - Session identifier
   * @param executionId - Unique execution identifier (UUID)
   * @param userMessage - Original user message that triggered execution
   */
  async createExecution(
    sessionId: string,
    executionId: string,
    userMessage: string
  ): Promise<void> {
    const { db } = this.config;

    try {
      const now = Date.now();

      await db
        .prepare(
          `INSERT INTO executions (id, session_id, started_at, status, user_message)
           VALUES (?, ?, ?, 'running', ?)`
        )
        .bind(executionId, sessionId, now, userMessage)
        .run();

      logger.debug('[StepPersistenceAdapter] Execution created', {
        sessionId,
        executionId,
      });
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to create execution', {
        sessionId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the step type from an ExecutionStep
   * ExecutionStep is a discriminated union, so we extract the type property
   */
  private getStepType(step: ExecutionStepWithTimestamp): ExecutionStep['type'] {
    return step.type;
  }

  /**
   * Persist a single execution step
   *
   * @param sessionId - Session identifier
   * @param executionId - Unique execution identifier
   * @param step - Execution step with timestamp
   */
  async persistStep(
    sessionId: string,
    executionId: string,
    step: ExecutionStepWithTimestamp
  ): Promise<void> {
    const { db } = this.config;

    try {
      const stepData = JSON.stringify(step);
      const stepType = this.getStepType(step);

      await db
        .prepare(
          `INSERT INTO execution_steps (execution_id, step_type, step_data, timestamp)
           VALUES (?, ?, ?, ?)`
        )
        .bind(executionId, stepType, stepData, step.timestamp)
        .run();

      logger.debug('[StepPersistenceAdapter] Step persisted', {
        sessionId,
        executionId,
        stepType,
      });
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to persist step', {
        sessionId,
        executionId,
        stepType: this.getStepType(step),
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - step persistence failures shouldn't block execution
    }
  }

  /**
   * Mark execution as completed with summary data
   *
   * @param sessionId - Session identifier
   * @param executionId - Unique execution identifier
   * @param summary - Execution summary with final results
   */
  async completeExecution(
    sessionId: string,
    executionId: string,
    summary: ExecutionSummary
  ): Promise<void> {
    const { db } = this.config;

    try {
      const completedAt = Date.now();
      const tokenUsageJson = JSON.stringify(summary.tokenUsage);

      await db
        .prepare(
          `UPDATE executions
           SET completed_at = ?,
               status = 'completed',
               final_response = ?,
               token_usage = ?,
               model = ?,
               duration = ?
           WHERE id = ?`
        )
        .bind(
          completedAt,
          summary.finalResponse,
          tokenUsageJson,
          summary.model ?? null,
          summary.duration,
          executionId
        )
        .run();

      logger.debug('[StepPersistenceAdapter] Execution completed', {
        sessionId,
        executionId,
        duration: summary.duration,
      });
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to complete execution', {
        sessionId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Mark execution as errored
   *
   * @param sessionId - Session identifier
   * @param executionId - Unique execution identifier
   * @param errorMessage - Error message describing the failure
   */
  async failExecution(sessionId: string, executionId: string, errorMessage: string): Promise<void> {
    const { db } = this.config;

    try {
      const completedAt = Date.now();

      await db
        .prepare(
          `UPDATE executions
           SET completed_at = ?,
               status = 'error',
               final_response = ?
           WHERE id = ?`
        )
        .bind(completedAt, `Error: ${errorMessage}`, executionId)
        .run();

      logger.debug('[StepPersistenceAdapter] Execution marked as error', {
        sessionId,
        executionId,
        error: errorMessage,
      });
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to mark execution as error', {
        sessionId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a complete execution chain with all steps
   *
   * @param sessionId - Session identifier
   * @param executionId - Unique execution identifier
   * @returns Execution chain with steps, or null if not found
   */
  async getExecution(sessionId: string, executionId: string): Promise<ExecutionChain | null> {
    const { db } = this.config;

    try {
      // Get execution record
      const execResult = (await db
        .prepare(
          `SELECT id, session_id, started_at, completed_at, status,
                  user_message, final_response, token_usage, model, duration
           FROM executions
           WHERE id = ? AND session_id = ?`
        )
        .bind(executionId, sessionId)
        .first()) as D1ExecutionResult | null;

      if (!execResult) {
        return null;
      }

      // Get all steps for this execution
      const stepsResult = await db
        .prepare(
          `SELECT step_data, timestamp
           FROM execution_steps
           WHERE execution_id = ?
           ORDER BY timestamp ASC`
        )
        .bind(executionId)
        .all();

      const steps: ExecutionStepWithTimestamp[] = (stepsResult.results || []).map(
        (row: unknown) => {
          const r = row as D1StepResult;
          return JSON.parse(r.step_data) as ExecutionStepWithTimestamp;
        }
      );

      // Parse token usage if present
      const tokenUsage = execResult.token_usage
        ? (JSON.parse(execResult.token_usage) as ExecutionChain['tokenUsage'])
        : undefined;

      // Build execution chain with exactOptionalPropertyTypes compliance
      const chain: ExecutionChain = {
        id: execResult.id,
        executionId: execResult.id,
        sessionId: execResult.session_id,
        startedAt: execResult.started_at,
        status: execResult.status as ExecutionChain['status'],
        userMessage: execResult.user_message,
        finalResponse: execResult.final_response ?? '',
        steps,
      };

      // Only add optional properties if defined
      if (execResult.completed_at !== null) {
        chain.completedAt = execResult.completed_at;
      }
      if (execResult.final_response !== null) {
        chain.finalResponse = execResult.final_response;
      }
      if (tokenUsage !== undefined) {
        chain.tokenUsage = tokenUsage;
      }
      if (execResult.model !== null) {
        chain.model = execResult.model;
      }
      if (execResult.duration !== null) {
        chain.duration = execResult.duration;
      }

      return chain;
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to get execution', {
        sessionId,
        executionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * List executions for a session, most recent first
   *
   * @param sessionId - Session identifier
   * @param limit - Maximum number of executions to return (default: 50)
   * @returns Array of execution chains
   */
  async listExecutions(sessionId: string, limit: number = 50): Promise<ExecutionChain[]> {
    const { db } = this.config;

    try {
      const executionsResult = await db
        .prepare(
          `SELECT id, session_id, started_at, completed_at, status,
                  user_message, final_response, token_usage, model, duration
           FROM executions
           WHERE session_id = ?
           ORDER BY started_at DESC
           LIMIT ?`
        )
        .bind(sessionId, limit)
        .all();

      const execRows = (executionsResult.results || []) as D1ExecutionResult[];
      const executions: ExecutionChain[] = [];

      for (const exec of execRows) {
        // Get steps for this execution
        const stepsResult = await db
          .prepare(
            `SELECT step_data, timestamp
             FROM execution_steps
             WHERE execution_id = ?
             ORDER BY timestamp ASC`
          )
          .bind(exec.id)
          .all();

        const steps: ExecutionStepWithTimestamp[] = (stepsResult.results || []).map(
          (r: unknown) => {
            const stepRow = r as D1StepResult;
            return JSON.parse(stepRow.step_data) as ExecutionStepWithTimestamp;
          }
        );

        const tokenUsage = exec.token_usage
          ? (JSON.parse(exec.token_usage) as ExecutionChain['tokenUsage'])
          : undefined;

        // Build execution chain with exactOptionalPropertyTypes compliance
        const chain: ExecutionChain = {
          id: exec.id,
          executionId: exec.id,
          sessionId: exec.session_id,
          startedAt: exec.started_at,
          status: exec.status as ExecutionChain['status'],
          userMessage: exec.user_message,
          finalResponse: exec.final_response ?? '',
          steps,
        };

        // Only add optional properties if defined
        if (exec.completed_at !== null) {
          chain.completedAt = exec.completed_at;
        }
        if (exec.final_response !== null) {
          chain.finalResponse = exec.final_response;
        }
        if (tokenUsage !== undefined) {
          chain.tokenUsage = tokenUsage;
        }
        if (exec.model !== null) {
          chain.model = exec.model;
        }
        if (exec.duration !== null) {
          chain.duration = exec.duration;
        }

        executions.push(chain);
      }

      return executions;
    } catch (error) {
      logger.warn('[StepPersistenceAdapter] Failed to list executions', {
        sessionId,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

/**
 * In-memory implementation for testing
 */
export class MemoryStepPersistence implements IStepPersistence {
  private executions = new Map<string, ExecutionChain>();
  private stepsByExecution = new Map<string, ExecutionStepWithTimestamp[]>();

  async createExecution(
    sessionId: string,
    executionId: string,
    userMessage: string
  ): Promise<void> {
    const chain: ExecutionChain = {
      id: executionId,
      executionId,
      sessionId,
      startedAt: Date.now(),
      status: 'running',
      userMessage,
      finalResponse: '',
      steps: [],
    };
    this.executions.set(executionId, chain);
    this.stepsByExecution.set(executionId, []);
  }

  async persistStep(
    _sessionId: string,
    executionId: string,
    step: ExecutionStepWithTimestamp
  ): Promise<void> {
    const steps = this.stepsByExecution.get(executionId);
    if (steps) {
      steps.push(step);
    }
  }

  async completeExecution(
    _sessionId: string,
    executionId: string,
    summary: ExecutionSummary
  ): Promise<void> {
    const chain = this.executions.get(executionId);
    if (chain) {
      chain.completedAt = Date.now();
      chain.status = 'completed';
      chain.finalResponse = summary.finalResponse;
      chain.tokenUsage = summary.tokenUsage;
      chain.duration = summary.duration;
      // Only set model if defined (exactOptionalPropertyTypes compliance)
      if (summary.model !== undefined) {
        chain.model = summary.model;
      }
      chain.steps = this.stepsByExecution.get(executionId) ?? [];
    }
  }

  async failExecution(
    _sessionId: string,
    executionId: string,
    errorMessage: string
  ): Promise<void> {
    const chain = this.executions.get(executionId);
    if (chain) {
      chain.completedAt = Date.now();
      chain.status = 'error';
      chain.finalResponse = `Error: ${errorMessage}`;
    }
  }

  async getExecution(_sessionId: string, executionId: string): Promise<ExecutionChain | null> {
    return this.executions.get(executionId) ?? null;
  }

  async listExecutions(sessionId: string, limit: number = 50): Promise<ExecutionChain[]> {
    return Array.from(this.executions.values())
      .filter((e) => e.sessionId === sessionId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }
}
