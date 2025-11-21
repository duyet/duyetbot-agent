/**
 * /clear command - Clear session history
 */

import type { Context } from 'telegraf';
import type { TelegramSessionManager } from '../session-manager.js';

export async function handleClear(
  ctx: Context,
  sessionManager: TelegramSessionManager
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  await sessionManager.clearSession(user.id);
  await ctx.reply('Session history cleared. Start fresh!');
}
