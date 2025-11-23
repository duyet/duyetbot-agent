/**
 * Authorization middleware for Telegram webhook
 *
 * Parses incoming webhook requests and validates user authorization.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { Context, MiddlewareHandler } from 'hono';

export interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

export interface WebhookContext {
  userId: number;
  chatId: number;
  startTime: number;
  username?: string;
  text: string;
}

interface Env {
  TELEGRAM_ALLOWED_USERS?: string;
  TELEGRAM_BOT_TOKEN: string;
}

// Error codes for debugging
export const AuthErrorCodes = {
  AUTH_001: 'User not authorized',
} as const;

/**
 * Parse webhook request and extract message data
 */
async function parseWebhookRequest(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>
): Promise<{
  update: TelegramUpdate;
  message: NonNullable<TelegramUpdate['message']>;
} | null> {
  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
    logger.debug('[PARSE] Webhook payload received', {
      update,
      hasMessage: !!update.message,
    });
  } catch (error) {
    logger.error('[PARSE] Invalid JSON payload', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    logger.debug('[PARSE] Skipping message without text or from', {
      hasText: !!message?.text,
      hasFrom: !!message?.from,
    });
    return null;
  }

  return { update, message };
}

/**
 * Check if user is authorized based on TELEGRAM_ALLOWED_USERS env var
 */
function isUserAuthorized(env: Env, userId: number, username?: string, chatId?: number): boolean {
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

// Variables set by the middleware
export type AuthVariables = {
  webhookContext: WebhookContext;
  skipProcessing: boolean;
  unauthorized: boolean;
};

/**
 * Authorization middleware for Telegram webhook
 *
 * Sets `webhookContext` on Hono context if request is valid and authorized.
 * Sets `skipProcessing` to true if request should be skipped (no message or unauthorized).
 */
export function authorizationMiddleware(): MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVariables;
}> {
  return async (c, next) => {
    // Parse request
    const parsed = await parseWebhookRequest(c);

    if (!parsed) {
      c.set('skipProcessing', true);
      return next();
    }

    const { message } = parsed;
    const webhookCtx: WebhookContext = {
      userId: message.from!.id,
      chatId: message.chat.id,
      startTime: Date.now(),
      username: message.from!.username,
      text: message.text!,
    };

    logger.info('[WEBHOOK] Message received', { ...webhookCtx });

    // Check authorization
    const env = c.env;
    const authorized = isUserAuthorized(
      env,
      webhookCtx.userId,
      webhookCtx.username,
      webhookCtx.chatId
    );

    if (!authorized) {
      c.set('skipProcessing', true);
      c.set('unauthorized', true);
      c.set('webhookContext', webhookCtx);
      return next();
    }

    // Set context for downstream handlers
    c.set('webhookContext', webhookCtx);
    c.set('skipProcessing', false);

    return next();
  };
}
