import type { Context, MiddlewareHandler } from 'hono';

/**
 * Options for creating a base app
 */
export interface AppOptions {
  /** App name for health checks */
  name: string;
  /** App version */
  version?: string;
  /** Enable request logging */
  logger?: boolean;
  /** Rate limiting configuration */
  rateLimit?: RateLimitOptions;
  /** Include health check routes */
  health?: boolean;
  /** Skip processing for paths matching these prefixes (e.g., ['/cdn-cgi/']) */
  ignorePaths?: string[];
}

/**
 * Logger middleware options
 */
export interface LoggerOptions {
  /** Log format */
  format?: 'json' | 'text';
  /** Include request headers */
  includeHeaders?: boolean;
}

/**
 * Rate limit middleware options
 */
export interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number;
  /** Time window in milliseconds */
  window: number;
  /** Custom key generator */
  keyGenerator?: (c: Context) => string;
}

/**
 * Auth middleware options
 */
export interface AuthOptions {
  /** Auth type */
  type: 'bearer' | 'api-key' | 'github-webhook';
  /** Token validation function */
  validate?: (token: string, c: Context) => Promise<Record<string, unknown> | null>;
  /** Secret for webhook signature (can be function) */
  secret?: string | ((c: Context) => string);
  /** Header name for API key */
  headerName?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  name: string;
  version: string;
  timestamp: string;
}

export type { Context, MiddlewareHandler };
