/**
 * Message Handler
 *
 * Handles incoming text messages (not commands)
 */

import type { Context } from 'telegraf';
import type { AgentExecutor } from '../commands/chat.js';
import { handleChat } from '../commands/chat.js';
import type { TelegramSessionManager } from '../session-manager.js';
import type { TelegramBotConfig } from '../types.js';

/**
 * Handle incoming text message
 */
export async function handleMessage(
  ctx: Context,
  sessionManager: TelegramSessionManager,
  executor: AgentExecutor,
  config: TelegramBotConfig
): Promise<void> {
  // Get message text
  const message = ctx.message;
  if (!message || !('text' in message)) {
    return;
  }

  const text = message.text;

  // Skip if it's a command (starts with /)
  if (text.startsWith('/')) {
    return;
  }

  // Process as chat message
  await handleChat(ctx, text, sessionManager, executor, config);
}

/**
 * Handle callback queries (inline buttons)
 */
export async function handleCallback(
  ctx: Context,
  _sessionManager: TelegramSessionManager
): Promise<void> {
  const callbackQuery = ctx.callbackQuery;
  if (!callbackQuery || !('data' in callbackQuery)) {
    return;
  }

  const data = callbackQuery.data;

  // Handle different callback actions
  switch (data) {
    case 'confirm_clear':
      await ctx.answerCbQuery('Session cleared');
      break;
    case 'cancel':
      await ctx.answerCbQuery('Cancelled');
      break;
    default:
      await ctx.answerCbQuery();
  }
}
