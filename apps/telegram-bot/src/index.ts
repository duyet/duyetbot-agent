/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import type { ParsedInput } from '@duyetbot/chat-agent';
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

export type { TelegramBot } from './test-utils.js';
// Re-export test utilities for E2E testing
export { createTelegramBot, type TelegramBotConfig } from './test-utils.js';

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

    // Fire-and-forget: dispatch to ChatAgent without waiting for response
    // Uses c.executionCtx.waitUntil() to keep worker alive during processing
    // Returns immediately to Telegram (<100ms)
    try {
      const agent = getChatAgent(env.TelegramAgent, agentId);

      // Create ParsedInput for agent
      const parsedInput: ParsedInput = {
        text: ctx.text,
        userId: ctx.userId,
        chatId: ctx.chatId,
        username: ctx.username,
        metadata: {
          platform: 'telegram',
          requestId,
          startTime: ctx.startTime,
          adminUsername: ctx.adminUsername,
          parseMode: ctx.parseMode,
          isAdmin: ctx.isAdmin,
        },
      };

      logger.info(`[${requestId}] [WEBHOOK] Dispatching to ChatAgent (fire-and-forget)`, {
        requestId,
        agentId,
        text: ctx.text.substring(0, 100),
        durationMs: Date.now() - startTime,
      });

      // Fire-and-forget: schedule processing without awaiting
      // executionCtx.waitUntil() keeps the worker alive
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const result = await agent.receiveMessage(parsedInput);

            logger.info(`[${requestId}] [WEBHOOK] Message received by ChatAgent`, {
              requestId,
              agentId,
              traceId: result.traceId,
              durationMs: Date.now() - startTime,
            });

            // Complete observability event on success
            if (collector) {
              collector.complete({ status: 'success' });
            }
          } catch (error) {
            logger.error(`[${requestId}] [WEBHOOK] ChatAgent error`, {
              requestId,
              agentId,
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

            // Send error message to user
            try {
              await telegramTransport.send(
                ctx,
                '❌ Sorry, an error occurred. Please try again later.'
              );
            } catch (sendError) {
              logger.error(`[${requestId}] [WEBHOOK] Failed to send error message`, {
                requestId,
                error: sendError instanceof Error ? sendError.message : String(sendError),
              });
            }
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
        })()
      );

      logger.info(`[${requestId}] [WEBHOOK] Returning OK immediately`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });
    } catch (error) {
      logger.error(`[${requestId}] [WEBHOOK] Failed to dispatch to ChatAgent`, {
        requestId,
        agentId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });

      // Complete observability event on error
      if (collector) {
        collector.complete({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Still return OK to Telegram (we can't send error message in sync catch)
      return c.text('OK');
    }

    // Return immediately to Telegram
    return c.text('OK');
  }
);

export default app;
