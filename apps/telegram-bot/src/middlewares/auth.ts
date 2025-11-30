/**
 * Authentication middleware for Telegram bot
 *
 * Validates user authorization against allowed users list.
 * Part of the refactored middleware stack.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { MiddlewareHandler } from 'hono';

import type { AuthVariables, Env, WebhookContext } from './types.js';

/**
 * Error codes for authentication failures
 */
export const AuthErrorCodes = {
  AUTH_001: 'User not authorized',
} as const;

/**
 * Check if user is authorized based on TELEGRAM_ALLOWED_USERS env var
 *
 * Authorization logic:
 * - If TELEGRAM_ALLOWED_USERS is not configured, allow all users
 * - If configured but empty after parsing, allow all users
 * - Otherwise, only allow users in the comma-separated list
 *
 * @param env - Environment bindings containing TELEGRAM_ALLOWED_USERS
 * @param userId - Telegram user ID to check
 * @param username - Optional username for logging
 * @param chatId - Optional chat ID for logging
 * @returns true if user is authorized, false otherwise
 *
 * @example
 * ```typescript
 * // Allow specific users
 * // TELEGRAM_ALLOWED_USERS=123456,789012
 * isUserAuthorized(env, 123456) // true
 * isUserAuthorized(env, 999999) // false
 *
 * // Allow all users (not configured)
 * // TELEGRAM_ALLOWED_USERS undefined
 * isUserAuthorized(env, 999999) // true
 * ```
 */
export function isUserAuthorized(
  env: Env,
  userId: number,
  username?: string,
  chatId?: number
): boolean {
  if (!env.TELEGRAM_ALLOWED_USERS) {
    logger.debug('[AUTH] env.TELEGRAM_ALLOWED_USERS is not configured, allowing all');
    return true;
  }

  const allowed = env.TELEGRAM_ALLOWED_USERS.split(',')
    .map((id) => Number.parseInt(id.trim(), 10))
    .filter((id) => !Number.isNaN(id));

  if (allowed.length === 0) {
    logger.debug('[AUTH] Empty allowed list, allowing all');
    return true;
  }

  if (!allowed.includes(userId)) {
    logger.warn(`[AUTH] ${AuthErrorCodes.AUTH_001}`, {
      userId,
      chatId,
      username,
      code: 'AUTH_001',
    });
    return false;
  }

  logger.debug('[AUTH] User authorized', { userId });
  return true;
}

/**
 * Create authentication middleware for Telegram webhook
 *
 * This middleware checks if the user is authorized to use the bot.
 * It reads the `webhookContext` set by the parser middleware and
 * validates the user against the allowed users list.
 *
 * Behavior:
 * - If `skipProcessing` is already true (set by parser), skip auth check
 * - If user is not authorized, set `unauthorized: true` and `skipProcessing: true`
 * - If user is authorized, set `unauthorized: false`
 *
 * @returns Hono middleware handler
 *
 * @example
 * ```typescript
 * import { createTelegramAuthMiddleware } from './auth.js';
 *
 * app.use('/webhook', createTelegramAuthMiddleware());
 * ```
 */
export function createTelegramAuthMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    // Check if processing should be skipped (set by parser middleware)
    const skipProcessing = c.get('skipProcessing');
    if (skipProcessing) {
      logger.debug('[AUTH] Skipping auth check - skipProcessing already set');
      return next();
    }

    // Get webhook context set by parser middleware
    const webhookContext = c.get('webhookContext') as WebhookContext | undefined;
    if (!webhookContext) {
      logger.warn('[AUTH] No webhookContext found - parser middleware may not have run');
      c.set('skipProcessing', true);
      return next();
    }

    // Initialize unauthorized flag
    c.set('unauthorized', false);

    // Check authorization
    const env = c.env;
    const authorized = isUserAuthorized(
      env,
      webhookContext.userId,
      webhookContext.username,
      webhookContext.chatId
    );

    if (!authorized) {
      logger.info('[AUTH] User rejected', {
        userId: webhookContext.userId,
        username: webhookContext.username,
      });
      c.set('unauthorized', true);
      c.set('skipProcessing', true);
      return next();
    }

    logger.debug('[AUTH] User passed authorization', {
      userId: webhookContext.userId,
    });

    return next();
  };
}
