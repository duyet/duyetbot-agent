/**
 * Authorization middleware for Telegram webhook
 *
 * @deprecated This module is deprecated. Use the separate parser and auth middlewares instead:
 *
 * ```typescript
 * import {
 *   createTelegramParserMiddleware,
 *   createTelegramAuthMiddleware,
 * } from './middlewares/index.js';
 *
 * app.post('/webhook',
 *   createTelegramParserMiddleware(),
 *   createTelegramAuthMiddleware(),
 *   handler
 * );
 * ```
 */

import type { MiddlewareHandler } from 'hono';

import { createTelegramAuthMiddleware } from './auth.js';
import { createTelegramParserMiddleware } from './parser.js';
import type { AuthVariables, Env } from './types.js';

// Re-export types for backward compatibility
export type {
  TelegramUpdate,
  WebhookContext,
  Env,
  AuthVariables,
} from './types.js';

// Re-export functions for backward compatibility
export { isUserAuthorized, AuthErrorCodes } from './auth.js';

/**
 * Combined authorization middleware for Telegram webhook
 *
 * @deprecated Use separate `createTelegramParserMiddleware()` and `createTelegramAuthMiddleware()` instead.
 *
 * This function chains the parser and auth middlewares for backward compatibility.
 * It sets `webhookContext` on Hono context if request is valid and authorized.
 * It sets `skipProcessing` to true if request should be skipped (no message or unauthorized).
 *
 * @example
 * ```typescript
 * // Old usage (deprecated)
 * app.post('/webhook', authorizationMiddleware(), handler);
 *
 * // New usage (recommended)
 * app.post('/webhook',
 *   createTelegramParserMiddleware(),
 *   createTelegramAuthMiddleware(),
 *   handler
 * );
 * ```
 */
export function authorizationMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> {
  const parser = createTelegramParserMiddleware();
  const auth = createTelegramAuthMiddleware();

  return async (c, next) => {
    // Run parser middleware, then auth middleware
    // Type cast is safe since AuthVariables extends ParserVariables
    await parser(c as any, async () => {
      await auth(c as any, next);
    });
  };
}
