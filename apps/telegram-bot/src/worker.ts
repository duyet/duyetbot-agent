/**
 * Cloudflare Workers entry point for Telegram Bot
 *
 * Uses Cloudflare Agents SDK with Durable Objects for stateful sessions.
 * Each user gets a unique agent instance with persistent conversation history.
 */

import { getAgentByName } from 'agents';
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
      last_name?: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify webhook secret
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const update = (await request.json()) as TelegramUpdate;

      const message = update.message;
      if (!message?.text || !message.from) {
        return new Response('OK', { status: 200 });
      }

      const userId = message.from.id;
      const chatId = message.chat.id;
      const text = message.text;

      // Check allowed users
      if (env.ALLOWED_USERS) {
        const allowed = env.ALLOWED_USERS.split(',')
          .map((id) => Number.parseInt(id.trim(), 10))
          .filter((id) => !Number.isNaN(id));
        if (allowed.length > 0 && !allowed.includes(userId)) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            'Sorry, you are not authorized.'
          );
          return new Response('OK', { status: 200 });
        }
      }

      // Get or create agent for this user
      // Each user:chat pair gets a unique, persistent agent instance
      const agentId = `telegram:${userId}:${chatId}`;
      const agent = await getAgentByName<Env, TelegramAgent>(env.TelegramAgent, agentId);

      // Initialize agent with user context
      await agent.init(userId, chatId);

      let responseText: string;

      // Handle commands
      if (text.startsWith('/start')) {
        responseText = agent.getWelcome();
      } else if (text.startsWith('/help')) {
        responseText = agent.getHelp();
      } else if (text.startsWith('/clear')) {
        responseText = await agent.clearHistory();
      } else {
        // Send typing indicator
        await sendChatAction(env.TELEGRAM_BOT_TOKEN, chatId, 'typing');

        // Chat with agent
        responseText = await agent.chat(text, env);
      }

      // Send response to Telegram
      await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Error', { status: 500 });
    }
  },
};

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
}

async function sendChatAction(token: string, chatId: number, action: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      action,
    }),
  });
}
