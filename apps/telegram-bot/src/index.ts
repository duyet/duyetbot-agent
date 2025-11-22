/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 */

import { getAgentByName } from 'agents';
import { Hono } from 'hono';
import { type Env, TelegramAgent } from './agent.js';

// Re-export agent for Durable Object binding
export { TelegramAgent };

interface TelegramUpdate {
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/', (c) => c.text('OK'));

// Telegram webhook
app.post('/webhook', async (c) => {
  const env = c.env;

  // Verify webhook secret
  const secretHeader = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  // Parse JSON with error handling
  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
  } catch {
    return c.text('Invalid JSON', 400);
  }

  const message = update.message;
  if (!message?.text || !message.from) {
    return c.text('OK');
  }

  const userId = message.from.id;
  const chatId = message.chat.id;
  const text = message.text;

  try {
    // Check allowed users
    if (env.ALLOWED_USERS) {
      const allowed = env.ALLOWED_USERS.split(',')
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id));

      if (allowed.length > 0 && !allowed.includes(userId)) {
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, you are not authorized.');
        return c.text('OK');
      }
    }

    // Get or create agent for this user
    const agentId = `telegram:${userId}:${chatId}`;
    const agent = await getAgentByName<Env, TelegramAgent>(env.TelegramAgent, agentId);
    await agent.init(userId, chatId);

    let responseText: string;

    // Handle commands
    if (text.startsWith('/start')) {
      responseText = await agent.getWelcome();
    } else if (text.startsWith('/help')) {
      responseText = await agent.getHelp();
    } else if (text.startsWith('/clear')) {
      responseText = await agent.clearHistory();
    } else {
      // Send typing indicator (fire-and-forget)
      sendAction(env.TELEGRAM_BOT_TOKEN, chatId, 'typing');
      // Chat with agent (agent accesses env bindings internally)
      responseText = await agent.chat(text);
    }

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);
    return c.text('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, an error occurred.').catch(() => {
      // Ignore - already in error handler
    });
    return c.text('Error', 500);
  }
});

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`sendMessage failed: ${response.status}`, error);
    throw new Error(`Telegram API error: ${response.status}`);
  }
}

function sendAction(token: string, chatId: number, action: string): void {
  fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action,
    }),
  }).catch((err) => console.warn('sendAction failed:', err));
}

export default app;
