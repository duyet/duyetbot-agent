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

  // Generate request ID for trace correlation across webhook and DO invocations
  const requestId = crypto.randomUUID().slice(0, 8);

  // Check if we should skip processing
  if (c.get('skipProcessing')) {
    // Handle unauthorized users
    if (c.get('unauthorized')) {
      const webhookCtx = c.get('webhookContext');
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

  const webhookCtx = c.get('webhookContext');

  // Create transport context with requestId for trace correlation
  const ctx = createTelegramContext(
    env.TELEGRAM_BOT_TOKEN,
    webhookCtx,
    env.TELEGRAM_ADMIN,
    requestId
  );

  // Get agent by name (consistent with github-bot pattern)
  const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;
  logger.info(`[${requestId}] [WEBHOOK] Getting agent`, {
    agentId,
    requestId,
  });

  // Fire-and-forget DO invocation - no waitUntil needed
  // DO runs in its own execution context with independent timeout
  // Webhook returns immediately to prevent Telegram retries (>10s causes duplicate messages)
  try {
    const agent = getChatAgent(env.TelegramAgent, agentId);

    // Agent handles everything: commands, chat, sending response
    // Don't await - let DO run independently
    agent.handle(ctx).catch((error: unknown) => {
      logger.error('[WEBHOOK] DO invocation failed', {
        agentId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
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
  } catch (error) {
    logger.error('[WEBHOOK] Failed to get agent', {
      agentId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Return immediately to Telegram
  return c.text('OK');
});

export default app;
