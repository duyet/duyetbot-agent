import type { TokenUsage } from '@duyetbot/observability';
import type { ExecutionStep } from '../types.js';

/**
 * Log level for execution events.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context for execution logs.
 */
export interface ExecutionContext {
  /** Platform identifier (e.g., 'telegram', 'github') */
  platform: string;
  /** User identifier */
  userId: string;
  /** Chat or thread identifier */
  chatId: string;
  /** Trace identifier for correlating related events (optional) */
  traceId?: string;
  /** Model used for execution (optional) */
  model?: string;
  /** Token usage for this execution (optional) */
  tokenUsage?: TokenUsage;
}

/**
 * Structured execution log entry.
 *
 * Designed for AI analysis and debugging with full context preservation.
 */
export interface ExecutionLog {
  /** Trace identifier for correlating related events */
  traceId: string;
  /** Unique event identifier */
  eventId: string;
  /** Timestamp in milliseconds */
  timestamp: number;
  /** Log level */
  level: LogLevel;
  /** Execution step details */
  step: ExecutionStep;
  /** Execution context */
  context: ExecutionContext;
}

/**
 * Options for execution logger.
 */
export interface ExecutionLoggerOptions {
  /** Trace ID for correlating logs */
  traceId: string;
  /** Event ID for this execution */
  eventId: string;
  /** Execution context */
  context: ExecutionContext;
  /** Optional log handler (default: console) */
  onLog?: (log: ExecutionLog) => void;
}

/**
 * Structured logger for agent execution events.
 *
 * Provides:
 * - Structured logging format for AI analysis
 * - Log levels: debug, info, warn, error
 * - Trace context preservation
 * - Step tracking integration
 *
 * @example
 * ```typescript
 * const logger = new ExecutionLogger({
 *   traceId: 'trace-123',
 *   eventId: 'event-456',
 *   context: {
 *     platform: 'telegram',
 *     userId: '12345',
 *     chatId: '67890',
 *     model: 'x-ai/grok-4.1-fast',
 *   },
 * });
 *
 * // Log execution steps
 * logger.debug({ type: 'preparing', timestamp: Date.now() });
 * logger.info({ type: 'thinking', timestamp: Date.now(), thinking: 'Analyzing query...' });
 * logger.warn({ type: 'tool_error', timestamp: Date.now(), toolName: 'search', error: 'Timeout' });
 * ```
 */
export class ExecutionLogger {
  private options: ExecutionLoggerOptions;

  constructor(options: ExecutionLoggerOptions) {
    this.options = options;
  }

  /**
   * Log a debug-level execution step.
   *
   * @param step - Execution step to log
   */
  debug(step: ExecutionStep): void {
    this.log('debug', step);
  }

  /**
   * Log an info-level execution step.
   *
   * @param step - Execution step to log
   */
  info(step: ExecutionStep): void {
    this.log('info', step);
  }

  /**
   * Log a warning-level execution step.
   *
   * @param step - Execution step to log
   */
  warn(step: ExecutionStep): void {
    this.log('warn', step);
  }

  /**
   * Log an error-level execution step.
   *
   * @param step - Execution step to log
   */
  error(step: ExecutionStep): void {
    this.log('error', step);
  }

  /**
   * Internal log method that creates and emits structured log entry.
   *
   * @param level - Log level
   * @param step - Execution step
   */
  private log(level: LogLevel, step: ExecutionStep): void {
    const log: ExecutionLog = {
      traceId: this.options.traceId,
      eventId: this.options.eventId,
      timestamp: Date.now(),
      level,
      step,
      context: this.options.context,
    };

    if (this.options.onLog) {
      this.options.onLog(log);
    } else {
      // Default to console
      this.logToConsole(log);
    }
  }

  /**
   * Default console logger with formatted output.
   *
   * @param log - Execution log to output
   */
  private logToConsole(log: ExecutionLog): void {
    const { level, step, context } = log;
    const prefix = `[${level.toUpperCase()}][${context.platform}:${context.chatId}]`;

    // Format step info
    let stepInfo = `[${step.type}]`;
    if (step.type === 'tool_start' || step.type === 'tool_complete' || step.type === 'tool_error') {
      stepInfo += ` ${step.toolName}`;
    } else if (step.type === 'routing') {
      stepInfo += ` -> ${step.agentName}`;
    }

    // Output based on level
    switch (level) {
      case 'debug':
        console.debug(prefix, stepInfo, step);
        break;
      case 'info':
        console.info(prefix, stepInfo, step);
        break;
      case 'warn':
        console.warn(prefix, stepInfo, step);
        break;
      case 'error':
        console.error(prefix, stepInfo, step);
        break;
    }
  }

  /**
   * Update context (useful for updating model or token usage mid-execution).
   *
   * @param updates - Partial context updates
   */
  updateContext(updates: Partial<ExecutionContext>): void {
    this.options.context = {
      ...this.options.context,
      ...updates,
    };
  }

  /**
   * Get current trace ID.
   *
   * @returns Trace identifier
   */
  getTraceId(): string {
    return this.options.traceId;
  }

  /**
   * Get current event ID.
   *
   * @returns Event identifier
   */
  getEventId(): string {
    return this.options.eventId;
  }

  /**
   * Get current context.
   *
   * @returns Execution context
   */
  getContext(): ExecutionContext {
    return { ...this.options.context };
  }
}
