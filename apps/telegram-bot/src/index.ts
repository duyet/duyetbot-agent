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

// Extend Env with agent bindings and observability
type EnvWithAgent = Env & ObservabilityEnv;

// Re-export local agent for Durable Object binding
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-shared-agents via script_name
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

    // Generate IDs for trace correlation across webhook and DO invocations
    // - eventId: Full UUID for D1 uniqueness (passed to agent for correlation)
    // - requestId: Short ID for log readability
    const eventId = crypto.randomUUID();
    const requestId = eventId.slice(0, 8);

    // Initialize observability collector (same pattern as github-bot)
    let collector: EventCollector | null = null;
    let storage: ObservabilityStorage | null = null;

    if (env.OBSERVABILITY_DB) {
      storage = new ObservabilityStorage(env.OBSERVABILITY_DB);
      collector = new EventCollector({
        eventId, // Full UUID for D1 uniqueness
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
      // Determine skip reason for logging
      let reason = 'skip_flag';
      if (c.get('unauthorized')) {
        reason = 'unauthorized';
      } else if (webhookCtx?.isGroupChat && !webhookCtx.hasBotMention && !webhookCtx.isReply) {
        reason = 'group_not_mentioned_or_reply';
      }

      logger.info(`[${requestId}] [WEBHOOK] Skipping`, {
        requestId,
        reason,
        chatType: webhookCtx?.chatType,
        isGroupChat: webhookCtx?.isGroupChat,
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

    // Set observability context (user info for event tracking)
    // TriggerContext expects string types, but TelegramContext has number for userId/chatId
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
      // Use extracted task text if bot was mentioned (removes @mention prefix)
      const messageText = webhookCtx.task ?? ctx.text;

      const parsedInput: ParsedInput = {
        text: messageText,
        userId: ctx.userId,
        chatId: ctx.chatId,
        username: ctx.username,
        messageRef: ctx.messageId,
        replyTo: ctx.replyToMessageId,
        metadata: {
          platform: 'telegram',
          requestId,
          eventId, // Full UUID for D1 observability correlation
          startTime: ctx.startTime,
          adminUsername: ctx.adminUsername,
          parseMode: ctx.parseMode,
          isAdmin: ctx.isAdmin,
          quotedText: webhookCtx.quotedText,
          quotedUsername: webhookCtx.quotedUsername,
          chatType: webhookCtx.chatType,
          chatTitle: webhookCtx.chatTitle,
          isGroupChat: webhookCtx.isGroupChat,
          hasBotMention: webhookCtx.hasBotMention,
          isReply: webhookCtx.isReply,
          isReplyToBot: webhookCtx.isReplyToBot,
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

            // Write observability event with 'processing' status (fire-and-forget)
            // Agent will update this event to 'success' or 'error' when execution completes
            // This tracks "message received and queued" - actual completion tracked by agent
            if (collector && storage) {
              // Keep status as 'processing' - agent will update on completion
              storage.writeEvent(collector.toEvent()).catch((err) => {
                logger.error(`[${requestId}] [OBSERVABILITY] Failed to write event`, {
                  requestId,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
            }
          } catch (error) {
            // RPC failure only (rare) - DO is unreachable
            logger.error(`[${requestId}] [WEBHOOK] RPC to ChatAgent failed`, {
              requestId,
              agentId,
              error: error instanceof Error ? error.message : String(error),
              durationMs: Date.now() - startTime,
            });

            // Write observability event as error - RPC failed, agent never received message
            if (collector && storage) {
              collector.complete({
                status: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
              });
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
    }

    // Return immediately to Telegram
    return c.text('OK');
  }
);

export default app;
