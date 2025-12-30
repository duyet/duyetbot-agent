/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import type {
  CallbackContext as CloudflareCallbackContext,
  ParsedInput,
} from '@duyetbot/cloudflare-agent';
import { assertContextComplete, getChatAgent } from '@duyetbot/cloudflare-agent';
import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import {
  EventCollector,
  type ObservabilityEnv,
  ObservabilityStorage,
} from '@duyetbot/observability';
import { type Env, TelegramAgent } from './agent.js';
import {
  createTelegramAuthMiddleware,
  createTelegramParserMiddleware,
} from './middlewares/index.js';
import { answerCallbackQuery, createTelegramContext, telegramTransport } from './transport.js';

// Extend Env with agent bindings and observability
type EnvWithAgent = Env & ObservabilityEnv;

// Re-export local agent for Durable Object binding
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
    const callbackCtx = c.get('callbackContext');

    if (webhookCtx) {
      logger.info(`[${requestId}] [WEBHOOK] Received`, {
        requestId,
        chatId: webhookCtx.chatId,
        userId: webhookCtx.userId,
        username: webhookCtx.username,
        text: webhookCtx.text?.substring(0, 100), // Truncate for logging
      });
    } else if (callbackCtx) {
      logger.info(`[${requestId}] [WEBHOOK] Received callback`, {
        requestId,
        callbackQueryId: callbackCtx.callbackQueryId,
        chatId: callbackCtx.chatId,
        userId: callbackCtx.userId,
        username: callbackCtx.username,
        data: callbackCtx.data.substring(0, 100),
      });
    }

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
          env.TELEGRAM_PARSE_MODE ?? 'MarkdownV2'
        );
        // ✅ Validate context even for error responses
        try {
          assertContextComplete(ctx);
          await telegramTransport.send(ctx, 'Sorry, you are not authorized.');
        } catch (validationError) {
          logger.error(`[${requestId}] [VALIDATION] Context incomplete (unauthorized user)`, {
            requestId,
            error:
              validationError instanceof Error ? validationError.message : String(validationError),
          });
        }
      }
      return c.text('OK');
    }

    // At this point, skipProcessing is false, so either webhookCtx or callbackCtx must be defined
    // Handle callback query (inline keyboard button clicks)
    if (callbackCtx) {
      logger.info(`[${requestId}] [CALLBACK] Processing callback query`, {
        requestId,
        callbackQueryId: callbackCtx.callbackQueryId,
        chatId: callbackCtx.chatId,
      });

      // Acknowledge the callback query to Telegram (removes loading animation)
      // Must be done within 30 seconds of receiving the callback
      c.executionCtx.waitUntil(
        answerCallbackQuery(env.TELEGRAM_BOT_TOKEN, callbackCtx.callbackQueryId)
      );

      // TODO: Stream 3 will implement receiveCallback() RPC method on CloudflareChatAgent
      // For now, we dispatch to receiveCallback() once it's available
      const agentId = `telegram:${callbackCtx.userId}:${callbackCtx.chatId}`;
      logger.info(`[${requestId}] [CALLBACK] Dispatching to agent`, {
        requestId,
        agentId,
        callbackQueryId: callbackCtx.callbackQueryId,
      });

      try {
        const agent = getChatAgent(env.TelegramAgent, agentId);

        // Convert local CallbackContext (with startTime) to cloudflare CallbackContext
        const cfCallbackCtx: CloudflareCallbackContext = {
          callbackQueryId: callbackCtx.callbackQueryId,
          chatId: callbackCtx.chatId,
          messageId: callbackCtx.messageId,
          userId: callbackCtx.userId,
          username: callbackCtx.username,
          data: callbackCtx.data,
        };

        // Fire-and-forget: dispatch to ChatAgent without waiting for response
        // Uses c.executionCtx.waitUntil() to keep worker alive during processing
        // Returns immediately to Telegram (<100ms)
        c.executionCtx.waitUntil(
          (async () => {
            try {
              const result = await agent.receiveCallback(cfCallbackCtx);
              logger.info(`[${requestId}] [CALLBACK] Callback queued`, {
                requestId,
                agentId,
                callbackQueryId: callbackCtx.callbackQueryId,
                durationMs: Date.now() - startTime,
                resultMessage: result.text,
              });
            } catch (error) {
              logger.error(`[${requestId}] [CALLBACK] RPC to ChatAgent failed`, {
                requestId,
                agentId,
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startTime,
              });
            }
          })()
        );

        logger.info(`[${requestId}] [CALLBACK] Returning OK immediately`, {
          requestId,
          agentId,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error(`[${requestId}] [CALLBACK] Failed to dispatch to ChatAgent`, {
          requestId,
          agentId,
          error: error instanceof Error ? error.message : String(error),
          durationMs: Date.now() - startTime,
        });
      }

      return c.text('OK');
    }

    // Handle regular message
    if (!webhookCtx) {
      logger.error(`[${requestId}] [WEBHOOK] Missing webhookContext`, {
        requestId,
        durationMs: Date.now() - startTime,
      });
      return c.text('OK');
    }

    // Create transport context
    // Default to MarkdownV2 (LLMs generate Markdown naturally)
    const ctx = createTelegramContext(
      env.TELEGRAM_BOT_TOKEN,
      webhookCtx,
      env.TELEGRAM_ADMIN,
      requestId,
      env.TELEGRAM_PARSE_MODE ?? 'MarkdownV2'
    );

    // ✅ Validate context completeness before proceeding
    // This ensures all required fields are present for downstream operations
    try {
      assertContextComplete(ctx);
    } catch (validationError) {
      logger.error(`[${requestId}] [VALIDATION] Context incomplete`, {
        requestId,
        error: validationError instanceof Error ? validationError.message : String(validationError),
        durationMs: Date.now() - startTime,
      });
      if (collector) {
        collector.complete({
          status: 'error',
          error:
            validationError instanceof Error ? validationError : new Error(String(validationError)),
        });
      }
      return c.text('OK');
    }

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

    // Get agent by name (needed for slash commands that require RPC)
    const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;
    const agent = getChatAgent(env.TelegramAgent, agentId);

    // Generate traceId for logging correlation
    const traceId = `telegram:${ctx.chatId}:${Date.now()}`;

    logger.info(`[${requestId}] [WEBHOOK] Agent ready`, {
      requestId,
      agentId,
      traceId,
    });

    // Fire-and-forget: dispatch to ChatAgent without waiting for response
    // Uses c.executionCtx.waitUntil() to keep worker alive during processing
    // Returns immediately to Telegram (<100ms)
    try {
      // Create ParsedInput for agent (backward compatibility)
      // The agent will accept both ParsedInput (legacy) and GlobalContext (new)
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
          traceId,
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
          // Token for transport reconstruction in Durable Object
          botToken: c.env.TELEGRAM_BOT_TOKEN,
        },
      };

      // Write observability event FIRST with 'processing' status
      // This ensures the event_id exists in observability_events before the agent
      // tries to persist chat_messages with this event_id as a foreign key
      if (collector && storage) {
        try {
          await storage.writeEvent(collector.toEvent());
          logger.debug(`[${requestId}] [OBSERVABILITY] Event created`, { requestId, eventId });
        } catch (err) {
          logger.error(`[${requestId}] [OBSERVABILITY] Failed to write event`, {
            requestId,
            error: err instanceof Error ? err.message : String(err),
          });
          // Clear eventId from metadata so agent doesn't try to use invalid FK
          parsedInput.metadata = { ...parsedInput.metadata, eventId: undefined };
        }
      }

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

            // Update observability event as error - RPC failed, agent never received message
            if (collector && storage) {
              collector.complete({
                status: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
              });
              storage.writeEvent(collector.toEvent()).catch((err) => {
                logger.error(`[${requestId}] [OBSERVABILITY] Failed to update event`, {
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

/**
 * Request body for internal forward endpoint
 */
interface ForwardRequestBody {
  message: string;
  priority?: 'low' | 'normal' | 'high';
  source?: string;
}

/**
 * Response for successful forward
 */
interface ForwardSuccessResponse {
  success: true;
  message_id: number;
}

/**
 * Response for failed forward
 */
interface ForwardErrorResponse {
  success: false;
  error: string;
}

// Internal endpoint for receiving forwarded messages from web app
// Secured with shared secret authentication
app.post('/internal/forward', async (c) => {
  // Verify shared secret for authentication
  const forwardSecret = c.req.header('X-Forward-Secret');
  if (forwardSecret !== c.env.FORWARD_SECRET) {
    logger.warn('[INTERNAL/FORWARD] Unauthorized forward attempt', {
      hasSecret: !!forwardSecret,
      source: c.req.header('X-Forward-Source'),
    });
    return c.json<ForwardErrorResponse>({ success: false, error: 'Unauthorized' }, 401);
  }

  // Parse and validate request body
  let body: ForwardRequestBody;
  try {
    body = await c.req.json<ForwardRequestBody>();
  } catch {
    return c.json<ForwardErrorResponse>({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const { message, priority = 'normal', source = 'web' } = body;

  // Validate required fields
  if (!message || typeof message !== 'string') {
    return c.json<ForwardErrorResponse>(
      { success: false, error: 'Message is required and must be a string' },
      400
    );
  }

  // Get forward chat ID from environment
  const forwardChatId = c.env.TELEGRAM_FORWARD_CHAT_ID;
  if (!forwardChatId) {
    logger.error('[INTERNAL/FORWARD] TELEGRAM_FORWARD_CHAT_ID not configured');
    return c.json<ForwardErrorResponse>(
      { success: false, error: 'Forward destination not configured' },
      500
    );
  }

  // Format message with prefix and metadata
  const priorityEmoji = priority === 'high' ? '' : priority === 'low' ? '' : '';
  const messageText = `[Web Forward]${priorityEmoji}\n${message}`;

  try {
    // Send message to Telegram via Bot API
    const response = await fetch(
      `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: forwardChatId,
          text: messageText,
          parse_mode: 'HTML',
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      logger.error('[INTERNAL/FORWARD] Telegram API error', {
        status: response.status,
        error,
        chatId: forwardChatId,
      });
      return c.json<ForwardErrorResponse>({ success: false, error: 'Failed to send message' }, 502);
    }

    const result = await response.json<{ result: { message_id: number } }>();
    const messageId = result.result.message_id;

    logger.info('[INTERNAL/FORWARD] Message forwarded successfully', {
      messageId,
      source,
      priority,
      messageLength: message.length,
    });

    return c.json<ForwardSuccessResponse>({
      success: true,
      message_id: messageId,
    });
  } catch (error) {
    logger.error('[INTERNAL/FORWARD] Failed to send message', {
      error: error instanceof Error ? error.message : String(error),
      source,
    });
    return c.json<ForwardErrorResponse>({ success: false, error: 'Internal server error' }, 500);
  }
});

export default app;
