/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import type { ParsedInput } from '@duyetbot/chat-agent';
import { getChatAgent } from '@duyetbot/chat-agent';
import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import { type Env, TelegramAgent } from './agent.js';
import { handleAdminCommand } from './commands/admin.js';
import {
  createTelegramAuthMiddleware,
  createTelegramParserMiddleware,
} from './middlewares/index.js';
import { createTelegramContext, telegramTransport } from './transport.js';

// Extend Env with agent bindings
type EnvWithAgent = Env;

// Re-export local agent for Durable Object binding
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-agents via script_name
export { TelegramAgent };

export type { TelegramBot } from './test-utils.js';
// Re-export test utilities for E2E testing
export { createTelegramBot, type TelegramBotConfig } from './test-utils.js';

const app = createBaseApp<EnvWithAgent>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Telegram webhook handler
app.post(
  '/webhook',
  createTelegramWebhookAuth<EnvWithAgent>(),
  createTelegramParserMiddleware(),
  createTelegramAuthMiddleware(),
  async (c) => {
    const env = c.env;
    const startTime = Date.now();

    // Generate request ID for trace correlation across webhook and DO invocations
    const requestId = crypto.randomUUID().slice(0, 8);

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

      // True fire-and-forget: schedule RPC without awaiting
      // waitUntil keeps worker alive for the RPC, but we return immediately
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const result = await agent.receiveMessage(parsedInput);
            logger.info(`[${requestId}] [WEBHOOK] Message queued`, {
              requestId,
              agentId,
              traceId: result.traceId,
              batchId: result.batchId,
              durationMs: Date.now() - startTime,
            });
          } catch (error) {
            // RPC failure only (rare) - DO is unreachable
            logger.error(`[${requestId}] [WEBHOOK] RPC to ChatAgent failed`, {
              requestId,
              agentId,
              error: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - startTime,
            });
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
    }

    // Return immediately to Telegram
    return c.text('OK');
  }
);

export default app;
