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
  createRateLimitMiddleware,
  createTelegramAuthMiddleware,
  createTelegramParserMiddleware,
} from './middlewares/index.js';
import { processEventNotifications } from './notifications/index.js';
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
  createRateLimitMiddleware(),
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
      } else if (c.get('rateLimited')) {
        reason = 'rate_limited';
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

      // Handle rate-limited users - send friendly message explaining the limit
      if (c.get('rateLimited') && webhookCtx) {
        const rateLimitReason = c.get('rateLimitReason') ?? 'Please slow down.';
        const ctx = createTelegramContext(
          env.TELEGRAM_BOT_TOKEN,
          webhookCtx,
          env.TELEGRAM_ADMIN,
          requestId,
          env.TELEGRAM_PARSE_MODE ?? 'MarkdownV2'
        );
        try {
          assertContextComplete(ctx);
          await telegramTransport.send(ctx, `⚠️ ${rateLimitReason}`);
        } catch (validationError) {
          logger.error(`[${requestId}] [VALIDATION] Context incomplete (rate-limited user)`, {
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

    // Handle built-in commands before agent dispatch
    const messageText = webhookCtx.task ?? ctx.text;
    const commandMatch = messageText.match(/^\/(\w+)(?:\s+(.*))?$/);

    if (commandMatch) {
      const [, command, args] = commandMatch;
      logger.info(`[${requestId}] [COMMAND] Processing command`, {
        requestId,
        command,
        args,
      });

      // Handle /health command
      if (command === 'health') {
        try {
          const healthStatus = `✅ *Bot Status*

*Version*: 1.0.0
*Chat*: ${ctx.chatId}
*User*: ${ctx.username || ctx.userId}
*Time*: ${new Date().toISOString()}`;

          await telegramTransport.send(ctx, healthStatus);

          logger.info(`[${requestId}] [COMMAND] /health completed`, {
            requestId,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          logger.error(`[${requestId}] [COMMAND] /health failed`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return c.text('OK');
      }

      // Handle /start command
      if (command === 'start') {
        try {
          const welcomeMessage = `👋 *Welcome to DuyetBot!*

I'm your AI assistant powered by Claude. Here's what I can do:

💬 *Chat naturally* - Just send me a message
🔍 *Research* - Ask me to look things up
📝 *Write code* - I can help with programming
🤖 *Tasks* - I can execute various commands

*Tips*:
• In groups, mention me with @duyetbot
• Reply to my messages to continue conversations
• Use /health to check my status

Let's chat!`;

          await telegramTransport.send(ctx, welcomeMessage);

          logger.info(`[${requestId}] [COMMAND] /start completed`, {
            requestId,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          logger.error(`[${requestId}] [COMMAND] /start failed`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return c.text('OK');
      }

      // Handle /deploy command
      if (command === 'deploy') {
        try {
          // Fetch deployment info from Cloudflare
          const deployments = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/workers/scripts/duyetbot-telegram-bot/deployments`,
            {
              headers: {
                Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );

          let deployStatus = `📦 *Deployment Status*

*Environment*: ${env.ENVIRONMENT || 'production'}
*Account*: ${env.CLOUDFLARE_ACCOUNT_ID?.slice(0, 8)}...`;

          if (deployments.ok) {
            const data = (await deployments.json()) as {
              result?: Array<{
                id: string;
                created_on: string;
                metadata?: { annotations?: Array<{ name: string }> };
              }>;
            };

            if (data.result && data.result.length > 0) {
              const latest = data.result[0];
              const deployDate = new Date(latest.created_on);
              deployStatus += `

*Latest Deployment*:
• ID: ${latest.id.slice(0, 8)}...
• Date: ${deployDate.toISOString()}
• Age: ${Math.floor((Date.now() - deployDate.getTime()) / 1000 / 60)} minutes ago`;
            } else {
              deployStatus += `

*Latest Deployment*: No deployment history found`;
            }
          } else {
            deployStatus += `

*Latest Deployment*: Unable to fetch (API error)`;
          }

          deployStatus += `

*Chat*: ${ctx.chatId}
*User*: ${ctx.username || ctx.userId}`;

          await telegramTransport.send(ctx, deployStatus);

          logger.info(`[${requestId}] [COMMAND] /deploy completed`, {
            requestId,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          logger.error(`[${requestId}] [COMMAND] /deploy failed`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Send a simple fallback message
          await telegramTransport.send(
            ctx,
            `📦 *Deployment Status*\n\nUnable to fetch deployment info. Please try again later.`
          );
        }
        return c.text('OK');
      }

      // Handle /pr command
      if (command === 'pr') {
        try {
          if (!args) {
            await telegramTransport.send(
              ctx,
              `🔀 *PR Status*\n\nUsage: \`/pr <number>\`\n\nExample: \`/pr 123\``
            );
            return c.text('OK');
          }

          // Parse PR number from args
          const prNumber = parseInt(args.trim(), 10);
          if (Number.isNaN(prNumber)) {
            await telegramTransport.send(ctx, `❌ Invalid PR number. Usage: \`/pr <number>\``);
            return c.text('OK');
          }

          // Fetch PR from GitHub API
          const response = await fetch(
            `https://api.github.com/repos/duyet/duyetbot-agent/pulls/${prNumber}`,
            {
              headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'duyetbot-telegram',
              },
            }
          );

          if (!response.ok) {
            if (response.status === 404) {
              await telegramTransport.send(ctx, `❌ PR #${prNumber} not found`);
            } else if (response.status === 401) {
              await telegramTransport.send(
                ctx,
                `❌ GitHub authentication failed. Check GITHUB_TOKEN.`
              );
            } else {
              await telegramTransport.send(
                ctx,
                `❌ Failed to fetch PR #${prNumber} (HTTP ${response.status})`
              );
            }
            return c.text('OK');
          }

          const pr = (await response.json()) as {
            number: number;
            title: string;
            state: 'open' | 'closed';
            user: { login: string };
            created_at: string;
            updated_at: string;
            html_url: string;
            additions: number;
            deletions: number;
            changed_files: number;
            body?: string;
          };

          const createdAt = new Date(pr.created_at);
          const updatedAt = new Date(pr.updated_at);
          const age = Math.floor((Date.now() - createdAt.getTime()) / 1000 / 60 / 60 / 24);

          // Build PR status message
          const statusEmoji = pr.state === 'open' ? '🟢' : '🔴';
          let prMessage = `${statusEmoji} *PR #${prNumber}*

*Title*: ${pr.title}
*Status*: ${pr.state === 'open' ? 'Open' : 'Closed'}
*Author*: @${pr.user.login}
*Created*: ${age > 0 ? `${age}d ago` : 'today'}
*Updated*: ${Math.floor((Date.now() - updatedAt.getTime()) / 1000 / 60)}m ago`;

          if (pr.state === 'open') {
            prMessage += `

*Changes*:
• +${pr.additions} -${pr.deletions} files
• ${pr.changed_files} file(s) changed`;
          }

          prMessage += `

[View PR](${pr.html_url})`;

          await telegramTransport.send(ctx, prMessage);

          logger.info(`[${requestId}] [COMMAND] /pr completed`, {
            requestId,
            prNumber,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          logger.error(`[${requestId}] [COMMAND] /pr failed`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          await telegramTransport.send(ctx, `❌ Failed to fetch PR info. Please try again later.`);
        }
        return c.text('OK');
      }

      // Handle /review command - AI code review for PR
      if (command === 'review') {
        try {
          if (!args) {
            await telegramTransport.send(
              ctx,
              `🔍 *PR Review*\n\nUsage: \`/review <number>\`\n\nExample: \`/review 123\``
            );
            return c.text('OK');
          }

          // Parse PR number from args
          const prNumber = parseInt(args.trim(), 10);
          if (Number.isNaN(prNumber)) {
            await telegramTransport.send(ctx, `❌ Invalid PR number. Usage: \`/review <number>\``);
            return c.text('OK');
          }

          // Send initial message
          await telegramTransport.send(
            ctx,
            `🔍 *Reviewing PR #${prNumber}*\n\nFetching PR details and diff...`
          );

          // Fetch PR from GitHub API
          const prResponse = await fetch(
            `https://api.github.com/repos/duyet/duyetbot-agent/pulls/${prNumber}`,
            {
              headers: {
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'duyetbot-telegram',
              },
            }
          );

          if (!prResponse.ok) {
            if (prResponse.status === 404) {
              await telegramTransport.send(ctx, `❌ PR #${prNumber} not found`);
            } else if (prResponse.status === 401) {
              await telegramTransport.send(
                ctx,
                `❌ GitHub authentication failed. Check GITHUB_TOKEN.`
              );
            } else {
              await telegramTransport.send(
                ctx,
                `❌ Failed to fetch PR #${prNumber} (HTTP ${prResponse.status})`
              );
            }
            return c.text('OK');
          }

          const pr = (await prResponse.json()) as {
            number: number;
            title: string;
            state: 'open' | 'closed';
            user: { login: string };
            body?: string;
            html_url: string;
            diff_url: string;
          };

          // Fetch PR diff
          const diffResponse = await fetch(pr.diff_url, {
            headers: {
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              'User-Agent': 'duyetbot-telegram',
            },
          });

          let diffContent = '';
          if (diffResponse.ok) {
            diffContent = await diffResponse.text();
            // Truncate diff if too large (limit to ~50k chars)
            if (diffContent.length > 50000) {
              diffContent = `${diffContent.slice(0, 50000)}\n\n... (truncated)`;
            }
          }

          // Build review prompt
          const reviewPrompt = `Please review PR #${prNumber}: "${pr.title}" by @${pr.user.login}

${pr.body ? `PR Description:\n${pr.body}\n\n` : ''}

Please analyze:
1. **Code Quality**: Identify bugs, logic errors, security issues, or anti-patterns
2. **Best Practices**: Check adherence to project conventions and TypeScript/JavaScript best practices
3. **Potential Issues**: Highlight edge cases, error handling gaps, or performance concerns
4. **Suggestions**: Provide specific, actionable improvement recommendations

${diffContent ? `Diff:\n\`\`\`diff\n${diffContent}\n\`\`\`` : '(No diff available)'}

Provide your review in a structured format with clear sections.`;

          // Get agent for review dispatch
          const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;
          const reviewAgent = getChatAgent(env.TelegramAgent, agentId);

          // Create review input for agent
          const reviewParsedInput: ParsedInput = {
            text: reviewPrompt,
            userId: ctx.userId,
            chatId: ctx.chatId,
            username: ctx.username,
            messageRef: ctx.messageId,
            replyTo: ctx.replyToMessageId,
            metadata: {
              platform: 'telegram',
              requestId,
              eventId, // Full UUID for D1 observability correlation
              traceId: `telegram:${ctx.chatId}:${Date.now()}`,
              startTime: ctx.startTime,
              adminUsername: ctx.adminUsername,
              parseMode: ctx.parseMode,
              isAdmin: ctx.isAdmin,
              isReview: true, // Mark as review request for special handling
            },
          };

          logger.info(`[${requestId}] [COMMAND] /review dispatching to agent`, {
            requestId,
            prNumber,
            diffSize: diffContent.length,
          });

          // Dispatch to agent for AI review
          c.executionCtx.waitUntil(
            (async () => {
              try {
                await reviewAgent.receiveMessage(reviewParsedInput);
              } catch (error) {
                logger.error(`[${requestId}] [COMMAND] /review agent failed`, {
                  requestId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            })()
          );

          logger.info(`[${requestId}] [COMMAND] /review completed`, {
            requestId,
            prNumber,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          logger.error(`[${requestId}] [COMMAND] /review failed`, {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          await telegramTransport.send(
            ctx,
            `❌ Failed to start PR review. Please try again later.`
          );
        }
        return c.text('OK');
      }
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
      // messageText was already defined above for command handling

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

/**
 * Scheduled handler for Event Bridge notification processing
 *
 * Runs on cron schedule (every 5 minutes) to:
 * 1. Poll Event Bridge for new cross-agent events
 * 2. Filter events based on admin preferences
 * 3. Send formatted notifications to admin chat
 *
 * This enables the Telegram bot to receive notifications about:
 * - GitHub PR events (opened, merged, review_requested, etc.)
 * - Task completions and approvals
 * - System events from other agents
 */
async function scheduled(
  _event: ScheduledEvent,
  env: EnvWithAgent,
  _ctx: ExecutionContext
): Promise<void> {
  logger.info('[SCHEDULED] Event Bridge notification processing started');

  // Skip if D1 not configured
  if (!env.OBSERVABILITY_DB) {
    logger.debug('[SCHEDULED] D1 not configured, skipping');
    return;
  }

  // Get admin chat ID from env
  const adminChatId = env.TELEGRAM_FORWARD_CHAT_ID ?? env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) {
    logger.debug('[SCHEDULED] No admin chat ID configured, skipping');
    return;
  }

  try {
    // Type assertion needed: D1Database types from different packages
    // are structurally identical but TypeScript sees them as distinct
    const result = await processEventNotifications(
      env.OBSERVABILITY_DB as unknown as D1Database,
      env.TELEGRAM_BOT_TOKEN,
      Number(adminChatId)
    );

    logger.info('[SCHEDULED] Event Bridge processing complete', {
      eventsProcessed: result.eventsProcessed,
      notificationsSent: result.notificationsSent,
      lastSequence: result.lastSequence,
      errors: result.errors.length,
    });
  } catch (error) {
    logger.error('[SCHEDULED] Event Bridge processing failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
