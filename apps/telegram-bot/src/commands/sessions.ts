/**
 * /sessions command - List sessions
 */

import type { Context } from 'telegraf';
import type { TelegramSessionManager } from '../session-manager.js';

export async function handleSessions(
  ctx: Context,
  sessionManager: TelegramSessionManager
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  const sessions = await sessionManager.listSessions();
  const userSessions = sessions.filter((s) => s.userId === user.id);

  if (userSessions.length === 0) {
    await ctx.reply('No sessions found. Start chatting to create one!');
    return;
  }

  let message = '**Your Sessions**\n\n';

  for (const session of userSessions) {
    const date = new Date(session.updatedAt).toLocaleDateString();
    const time = new Date(session.updatedAt).toLocaleTimeString();
    message += `Session: \`${session.sessionId}\`\n`;
    message += `Messages: ${session.messageCount}\n`;
    message += `Last active: ${date} ${time}\n\n`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}
