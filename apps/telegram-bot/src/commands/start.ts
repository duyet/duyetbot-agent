/**
 * /start command - Initialize bot
 */

import type { Context } from 'telegraf';
import type { TelegramSessionManager } from '../session-manager.js';

export async function handleStart(
  ctx: Context,
  sessionManager: TelegramSessionManager
): Promise<void> {
  const user = ctx.from;
  if (!user) {
    await ctx.reply('Unable to identify user.');
    return;
  }

  // Create/get session
  const session = await sessionManager.getSession(user.id, {
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
  });

  const greeting = user.first_name ? `Hello, ${user.first_name}!` : 'Hello!';

  await ctx.reply(
    `${greeting} I'm duyetbot, your AI assistant.

I can help you with:
- Answering questions and having conversations
- Code explanations and debugging help
- Research and information gathering
- Task planning and organization

**Commands:**
/chat <message> - Chat with me
/status - Check bot status
/sessions - View your sessions
/help - Show this help message

Just send me a message to start chatting!`,
    { parse_mode: 'Markdown' }
  );
}
