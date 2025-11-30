import type { MiddlewareHandler } from 'hono';
import { logger } from '../logger.js';

/** Track if warning has been logged to avoid spam */
let secretWarningLogged = false;

/**
 * Create Telegram webhook authentication middleware
 *
 * Verifies the X-Telegram-Bot-Api-Secret-Token header matches the configured secret.
 *
 * SECURITY: If TELEGRAM_WEBHOOK_SECRET is not configured, webhook auth is disabled.
 * This is intentional for local development but should always be set in production.
 */
export function createTelegramWebhookAuth<
  E extends { TELEGRAM_WEBHOOK_SECRET?: string },
>(): MiddlewareHandler<{ Bindings: E }> {
  return async (c, next) => {
    const secret = c.env.TELEGRAM_WEBHOOK_SECRET;

    // If no secret configured, skip verification with warning
    if (!secret) {
      if (!secretWarningLogged) {
        logger.warn('[SECURITY] TELEGRAM_WEBHOOK_SECRET not configured - webhook auth disabled');
        secretWarningLogged = true;
      }
      return next();
    }

    const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');

    if (secretHeader !== secret) {
      return c.text('Unauthorized', 401);
    }

    return next();
  };
}
