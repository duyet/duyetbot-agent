/**
 * /status command - Check bot status
 */

import type { Context } from 'telegraf';
import type { TelegramSessionManager } from '../session-manager.js';
import { createTelegramSessionId } from '../session-manager.js';

export async function handleStatus(
  ctx: Context,
  sessionManager: TelegramSessionManager,
  startTime: number
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  const session = await sessionManager.getSession(user.id);
  const sessionId = createTelegramSessionId(user.id);
  const messages = await sessionManager.getMessages(sessionId);

  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;

  const uptimeStr =
    hours > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : minutes > 0
        ? `${minutes}m ${seconds}s`
        : `${seconds}s`;

  await ctx.reply(
    `**Bot Status**

Status: Online
Uptime: ${uptimeStr}

**Your Session**
Session ID: \`${session.sessionId}\`
Messages: ${messages.length}
Created: ${new Date(session.createdAt).toLocaleString()}
Updated: ${new Date(session.updatedAt).toLocaleString()}`,
    { parse_mode: 'Markdown' }
  );
}
