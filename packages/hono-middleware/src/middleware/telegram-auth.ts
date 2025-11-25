import type { MiddlewareHandler } from 'hono';

/**
 * Create Telegram webhook authentication middleware
 *
 * Verifies the X-Telegram-Bot-Api-Secret-Token header matches the configured secret
 */
export function createTelegramWebhookAuth<
  E extends { TELEGRAM_WEBHOOK_SECRET?: string },
>(): MiddlewareHandler<{ Bindings: E }> {
  return async (c, next) => {
    const secret = c.env.TELEGRAM_WEBHOOK_SECRET;

    // If no secret configured, skip verification
    if (!secret) {
      return next();
    }

    const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');

    if (secretHeader !== secret) {
      return c.text('Unauthorized', 401);
    }

    return next();
  };
}
