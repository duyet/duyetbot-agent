/**
 * Structured Logger for Cloudflare Workers Observability
 *
 * Provides consistent JSON logging format for better querying in CF dashboard
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext {
  [key: string]: unknown;
}
export declare const logger: {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
};
//# sourceMappingURL=logger.d.ts.map
