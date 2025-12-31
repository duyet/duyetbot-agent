/**
 * Structured Logger for Cloudflare Workers Observability
 *
 * Provides consistent JSON logging format for better querying in CF dashboard.
 * Supports optional log compaction to reduce noise from repetitive logs.
 *
 * @example
 * ```typescript
 * // Basic logging
 * logger.info('message', { foo: 'bar' });
 *
 * // With compaction
 * logger.info('message', context, { compact: true, abbreviate: true });
 * ```
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Logger configuration for controlling compaction and filtering
 */
export interface LoggerConfig {
  /** Enable log compaction to reduce noise */
  compact?: boolean;
  /** Abbreviate field names (msgs instead of messages) */
  abbreviate?: boolean;
  /** Hide sensitive refs (IDs, trace IDs) */
  hideRefs?: boolean;
  /** Filter function to skip logs entirely */
  filter?: (level: LogLevel, message: string, context?: LogContext) => boolean;
}

/** Global logger configuration */
let globalLoggerConfig: LoggerConfig = {
  compact: false,
  abbreviate: false,
  hideRefs: false,
};

/**
 * Configure global logger behavior
 *
 * @example
 * ```typescript
 * configureLogger({ compact: true, abbreviate: true });
 * ```
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalLoggerConfig = { ...globalLoggerConfig, ...config };
}

/**
 * Compact state update logs
 * Input: { displayMessage: 'State updated', type: 'state:update', messages: [...] }
 * Output: "[state] msgs:20 | t:728961"
 */
function compactStateUpdate(context: LogContext): string | null {
  if (context.type !== 'state:update' && context.displayMessage !== 'State updated') {
    return null;
  }

  const messages = (context.payload as any)?.messages;
  const msgCount = Array.isArray(messages) ? messages.length : '?';
  const timestamp = (context.timestamp as number)?.toString().slice(-6) || 'unknown';

  return `[state] msgs:${msgCount} | t:${timestamp}`;
}

/**
 * Compact generic log object
 */
function compactLog(context: LogContext, config: LoggerConfig): LogContext {
  // Handle state updates with special formatting
  const stateCompact = compactStateUpdate(context);
  if (stateCompact) {
    // For state updates, return a minimal object
    return { type: 'state:update', summary: stateCompact };
  }

  // Compact large objects
  const compacted: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (key === 'messages' && Array.isArray(value) && value.length > 10) {
      compacted[config.abbreviate ? 'msgs' : key] = `<${value.length} items>`;
    } else if (key === 'timestamp' || key === 't') {
      compacted[config.abbreviate ? 't' : key] =
        typeof value === 'number' ? value.toString().slice(-6) : value;
    } else if (
      config.hideRefs &&
      (key === 'traceId' || key === 'requestId' || key === 'id') &&
      typeof value === 'string'
    ) {
      compacted[key] = `${value.slice(0, 8)}...`;
    } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 5) {
      compacted[key] = `<object with ${Object.keys(value).length} keys>`;
    } else {
      compacted[key] = value;
    }
  }

  return compacted;
}

function log(level: LogLevel, message: string, context?: LogContext, options?: LoggerConfig): void {
  const config = { ...globalLoggerConfig, ...options };

  // Check filter
  if (config.filter && !config.filter(level, message, context)) {
    return;
  }

  // Apply compaction if enabled
  const finalContext = context && config.compact ? compactLog(context, config) : context;

  const output = finalContext ? `${message} ${JSON.stringify(finalContext)}` : message;

  switch (level) {
    case 'debug':
      console.debug(output);
      break;
    case 'info':
      console.info(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
      console.error(output);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext, options?: LoggerConfig) =>
    log('debug', message, context, options),
  info: (message: string, context?: LogContext, options?: LoggerConfig) =>
    log('info', message, context, options),
  warn: (message: string, context?: LogContext, options?: LoggerConfig) =>
    log('warn', message, context, options),
  error: (message: string, context?: LogContext, options?: LoggerConfig) =>
    log('error', message, context, options),
};
