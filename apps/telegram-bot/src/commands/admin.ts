/**
 * Admin-only commands for Telegram bot
 *
 * Provides diagnostic and status commands that are restricted to admin users.
 */

import { logger } from '@duyetbot/hono-middleware';
import type { TelegramContext } from '../transport.js';

/**
 * Handle /debug command - shows debug information about the current context
 */
export async function handleDebugCommand(ctx: TelegramContext): Promise<string> {
  if (!ctx.isAdmin) {
    return '🔒 Admin command - access denied';
  }

  const debugInfo = {
    userId: ctx.userId,
    chatId: ctx.chatId,
    username: ctx.username,
    requestId: ctx.requestId,
    hasDebugContext: !!ctx.debugContext,
    uptime: Date.now() - ctx.startTime,
  };

  return `🔍 Debug Information:\n\n${JSON.stringify(debugInfo, null, 2)}`;
}

/**
 * Handle /status command - shows system status
 */
export async function handleStatusCommand(ctx: TelegramContext): Promise<string> {
  if (!ctx.isAdmin) {
    return '🔒 Admin command - access denied';
  }

  const status = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    context: {
      chatId: ctx.chatId,
      userId: ctx.userId,
      requestId: ctx.requestId,
    },
  };

  return `📊 System Status:\n\n${JSON.stringify(status, null, 2)}`;
}

/**
 * Route admin commands to their handlers
 *
 * @param command - The command string (e.g., "/debug")
 * @param ctx - Telegram context with admin information
 * @returns Response string or undefined if command not recognized
 */
export async function handleAdminCommand(
  command: string,
  ctx: TelegramContext
): Promise<string | undefined> {
  logger.info('[ADMIN_CMD] Processing admin command', {
    command,
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
  });

  switch (command) {
    case '/debug':
      return handleDebugCommand(ctx);
    case '/status':
      return handleStatusCommand(ctx);
    default:
      return undefined;
  }
}
