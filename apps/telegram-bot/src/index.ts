/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import { getChatAgent } from '@duyetbot/chat-agent';
import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import { type Env, TelegramAgent } from './agent.js';
import { authorizationMiddleware } from './middlewares/authorization.js';
import { createTelegramContext, telegramTransport } from './transport.js';

// Re-export local agent for Durable Object binding
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-agents via script_name
export { TelegramAgent };

const app = createBaseApp<Env>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Telegram webhook handler
app.post('/webhook', createTelegramWebhookAuth<Env>(), authorizationMiddleware(), async (c) => {
  const env = c.env;
  const startTime = Date.now();

  // Generate request ID for trace correlation across webhook and DO invocations
  const requestId = crypto.randomUUID().slice(0, 8);

  // Log incoming webhook (webhookCtx is set by authorizationMiddleware)
  const webhookCtx = c.get('webhookContext');
  logger.info(`[${requestId}] [WEBHOOK] Received`, {
    requestId,
    chatId: webhookCtx?.chatId,
    userId: webhookCtx?.userId,
    username: webhookCtx?.username,
    text: webhookCtx?.text?.substring(0, 100), // Truncate for logging
  });

  // Check if we should skip processing
  if (c.get('skipProcessing')) {
    const reason = c.get('unauthorized') ? 'unauthorized' : 'skip_flag';
    logger.info(`[${requestId}] [WEBHOOK] Skipping`, {
      requestId,
      reason,
      durationMs: Date.now() - startTime,
    });

    // Handle unauthorized users
    if (c.get('unauthorized')) {
      const ctx = createTelegramContext(
        env.TELEGRAM_BOT_TOKEN,
        webhookCtx,
        env.TELEGRAM_ADMIN,
        requestId
      );
      await telegramTransport.send(ctx, 'Sorry, you are not authorized.');
    }
    return c.text('OK');
  }

  // Create transport context with requestId for trace correlation
  const ctx = createTelegramContext(
    env.TELEGRAM_BOT_TOKEN,
    webhookCtx,
    env.TELEGRAM_ADMIN,
    requestId
  );

  // Get agent by name (consistent with github-bot pattern)
  const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;

  logger.info(`[${requestId}] [WEBHOOK] Creating agent`, {
    requestId,
    agentId,
    userId: ctx.userId,
    chatId: ctx.chatId,
    text: ctx.text?.substring(0, 100),
    isCommand: ctx.text?.startsWith('/'),
  });

  // Fire-and-forget DO invocation - no waitUntil needed
  // DO runs in its own execution context with independent timeout
  // Webhook returns immediately to prevent Telegram retries (>10s causes duplicate messages)
  try {
    const agent = getChatAgent(env.TelegramAgent, agentId);

    logger.info(`[${requestId}] [WEBHOOK] Triggering agent`, {
      requestId,
      agentId,
      durationMs: Date.now() - startTime,
    });

    // Agent handles everything: commands, chat, sending response
    // Don't await - let DO run independently
    agent.handle(ctx).catch((error: unknown) => {
      logger.error(`[${requestId}] [WEBHOOK] DO invocation failed`, {
        requestId,
        agentId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Send error message to user if DO processing fails
      // Note: This only fires when DO invocation fails before sending "Thinking..."
      // DO's internal error handling edits the thinking message for errors during processing
      telegramTransport
        .send(ctx, '❌ Sorry, an error occurred. Please try again later.')
        .catch(() => {
          // Ignore if we can't send the error message
        });
    });

    logger.info(`[${requestId}] [WEBHOOK] Returning OK`, {
      requestId,
      agentId,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error(`[${requestId}] [WEBHOOK] Failed to get agent`, {
      requestId,
      agentId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: Date.now() - startTime,
    });
  }

  // Return immediately to Telegram
  return c.text('OK');
});

export default app;
