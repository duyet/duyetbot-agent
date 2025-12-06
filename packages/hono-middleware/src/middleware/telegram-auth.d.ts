import type { MiddlewareHandler } from 'hono';
/**
 * Create Telegram webhook authentication middleware
 *
 * Verifies the X-Telegram-Bot-Api-Secret-Token header matches the configured secret.
 *
 * SECURITY: If TELEGRAM_WEBHOOK_SECRET is not configured, webhook auth is disabled.
 * This is intentional for local development but should always be set in production.
 */
export declare function createTelegramWebhookAuth<
  E extends {
    TELEGRAM_WEBHOOK_SECRET?: string;
  },
>(): MiddlewareHandler<{
  Bindings: E;
}>;
//# sourceMappingURL=telegram-auth.d.ts.map
