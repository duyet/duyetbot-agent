/**
 * Structured Logger for Cloudflare Workers Observability
 *
 * Provides consistent JSON logging format for better querying in CF dashboard
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  switch (level) {
    case 'debug':
      console.debug(JSON.stringify(entry));
      break;
    case 'info':
      console.info(JSON.stringify(entry));
      break;
    case 'warn':
      console.warn(JSON.stringify(entry));
      break;
    case 'error':
      console.error(JSON.stringify(entry));
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
};
