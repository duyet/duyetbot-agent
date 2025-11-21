/**
 * Telegram Bot Entry Point
 *
 * Telegraf-based bot for @duyetbot
 */

import { Context, Telegraf } from 'telegraf';
import {
  clearCommand,
  helpCommand,
  sessionsCommand,
  startCommand,
  statusCommand,
} from './commands/index.js';
import { handleMessage, isUserAllowed } from './handlers/message.js';
import { TelegramSessionManager, createMCPClient, createSessionId } from './session-manager.js';
import type { BotConfig, TelegramUser } from './types.js';

export { TelegramSessionManager, createMCPClient, createSessionId } from './session-manager.js';
export { handleMessage, isUserAllowed } from './handlers/message.js';
export type { BotConfig, TelegramUser, ChatSession, CommandContext } from './types.js';

/**
 * Create Telegram bot
 */
export function createTelegramBot(config: BotConfig): {
  bot: Telegraf<Context>;
  sessionManager: TelegramSessionManager;
} {
  const bot = new Telegraf(config.botToken);

  // Initialize session manager
  let sessionManager: TelegramSessionManager;
  if (config.mcpServerUrl) {
    const mcpClient = createMCPClient(config.mcpServerUrl, config.mcpAuthToken);
    sessionManager = new TelegramSessionManager(mcpClient);
  } else {
    sessionManager = new TelegramSessionManager();
  }

  // Helper to extract user info
  const getUser = (ctx: {
    from?: { id: number; username?: string; first_name: string; last_name?: string };
  }): TelegramUser | null => {
    if (!ctx.from) {
      return null;
    }
    return {
      id: ctx.from.id,
      username: ctx.from.username,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
    };
  };

  // Authorization middleware
  bot.use(async (ctx: Context, next: () => Promise<void>) => {
    const user = getUser(ctx);
    if (!user) {
      return;
    }

    if (!isUserAllowed(user.id, config.allowedUsers)) {
      await ctx.reply('Sorry, you are not authorized to use this bot.');
      return;
    }

    await next();
  });

  // /start command
  bot.command('start', async (ctx) => {
    const result = startCommand();
    await ctx.reply(result.text, { parse_mode: result.parseMode });
  });

  // /help command
  bot.command('help', async (ctx) => {
    const result = helpCommand();
    await ctx.reply(result.text, { parse_mode: result.parseMode });
  });

  // /status command
  bot.command('status', async (ctx) => {
    const result = statusCommand(sessionManager);
    await ctx.reply(result.text, { parse_mode: result.parseMode });
  });

  // /clear command
  bot.command('clear', async (ctx) => {
    const user = getUser(ctx);
    if (!user) {
      return;
    }

    const sessionId = createSessionId(user.id, ctx.chat.id);
    const result = await clearCommand(sessionId, sessionManager);
    await ctx.reply(result.text, { parse_mode: result.parseMode });
  });

  // /sessions command
  bot.command('sessions', async (ctx) => {
    const user = getUser(ctx);
    if (!user) {
      return;
    }

    const sessionId = createSessionId(user.id, ctx.chat.id);
    const result = sessionsCommand(sessionId);
    await ctx.reply(result.text, { parse_mode: result.parseMode });
  });

  // /chat command with inline message
  bot.command('chat', async (ctx) => {
    const user = getUser(ctx);
    if (!user) {
      return;
    }

    const text = ctx.message.text.replace(/^\/chat\s*/, '').trim();
    if (!text) {
      await ctx.reply('Please provide a message. Example: /chat Hello!');
      return;
    }

    // Show typing indicator
    await ctx.sendChatAction('typing');

    const response = await handleMessage(text, user, ctx.chat.id, config, sessionManager);
    await ctx.reply(response, { parse_mode: 'Markdown' }).catch(() => {
      // Retry without markdown if parsing fails
      return ctx.reply(response);
    });
  });

  // Handle regular text messages
  bot.on('text', async (ctx) => {
    const user = getUser(ctx);
    if (!user) {
      return;
    }

    const text = ctx.message.text;

    // Show typing indicator
    await ctx.sendChatAction('typing');

    const response = await handleMessage(text, user, ctx.chat.id, config, sessionManager);
    await ctx.reply(response, { parse_mode: 'Markdown' }).catch(() => {
      // Retry without markdown if parsing fails
      return ctx.reply(response);
    });
  });

  // Error handling
  bot.catch((err: unknown, ctx: Context) => {
    console.error('Telegram bot error:', err);
    ctx.reply('Sorry, an error occurred. Please try again.').catch(console.error);
  });

  return { bot, sessionManager };
}

/**
 * Start the bot in polling mode (development)
 */
export async function startPolling(config: BotConfig): Promise<void> {
  const { bot } = createTelegramBot(config);

  console.log('Starting Telegram bot in polling mode...');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await bot.launch();
  console.log('Telegram bot is running!');
}

/**
 * Start the bot in webhook mode (production)
 */
export async function startWebhook(config: BotConfig, port = 3002): Promise<void> {
  if (!config.webhookUrl) {
    throw new Error('webhookUrl is required for webhook mode');
  }

  const { bot } = createTelegramBot(config);

  console.log(`Starting Telegram bot webhook on port ${port}...`);

  await bot.launch({
    webhook: {
      domain: config.webhookUrl,
      port,
      secretToken: config.webhookSecretPath,
    },
  });

  console.log('Telegram bot webhook is running!');

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Export default for direct usage
export default createTelegramBot;
