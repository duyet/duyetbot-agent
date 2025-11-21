/**
 * Telegram Bot Entry Point
 *
 * Telegraf-based bot with Hono webhook server
 */

import { Hono } from 'hono';
import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { createSimpleExecutor, handleChat } from './commands/chat.js';
import type { AgentExecutor } from './commands/chat.js';
import { handleClear } from './commands/clear.js';
import { handleHelp } from './commands/help.js';
import { handleSessions } from './commands/sessions.js';
import { handleStart } from './commands/start.js';
import { handleStatus } from './commands/status.js';
import { handleCallback, handleMessage } from './handlers/message.js';
import { NotificationManager, createGitHubNotification } from './notifications.js';
import {
  TelegramSessionManager,
  createMCPClient,
  createTelegramSessionId,
  parseSessionId,
} from './session-manager.js';
import type { HealthResponse, TelegramBotConfig } from './types.js';

// Re-export everything
export { handleStart } from './commands/start.js';
export { handleHelp } from './commands/help.js';
export { handleStatus } from './commands/status.js';
export { handleSessions } from './commands/sessions.js';
export { handleChat, createSimpleExecutor } from './commands/chat.js';
export type { AgentExecutor } from './commands/chat.js';
export { handleClear } from './commands/clear.js';
export { handleMessage, handleCallback } from './handlers/message.js';
export {
  TelegramSessionManager,
  createTelegramSessionId,
  parseSessionId,
  createMCPClient,
} from './session-manager.js';
export type { MCPMemoryClient } from './session-manager.js';
export { NotificationManager, createGitHubNotification } from './notifications.js';
export type {
  TelegramBotConfig,
  TelegramSessionData,
  ChatContext,
  AgentMessage,
  NotificationType,
  NotificationPayload,
  UserSubscription,
  CommandResult,
  HealthResponse,
} from './types.js';

/**
 * Create Telegram bot with all commands
 */
export function createTelegramBot(config: TelegramBotConfig): {
  bot: Telegraf<Context>;
  sessionManager: TelegramSessionManager;
  notificationManager: NotificationManager;
  startTime: number;
} {
  const bot = new Telegraf(config.botToken);
  const sessionManager = new TelegramSessionManager(config.mcpServerUrl, config.mcpAuthToken);
  const notificationManager = new NotificationManager(bot);
  const executor: AgentExecutor = createSimpleExecutor();
  const startTime = Date.now();

  // Register commands
  bot.command('start', async (ctx) => {
    await handleStart(ctx, sessionManager);
  });

  bot.command('help', async (ctx) => {
    await handleHelp(ctx);
  });

  bot.command('status', async (ctx) => {
    await handleStatus(ctx, sessionManager, startTime);
  });

  bot.command('sessions', async (ctx) => {
    await handleSessions(ctx, sessionManager);
  });

  bot.command('chat', async (ctx) => {
    const text = ctx.message?.text || '';
    await handleChat(ctx, text, sessionManager, executor, config);
  });

  bot.command('clear', async (ctx) => {
    await handleClear(ctx, sessionManager);
  });

  // Handle text messages (not commands)
  bot.on('text', async (ctx) => {
    await handleMessage(ctx, sessionManager, executor, config);
  });

  // Handle callback queries
  bot.on('callback_query', async (ctx) => {
    await handleCallback(ctx, sessionManager);
  });

  // Error handling
  bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
  });

  return { bot, sessionManager, notificationManager, startTime };
}

/**
 * Create Hono webhook server
 */
export function createWebhookServer(
  bot: Telegraf<Context>,
  notificationManager: NotificationManager,
  config: TelegramBotConfig,
  startTime: number
): Hono {
  const app = new Hono();

  // Health check
  app.get('/health', (c) => {
    const response: HealthResponse = {
      status: 'ok',
      bot: 'duyetbot-telegram',
      uptime: Date.now() - startTime,
      version: '0.1.0',
    };
    return c.json(response);
  });

  // Telegram webhook endpoint
  app.post('/webhook/telegram', async (c) => {
    const body = await c.req.json();

    // Verify secret if configured
    const token = c.req.header('x-telegram-bot-api-secret-token');
    if (config.webhookSecret && token !== config.webhookSecret) {
      return c.json({ error: 'Invalid secret' }, 401);
    }

    try {
      await bot.handleUpdate(body);
      return c.json({ ok: true });
    } catch (error) {
      console.error('Telegram webhook error:', error);
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // GitHub webhook endpoint for notifications
  app.post('/webhook/github', async (c) => {
    const event = c.req.header('x-github-event');
    if (!event) {
      return c.json({ error: 'Missing event header' }, 400);
    }

    const payload = await c.req.json();
    const notification = createGitHubNotification(event, payload);

    if (notification) {
      const sent = await notificationManager.broadcast(notification);
      return c.json({ ok: true, sent });
    }

    return c.json({ ok: true, sent: 0 });
  });

  // Subscribe to notifications
  app.post('/subscribe', async (c) => {
    const body = await c.req.json();
    const { userId, chatId, notifications, repositories } = body;

    notificationManager.subscribe(userId, chatId, notifications, repositories);
    return c.json({ ok: true });
  });

  // Unsubscribe
  app.post('/unsubscribe', async (c) => {
    const body = await c.req.json();
    const { userId } = body;

    notificationManager.unsubscribe(userId);
    return c.json({ ok: true });
  });

  return app;
}

/**
 * Start bot in polling mode (development)
 */
export async function startPolling(config: TelegramBotConfig): Promise<void> {
  const {
    bot,
    sessionManager: _sessionManager,
    notificationManager: _notificationManager,
    startTime: _startTime,
  } = createTelegramBot(config);

  console.log('Starting Telegram bot in polling mode...');
  await bot.launch();

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

/**
 * Start bot in webhook mode (production)
 */
export async function startWebhook(config: TelegramBotConfig, port = 3002): Promise<void> {
  const {
    bot,
    sessionManager: _sessionManager,
    notificationManager,
    startTime,
  } = createTelegramBot(config);
  const app = createWebhookServer(bot, notificationManager, config, startTime);

  // Set webhook
  if (config.webhookUrl) {
    await bot.telegram.setWebhook(config.webhookUrl, {
      secret_token: config.webhookSecret,
    });
    console.log(`Webhook set to: ${config.webhookUrl}`);
  }

  console.log(`Starting Telegram bot webhook server on port ${port}`);

  // Note: Actual server start depends on runtime
  return new Promise(() => {
    // Keep running
  });
}

// Default export
export default createTelegramBot;
