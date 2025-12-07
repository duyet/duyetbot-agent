/**
 * Agent Step Storage
 */

import type { AnalyticsAgentStep, StepCompletion, StepCreateInput, StepQueryFilter } from '../types.js';
import { BaseStorage } from './base.js';

export class AgentStepStorage extends BaseStorage {
  async create(input: StepCreateInput): Promise<AnalyticsAgentStep> {
    const stepId = crypto.randomUUID();
    const now = Date.now();

    const step = await this.first<AnalyticsAgentStep>(
      `INSERT INTO analytics_agent_steps (
        step_id, event_id, message_id, parent_step_id, agent_name, agent_type, sequence,
        started_at, completed_at, duration_ms, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *`,
      [
        stepId,
        input.eventId,
        input.messageId,
        input.parentStepId,
        input.agentName,
        input.agentType,
        input.sequence,
        now,
        0,
        0,
        'pending',
        now,
      ]
    );

    if (!step) throw new Error('Failed to create agent step');
    return step;
  }

  async getById(stepId: string): Promise<AnalyticsAgentStep | undefined> {
    return this.first<AnalyticsAgentStep>(
      'SELECT * FROM analytics_agent_steps WHERE step_id = ? LIMIT 1',
      [stepId]
    );
  }

  async getByEvent(eventId: string): Promise<AnalyticsAgentStep[]> {
    return this.all<AnalyticsAgentStep>(
      'SELECT * FROM analytics_agent_steps WHERE event_id = ? ORDER BY sequence ASC',
      [eventId]
    );
  }

  async complete(
    stepId: string,
    completion: StepCompletion
  ): Promise<AnalyticsAgentStep | undefined> {
    const now = Date.now();
    const startResult = await this.first<{ startedAt: number }>(
      'SELECT started_at FROM analytics_agent_steps WHERE step_id = ?',
      [stepId]
    );

    if (!startResult) return undefined;

    const durationMs = now - startResult.startedAt;

    return this.first<AnalyticsAgentStep>(
      `UPDATE analytics_agent_steps
       SET status = ?, completed_at = ?, duration_ms = ?, input_tokens = ?, output_tokens = ?, 
           cached_tokens = ?, reasoning_tokens = ?, model = ?, tools_used = ?, tool_calls_count = ?,
           error_type = ?, error_message = ?
       WHERE step_id = ? RETURNING *`,
      [
        completion.status,
        now,
        durationMs,
        completion.inputTokens,
        completion.outputTokens,
        completion.cachedTokens || 0,
        completion.reasoningTokens || 0,
        completion.model,
        completion.toolsUsed ? JSON.stringify(completion.toolsUsed) : null,
        completion.toolCallsCount || 0,
        completion.errorType,
        completion.errorMessage,
        stepId,
      ]
    );
  }

  async getChildren(parentStepId: string): Promise<AnalyticsAgentStep[]> {
    return this.all<AnalyticsAgentStep>(
      'SELECT * FROM analytics_agent_steps WHERE parent_step_id = ? ORDER BY sequence ASC',
      [parentStepId]
    );
  }

  async getHierarchy(stepId: string): Promise<AnalyticsAgentStep | undefined> {
    return this.first<AnalyticsAgentStep>('SELECT * FROM analytics_agent_steps WHERE step_id = ?', [
      stepId,
    ]);
  }

  async query(filter: StepQueryFilter): Promise<AnalyticsAgentStep[]> {
    let sql = 'SELECT * FROM analytics_agent_steps WHERE 1=1';
    const params: unknown[] = [];

    if (filter.eventId) {
      sql += ' AND event_id = ?';
      params.push(filter.eventId);
    }
    if (filter.agentName) {
      sql += ' AND agent_name = ?';
      params.push(filter.agentName);
    }
    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.startTime) {
      sql += ' AND started_at >= ?';
      params.push(filter.startTime);
    }
    if (filter.endTime) {
      sql += ' AND completed_at <= ?';
      params.push(filter.endTime);
    }

    sql += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(filter.limit || 50, filter.offset || 0);

    return this.all<AnalyticsAgentStep>(sql, params);
  }

  async getAgentStats(agentName: string): Promise<{
    totalSteps: number;
    successCount: number;
    errorCount: number;
    avgDurationMs: number;
    totalTokensUsed: number;
  }> {
    const result = await this.first<{
      totalSteps: number;
      successCount: number;
      errorCount: number;
      avgDurationMs: number;
      totalTokensUsed: number;
    }>(
      `SELECT COUNT(*) as totalSteps, 
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
              SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
              CAST(AVG(duration_ms) as INTEGER) as avgDurationMs,
              COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokensUsed
       FROM analytics_agent_steps WHERE agent_name = ?`,
      [agentName]
    );
    return (
      result || {
        totalSteps: 0,
        successCount: 0,
        errorCount: 0,
        avgDurationMs: 0,
        totalTokensUsed: 0,
      }
    );
  }
}
