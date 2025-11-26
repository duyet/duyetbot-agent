/**
 * Telegram bot middlewares
 *
 * This module provides middleware components for Telegram webhook processing:
 *
 * - Parser middleware: Parses webhook requests and extracts message context
 * - Auth middleware: Validates user authorization
 * - Authorization middleware (deprecated): Combined parser + auth for backward compatibility
 *
 * @example
 * ```typescript
 * import {
 *   createTelegramParserMiddleware,
 *   createTelegramAuthMiddleware,
 *   type AuthVariables,
 * } from './middlewares/index.js';
 *
 * app.post('/webhook',
 *   createTelegramParserMiddleware(),
 *   createTelegramAuthMiddleware(),
 *   async (c) => {
 *     const ctx = c.get('webhookContext');
 *     // ... handle message
 *   }
 * );
 * ```
 */

// Types
export * from './types.js';

// Parser middleware
export { createTelegramParserMiddleware } from './parser.js';

// Auth middleware
export {
  createTelegramAuthMiddleware,
  isUserAuthorized,
  AuthErrorCodes,
} from './auth.js';

// Deprecated combined middleware (for backward compatibility)
export { authorizationMiddleware } from './authorization.js';
