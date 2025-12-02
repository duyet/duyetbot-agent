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
 *
 * Note: For webhook signature verification, use platform-specific middleware:
 * - GitHub: apps/github-bot/src/middlewares/signature.ts
 * - Telegram: @duyetbot/hono-middleware/createTelegramWebhookAuth
 */
export interface AuthOptions {
  /** Auth type */
  type: 'bearer' | 'api-key';
  /** Token validation function */
  validate?: (token: string, c: Context) => Promise<Record<string, unknown> | null>;
  /** Header name for API key (only used with api-key type) */
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
