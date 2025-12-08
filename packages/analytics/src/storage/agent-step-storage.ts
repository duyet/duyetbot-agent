/**
 * Agent Step Storage
 *
 * Architecture (Centralized Data Monitoring):
 * - READ operations use `analytics_agent_steps` view (extracted from observability_events.agents JSON)
 * - WRITE operations update the `agents` JSON column in `observability_events` table
 * - The view `analytics_agent_steps` is an alias to `analytics_agent_steps_view` (created in migration 0009)
 *
 * Note: The view extracts step data from the JSON array, so writes must update the source JSON.
 */

import type {
  AnalyticsAgentStep,
  StepCompletion,
  StepCreateInput,
  StepQueryFilter,
} from '../types.js';
import { BaseStorage } from './base.js';

export class AgentStepStorage extends BaseStorage {
  /**
   * Create an agent step by updating the agents JSON in observability_events.
   *
   * ARCHITECTURE NOTE: Steps are stored in the `agents` JSON column of `observability_events`.
   * The `analytics_agent_steps` view extracts and flattens this data for querying.
   */
  async create(input: StepCreateInput): Promise<AnalyticsAgentStep> {
    const stepId = crypto.randomUUID();
    const now = Date.now();

    // Get current agents JSON from observability_events
    const event = await this.first<{ agents: string | null }>(
      'SELECT agents FROM observability_events WHERE event_id = ?',
      [input.eventId]
    );

    // Parse existing agents or start with empty array
    let agents: Record<string, unknown>[] = [];
    if (event?.agents) {
      try {
        agents = JSON.parse(event.agents);
      } catch {
        agents = [];
      }
    }

    // Create new agent step object
    const newStep = {
      step_id: stepId,
      name: input.agentName,
      type: input.agentType,
      sequence: input.sequence,
      parent_step_id: input.parentStepId ?? null,
      message_id: input.messageId ?? null,
      started_at: now,
      completed_at: null,
      duration_ms: 0,
      status: 'pending',
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      reasoning_tokens: 0,
      model: null,
      tools: null,
      tool_calls: 0,
      error_type: null,
      error_message: null,
    };

    // Add to agents array
    agents.push(newStep);

    // Update observability_events with new agents JSON
    await this.run('UPDATE observability_events SET agents = ? WHERE event_id = ?', [
      JSON.stringify(agents),
      input.eventId,
    ]);

    // Return the step by reading from the view
    const step = await this.first<AnalyticsAgentStep>(
      'SELECT * FROM analytics_agent_steps WHERE step_id = ?',
      [stepId]
    );

    if (!step) {
      // If view doesn't have it yet, construct from input
      return {
        id: 0,
        stepId,
        eventId: input.eventId,
        messageId: input.messageId ?? null,
        parentStepId: input.parentStepId ?? null,
        agentName: input.agentName,
        agentType: input.agentType,
        sequence: input.sequence,
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        queueTimeMs: 0,
        status: 'pending',
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        reasoningTokens: 0,
        errorType: null,
        errorMessage: null,
        retryCount: 0,
        model: null,
        toolsUsed: null,
        toolCallsCount: 0,
        metadata: null,
        createdAt: now,
      };
    }

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

  /**
   * Complete an agent step by updating the agents JSON in observability_events.
   *
   * ARCHITECTURE NOTE: Updates the step within the `agents` JSON array.
   */
  async complete(
    stepId: string,
    completion: StepCompletion
  ): Promise<AnalyticsAgentStep | undefined> {
    const now = Date.now();

    // First, find which event contains this step by querying the view
    const stepInfo = await this.first<{ event_id: string; started_at: number }>(
      'SELECT event_id, started_at FROM analytics_agent_steps WHERE step_id = ?',
      [stepId]
    );

    if (!stepInfo) return undefined;

    const durationMs = now - (stepInfo.started_at || now);

    // Get current agents JSON from observability_events
    const event = await this.first<{ agents: string | null }>(
      'SELECT agents FROM observability_events WHERE event_id = ?',
      [stepInfo.event_id]
    );

    if (!event?.agents) return undefined;

    // Parse agents and find the step to update
    let agents: Record<string, unknown>[];
    try {
      agents = JSON.parse(event.agents);
    } catch {
      return undefined;
    }

    // Find and update the step in the array
    const stepIndex = agents.findIndex(
      (a) =>
        a.step_id === stepId || `${stepInfo.event_id}-${a.sequence ?? agents.indexOf(a)}` === stepId
    );
    if (stepIndex === -1) return undefined;

    // Update the step with completion data
    agents[stepIndex] = {
      ...agents[stepIndex],
      completed_at: now,
      duration_ms: durationMs,
      status: completion.status,
      input_tokens: completion.inputTokens,
      output_tokens: completion.outputTokens,
      cached_tokens: completion.cachedTokens || 0,
      reasoning_tokens: completion.reasoningTokens || 0,
      model: completion.model,
      tools: completion.toolsUsed ? JSON.stringify(completion.toolsUsed) : null,
      tool_calls: completion.toolCallsCount || 0,
      error_type: completion.errorType,
      error_message: completion.errorMessage,
    };

    // Update observability_events with modified agents JSON
    await this.run('UPDATE observability_events SET agents = ? WHERE event_id = ?', [
      JSON.stringify(agents),
      stepInfo.event_id,
    ]);

    // Return the updated step from the view
    return this.first<AnalyticsAgentStep>('SELECT * FROM analytics_agent_steps WHERE step_id = ?', [
      stepId,
    ]);
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

  /**
   * Alias for getByEvent for API consistency
   */
  async getStepsByEvent(eventId: string): Promise<AnalyticsAgentStep[]> {
    return this.getByEvent(eventId);
  }

  /**
   * Get recent steps across all events
   * @param limit Maximum number to return
   * @returns Array of recent steps
   */
  async getRecentSteps(limit: number = 50): Promise<AnalyticsAgentStep[]> {
    return this.all<AnalyticsAgentStep>(
      'SELECT * FROM analytics_agent_steps ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }
}
