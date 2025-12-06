/**
 * State Management Durable Object
 *
 * DEPRECATED: This module is part of the legacy architecture.
 * Legacy implementation kept for backward compatibility during migration.
 *
 * Centralized hub for:
 * - Session tracking across all chat agents
 * - Execution traces for observability
 * - Watchdog recovery for stuck batches (with user notification)
 * - Aggregated metrics
 *
 * The new architecture moves observability to ExecutionContext (src/execution/context.ts) and
 * DebugAccumulator. StateDO will be removed in a future phase after migrating any remaining
 * dependencies.
 */
import { logger } from '@duyetbot/hono-middleware';
import { Agent } from 'agents';
import {
  createInitialStateDOState,
  createSessionState,
  DEFAULT_STUCK_THRESHOLD_MS,
  MAX_TRACES,
  WATCHDOG_INTERVAL_SECONDS,
} from '../state-types.js';
/**
 * State Management Durable Object
 *
 * Provides centralized observability and watchdog recovery for all chat agents.
 * Uses a single global instance per deployment.
 */
export class StateDO extends Agent {
  initialState = createInitialStateDOState();
  /**
   * Called when the DO is first created or after hibernation
   */
  async onStart() {
    logger.info('[StateDO] Starting up');
    // Start watchdog alarm if not already running
    if (this.state.lastWatchdogRun === 0) {
      await this.scheduleWatchdog();
    }
  }
  // ============================================
  // Session Lifecycle Methods
  // ============================================
  /**
   * Register a new batch for tracking
   */
  async registerBatch(params) {
    const session = createSessionState(params);
    this.setState({
      ...this.state,
      sessions: {
        ...this.state.sessions,
        [params.sessionId]: session,
      },
      updatedAt: Date.now(),
    });
    logger.info('[StateDO] Registered batch', {
      sessionId: params.sessionId,
      batchId: params.batchId,
      platform: params.platform,
    });
    // Start trace
    await this.logTrace({
      sessionId: params.sessionId,
      query: '',
      status: 'started',
    });
  }
  /**
   * Update heartbeat for a session
   */
  async heartbeat(params) {
    const session = this.state.sessions[params.sessionId];
    if (!session) {
      logger.warn('[StateDO] Heartbeat for unknown session', {
        sessionId: params.sessionId,
      });
      return;
    }
    // Only update if batch ID matches
    if (session.batchId !== params.batchId) {
      logger.warn('[StateDO] Heartbeat batch ID mismatch', {
        sessionId: params.sessionId,
        expected: session.batchId,
        received: params.batchId,
      });
      return;
    }
    this.setState({
      ...this.state,
      sessions: {
        ...this.state.sessions,
        [params.sessionId]: {
          ...session,
          lastHeartbeat: Date.now(),
          lastActivity: Date.now(),
        },
      },
      updatedAt: Date.now(),
    });
  }
  /**
   * Mark a session as delegated to another agent
   */
  async markDelegated(params) {
    const session = this.state.sessions[params.sessionId];
    if (!session) {
      logger.warn('[StateDO] markDelegated for unknown session', {
        sessionId: params.sessionId,
      });
      return;
    }
    this.setState({
      ...this.state,
      sessions: {
        ...this.state.sessions,
        [params.sessionId]: {
          ...session,
          batchStatus: 'delegated',
          delegatedTo: params.delegatedTo,
          lastActivity: Date.now(),
        },
      },
      updatedAt: Date.now(),
    });
    logger.info('[StateDO] Session delegated', {
      sessionId: params.sessionId,
      batchId: params.batchId,
      delegatedTo: params.delegatedTo,
    });
  }
  /**
   * Complete a batch (success or failure)
   */
  async completeBatch(params) {
    const session = this.state.sessions[params.sessionId];
    if (!session) {
      logger.warn('[StateDO] completeBatch for unknown session', {
        sessionId: params.sessionId,
      });
      return;
    }
    const now = Date.now();
    const status = params.success ? 'completed' : 'failed';
    // Update session
    this.setState({
      ...this.state,
      sessions: {
        ...this.state.sessions,
        [params.sessionId]: {
          ...session,
          batchStatus: status,
          batchId: null,
          delegatedTo: null,
          lastActivity: now,
        },
      },
      metrics: {
        ...this.state.metrics,
        totalExecutions: this.state.metrics.totalExecutions + 1,
        totalDurationMs: this.state.metrics.totalDurationMs + params.durationMs,
        totalTokens: this.state.metrics.totalTokens + (params.tokenCount ?? 0),
        errorCount: params.success
          ? this.state.metrics.errorCount
          : this.state.metrics.errorCount + 1,
      },
      updatedAt: now,
    });
    // Log trace completion - only include defined properties
    const traceParams = {
      sessionId: params.sessionId,
      query: '',
      status: params.success ? 'completed' : 'failed',
      durationMs: params.durationMs,
    };
    if (params.tokenCount !== undefined) {
      traceParams.tokenCount = params.tokenCount;
    }
    if (params.error !== undefined) {
      traceParams.error = params.error;
    }
    await this.logTrace(traceParams);
    logger.info('[StateDO] Batch completed', {
      sessionId: params.sessionId,
      batchId: params.batchId,
      success: params.success,
      durationMs: params.durationMs,
    });
  }
  // ============================================
  // Trace Logging
  // ============================================
  /**
   * Log an execution trace
   */
  async logTrace(params) {
    const now = Date.now();
    // Find existing trace for this session or create new
    const existingTraceIndex = this.state.traces.findIndex(
      (t) => t.sessionId === params.sessionId && t.status === 'started'
    );
    if (existingTraceIndex >= 0 && params.status !== 'started') {
      // Update existing trace - safe because we found it by index
      const existingTrace = this.state.traces[existingTraceIndex];
      const updatedTrace = {
        traceId: existingTrace.traceId,
        sessionId: existingTrace.sessionId,
        query: existingTrace.query,
        startedAt: existingTrace.startedAt,
        status: params.status,
        completedAt: now,
        classification: params.classification ?? existingTrace.classification,
        routedTo: params.routedTo ?? existingTrace.routedTo,
        toolsUsed: params.toolsUsed ?? existingTrace.toolsUsed,
        durationMs: params.durationMs ?? existingTrace.durationMs,
        tokenCount: params.tokenCount ?? existingTrace.tokenCount,
        error: params.error ?? existingTrace.error,
      };
      const newTraces = [...this.state.traces];
      newTraces[existingTraceIndex] = updatedTrace;
      this.setState({
        ...this.state,
        traces: newTraces,
        updatedAt: now,
      });
    } else if (params.status === 'started') {
      // Create new trace
      const newTrace = {
        traceId: crypto.randomUUID(),
        sessionId: params.sessionId,
        query: params.query,
        startedAt: now,
        completedAt: null,
        status: 'started',
        classification: params.classification ?? null,
        routedTo: params.routedTo ?? null,
        toolsUsed: params.toolsUsed ?? [],
        durationMs: null,
        tokenCount: null,
        error: null,
      };
      // Ring buffer - remove oldest if at capacity
      let newTraces = [...this.state.traces, newTrace];
      if (newTraces.length > MAX_TRACES) {
        newTraces = newTraces.slice(-MAX_TRACES);
      }
      this.setState({
        ...this.state,
        traces: newTraces,
        updatedAt: now,
      });
    }
  }
  // ============================================
  // Query Methods
  // ============================================
  /**
   * Get session state by ID
   */
  getSession(sessionId) {
    return this.state.sessions[sessionId] ?? null;
  }
  /**
   * Get all sessions that are stuck (no heartbeat within threshold)
   */
  getStuckSessions(thresholdMs = DEFAULT_STUCK_THRESHOLD_MS) {
    const now = Date.now();
    const stuckSessions = [];
    for (const session of Object.values(this.state.sessions)) {
      // Only check sessions that are actively processing or delegated
      if (session.batchStatus === 'processing' || session.batchStatus === 'delegated') {
        const timeSinceHeartbeat = now - session.lastHeartbeat;
        if (timeSinceHeartbeat > thresholdMs) {
          stuckSessions.push(session);
        }
      }
    }
    return stuckSessions;
  }
  /**
   * Get traces for a session
   */
  getTraces(sessionId, limit = 10) {
    return this.state.traces.filter((t) => t.sessionId === sessionId).slice(-limit);
  }
  /**
   * Get aggregated metrics
   */
  getMetrics() {
    return this.state.metrics;
  }
  // ============================================
  // Recovery Methods
  // ============================================
  /**
   * Force recover a stuck session
   */
  async forceRecover(sessionId) {
    const session = this.state.sessions[sessionId];
    if (!session) {
      return {
        recovered: false,
        reason: 'Session not found',
        sessionId,
      };
    }
    if (session.batchStatus !== 'processing' && session.batchStatus !== 'delegated') {
      return {
        recovered: false,
        reason: `Session not in recoverable state (status: ${session.batchStatus})`,
        sessionId,
      };
    }
    // Notify user about recovery
    if (session.responseTarget) {
      await this.notifyUser(session, 'Your message got stuck during processing. Please try again.');
    }
    // Clear the session
    await this.clearSession(sessionId, 'force_recover');
    return {
      recovered: true,
      reason: 'Force recovered by request',
      sessionId,
    };
  }
  // ============================================
  // Watchdog Alarm
  // ============================================
  /**
   * Schedule the next watchdog run
   */
  async scheduleWatchdog() {
    try {
      await this.schedule(WATCHDOG_INTERVAL_SECONDS, 'onWatchdogAlarm', {});
      logger.info('[StateDO] Watchdog scheduled', {
        intervalSeconds: WATCHDOG_INTERVAL_SECONDS,
      });
    } catch (error) {
      logger.error('[StateDO] Failed to schedule watchdog', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  /**
   * Watchdog alarm handler
   * Runs periodically to detect and recover stuck sessions
   */
  async onWatchdogAlarm() {
    const now = Date.now();
    logger.info('[StateDO][WATCHDOG] Running', {
      lastRun: this.state.lastWatchdogRun,
      sessionsCount: Object.keys(this.state.sessions).length,
    });
    const stuckSessions = this.getStuckSessions(DEFAULT_STUCK_THRESHOLD_MS);
    for (const session of stuckSessions) {
      logger.warn('[StateDO][WATCHDOG] Recovering stuck session', {
        sessionId: session.sessionId,
        batchId: session.batchId,
        lastHeartbeat: session.lastHeartbeat,
        timeSinceHeartbeat: now - session.lastHeartbeat,
        status: session.batchStatus,
        delegatedTo: session.delegatedTo,
      });
      // Notify user about recovery
      if (session.responseTarget) {
        await this.notifyUser(
          session,
          'Sorry, your message got stuck during processing. Please try again.'
        );
      }
      // Clear the stuck session
      await this.clearSession(session.sessionId, 'watchdog_timeout');
    }
    // Update last watchdog run time
    this.setState({
      ...this.state,
      lastWatchdogRun: now,
      updatedAt: now,
    });
    // Schedule next watchdog run
    await this.scheduleWatchdog();
    logger.info('[StateDO][WATCHDOG] Completed', {
      recoveredCount: stuckSessions.length,
    });
  }
  // ============================================
  // Helper Methods
  // ============================================
  /**
   * Clear a session and update metrics
   */
  async clearSession(sessionId, reason) {
    const session = this.state.sessions[sessionId];
    if (!session) {
      return;
    }
    const now = Date.now();
    // Log recovery trace
    await this.logTrace({
      sessionId,
      query: '',
      status: 'recovered',
      error: `Watchdog recovery: ${reason}`,
      durationMs: now - session.lastActivity,
    });
    // Update session state
    this.setState({
      ...this.state,
      sessions: {
        ...this.state.sessions,
        [sessionId]: {
          ...session,
          batchStatus: 'recovered',
          batchId: null,
          delegatedTo: null,
          lastActivity: now,
        },
      },
      metrics: {
        ...this.state.metrics,
        recoveryCount: this.state.metrics.recoveryCount + 1,
      },
      updatedAt: now,
    });
    logger.info('[StateDO] Session cleared', {
      sessionId,
      reason,
    });
  }
  /**
   * Send notification to user about recovery
   */
  async notifyUser(session, message) {
    if (!session.responseTarget) {
      return;
    }
    try {
      if (session.platform === 'telegram') {
        await this.sendTelegramNotification(session, message);
      } else if (session.platform === 'github') {
        // GitHub notification would be implemented here
        logger.info('[StateDO] GitHub notification not implemented', {
          sessionId: session.sessionId,
        });
      }
    } catch (error) {
      logger.error('[StateDO] Failed to notify user', {
        sessionId: session.sessionId,
        platform: session.platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  /**
   * Send Telegram notification
   */
  async sendTelegramNotification(session, message) {
    // Access env via type assertion (required by Agent base class pattern)
    const env = this.env;
    const telegramToken = env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
      logger.warn('[StateDO] No Telegram token for notification', {
        sessionId: session.sessionId,
      });
      return;
    }
    if (!session.responseTarget) {
      return;
    }
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: session.responseTarget.chatId,
        text: `⚠️ ${message}`,
        reply_to_message_id: session.responseTarget.messageId,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
    }
    logger.info('[StateDO] Telegram notification sent', {
      sessionId: session.sessionId,
      chatId: session.responseTarget.chatId,
    });
  }
}
