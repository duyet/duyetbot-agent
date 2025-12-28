/**
 * Telegram bot middlewares
 *
 * This module provides middleware components for Telegram webhook processing:
 *
 * - Parser middleware: Parses webhook requests and extracts message context
 * - Auth middleware: Validates user authorization
 * - Rate limit middleware: Per-user rate limiting and burst detection
 *
 * @example
 * ```typescript
 * import {
 *   createTelegramParserMiddleware,
 *   createTelegramAuthMiddleware,
 *   createRateLimitMiddleware,
 *   type AuthVariables,
 * } from './middlewares/index.js';
 *
 * app.post('/webhook',
 *   createTelegramParserMiddleware(),
 *   createTelegramAuthMiddleware(),
 *   createRateLimitMiddleware(),
 *   async (c) => {
 *     const ctx = c.get('webhookContext');
 *     // ... handle message
 *   }
 * );
 * ```
 */

// Auth middleware
export {
  AuthErrorCodes,
  createTelegramAuthMiddleware,
  isUserAuthorized,
} from './auth.js';

// Parser middleware
export { createTelegramParserMiddleware } from './parser.js';

// Rate limit middleware
export {
  DEFAULT_RATE_LIMIT,
  RateLimitErrorCodes,
  createRateLimitMiddleware,
  getRateLimitStats,
  getUserRateLimitState,
  resetUserRateLimitState,
  type RateLimitConfig,
} from './rate-limit.js';

// Types
export * from './types.js';
