/**
 * Structured Logging Middleware
 *
 * Provides consistent, structured logging for all API requests
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types';
import { getOptionalUser } from './auth';
import { getRequestId } from './request-id';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId: string;
  message: string;
  method?: string;
  path?: string;
  userId?: string | undefined;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string | undefined;
  error?: {
    message: string;
    stack?: string | undefined;
    code?: string | undefined;
  } | undefined;
  metadata?: Record<string, unknown>;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  constructor(private context: Context<AppEnv>) {}

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
    const requestId = getRequestId(this.context);
    const user = getOptionalUser(this.context);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
      method: this.context.req.method,
      path: this.context.req.path,
      userId: user?.id,
      ip: this.context.req.header('CF-Connecting-IP') || 'unknown',
      userAgent: this.context.req.header('User-Agent'),
      metadata,
    };

    // Output as JSON for structured logging
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.log('warn', message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>) {
    const errorWithCode = error as Error & { code?: string };
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      requestId: getRequestId(this.context),
      message,
      method: this.context.req.method,
      path: this.context.req.path,
      userId: getOptionalUser(this.context)?.id,
      ip: this.context.req.header('CF-Connecting-IP') || 'unknown',
      userAgent: this.context.req.header('User-Agent'),
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            code: errorWithCode.code,
          }
        : undefined,
      metadata,
    };

    console.error(JSON.stringify(entry));
  }
}

/**
 * Request logging middleware
 * Logs all incoming requests and responses
 */
export async function loggerMiddleware(c: Context<AppEnv>, next: Next) {
  const logger = new Logger(c);
  const startTime = Date.now();

  // Log request
  logger.info('Request received', {
    query: c.req.query(),
    headers: {
      origin: c.req.header('Origin'),
      referer: c.req.header('Referer'),
      contentType: c.req.header('Content-Type'),
    },
  });

  // Store logger in context for use in handlers
  c.set('logger', logger);

  await next();

  // Log response
  const duration = Date.now() - startTime;
  const statusCode = c.res.status;

  const responseEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
    requestId: getRequestId(c),
    message: 'Request completed',
    method: c.req.method,
    path: c.req.path,
    userId: getOptionalUser(c)?.id,
    statusCode,
    duration,
    ip: c.req.header('CF-Connecting-IP') || 'unknown',
    userAgent: c.req.header('User-Agent'),
  };

  console.log(JSON.stringify(responseEntry));
}

/**
 * Get logger from context
 */
export function getLogger(c: Context<AppEnv>): Logger {
  const logger = c.get('logger');
  if (!logger) {
    // Fallback to new logger if not in context
    return new Logger(c);
  }
  return logger;
}
