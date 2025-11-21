/**
 * /help command - Show help
 */

import type { Context } from 'telegraf';

export async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    `**duyetbot Help**

**Chat Commands:**
/chat <message> - Chat with the AI assistant
/status - Check bot and session status
/sessions - List your recent sessions
/clear - Clear current session history
/help - Show this help message

**Tips:**
- You can also just send a message without /chat
- The bot remembers your conversation history
- Use /clear to start fresh

**Examples:**
\`/chat How do I implement rate limiting in Node.js?\`
\`/chat Explain this error: TypeError: Cannot read property 'x' of undefined\`
\`What's the best way to structure a TypeScript project?\`

**Need more help?**
Visit: https://github.com/duyet/duyetbot-agent`,
    { parse_mode: 'Markdown' }
  );
}
