/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import { getChatAgent } from '@duyetbot/chat-agent';
import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import {
  EventCollector,
  type ObservabilityEnv,
  ObservabilityStorage,
} from '@duyetbot/observability';
import { type Env, TelegramAgent } from './agent.js';
import { handleAdminCommand } from './commands/admin.js';
import {
  createTelegramAuthMiddleware,
  createTelegramParserMiddleware,
} from './middlewares/index.js';
import { createTelegramContext, telegramTransport } from './transport.js';

// Extend Env to include observability bindings
type EnvWithObservability = Env & ObservabilityEnv;

// Re-export local agent for Durable Object binding
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-agents via script_name
export { TelegramAgent };

const app = createBaseApp<EnvWithObservability>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Telegram webhook handler
app.post(
  '/webhook',
  createTelegramWebhookAuth<EnvWithObservability>(),
  createTelegramParserMiddleware(),
  createTelegramAuthMiddleware(),
  async (c) => {
    const env = c.env;
    const startTime = Date.now();

    // Generate request ID for trace correlation across webhook and DO invocations
    const requestId = crypto.randomUUID().slice(0, 8);

    // Initialize observability collector
    let collector: EventCollector | null = null;
    let storage: ObservabilityStorage | null = null;

    if (env.OBSERVABILITY_DB) {
      storage = new ObservabilityStorage(env.OBSERVABILITY_DB);
      collector = new EventCollector({
        eventId: crypto.randomUUID(),
        appSource: 'telegram-webhook',
        eventType: 'message',
        triggeredAt: startTime,
        requestId,
      });
      collector.markProcessing();
    }

    // Log incoming webhook (webhookCtx is set by parser middleware)
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

      // Handle unauthorized users - webhookCtx is set by auth middleware for unauthorized users
      if (c.get('unauthorized') && webhookCtx) {
        const ctx = createTelegramContext(
          env.TELEGRAM_BOT_TOKEN,
          webhookCtx,
          env.TELEGRAM_ADMIN,
          requestId,
          env.TELEGRAM_PARSE_MODE
        );
        await telegramTransport.send(ctx, 'Sorry, you are not authorized.');
      }
      return c.text('OK');
    }

    // At this point, skipProcessing is false, so webhookCtx must be defined
    // Parser middleware ensures webhookCtx is set when skipProcessing is false
    if (!webhookCtx) {
      logger.error(`[${requestId}] [WEBHOOK] Missing webhookContext`, {
        requestId,
        durationMs: Date.now() - startTime,
      });
      return c.text('OK');
    }

    // Create transport context with requestId for trace correlation
    const ctx = createTelegramContext(
      env.TELEGRAM_BOT_TOKEN,
      webhookCtx,
      env.TELEGRAM_ADMIN,
      requestId,
      env.TELEGRAM_PARSE_MODE
    );

    // Set observability context
    if (collector) {
      collector.setContext({
        userId: String(ctx.userId),
        username: ctx.username,
        chatId: String(ctx.chatId),
      });
      collector.setInput(ctx.text);
    }

    // Check for admin commands
    if (ctx.text.startsWith('/')) {
      const response = await handleAdminCommand(ctx.text, ctx);
      if (response !== undefined) {
        logger.info(`[${requestId}] [WEBHOOK] Admin command executed`, {
          requestId,
          command: ctx.text,
          isAdmin: ctx.isAdmin,
          durationMs: Date.now() - startTime,
        });
        await telegramTransport.send(ctx, response);
        return c.text('OK');
      }
    }

    // Get agent by name (consistent with github-bot pattern)
    const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;

    logger.info(`[${requestId}] [WEBHOOK] Creating agent`, {
      requestId,
      agentId,
      ctx,
    });

    // Queue message for batch processing with alarm-based execution
    // Messages arriving within 500ms are combined into a single LLM call
    // This handles rapid typing, corrections, and multi-message input naturally
    try {
      const agent = getChatAgent(env.TelegramAgent, agentId);

      logger.info(`[${requestId}] [WEBHOOK] Queueing message for batch processing`, {
        requestId,
        agentId,
        ctx,
        durationMs: Date.now() - startTime,
      });

      // Queue message - alarm will fire after batch window (500ms by default)
      // Await to ensure message is queued before returning
      const { queued, batchId } = await agent.queueMessage(ctx);

      logger.info(`[${requestId}] [WEBHOOK] Message queued`, {
        requestId,
        agentId,
        queued,
        batchId,
        ctx,
        durationMs: Date.now() - startTime,
      });

      // Complete observability event on success
      if (collector) {
        collector.complete({ status: 'success' });
      }
    } catch (error) {
      logger.error(`[${requestId}] [WEBHOOK] Failed to queue message`, {
        requestId,
        agentId,
        ctx,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });

      // Complete observability event on error
      if (collector) {
        collector.complete({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Send error message to user if queueing fails
      await telegramTransport
        .send(ctx, '❌ Sorry, an error occurred. Please try again later.')
        .catch(() => {
          // Ignore if we can't send the error message
        });
    } finally {
      // Write observability event to D1 (fire-and-forget)
      if (collector && storage) {
        storage.writeEvent(collector.toEvent()).catch((err) => {
          logger.error(`[${requestId}] [OBSERVABILITY] Failed to write event`, {
            requestId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }
    }

    // Return immediately to Telegram
    return c.text('OK');
  }
);

export default app;
