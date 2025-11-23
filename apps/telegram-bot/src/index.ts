/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 */

import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
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
    };
    chat: {
      id: number;
    };
    text?: string;
  };
}

const app = createBaseApp<Env>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Telegram webhook
app.post('/webhook', createTelegramWebhookAuth<Env>(), async (c) => {
  const env = c.env;

  // Parse JSON with error handling
  let update: TelegramUpdate;
  try {
    update = await c.req.json<TelegramUpdate>();
    logger.debug('Webhook payload received', { update });
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
  const isCommand = text.startsWith('/');

  logger.info('Message received', {
    userId,
    chatId,
    username: message.from.username,
    messageLength: text.length,
    isCommand,
  });

  const startTime = Date.now();

  try {
    // Check allowed users
    if (env.TELEGRAM_ALLOWED_USERS) {
      const allowed = env.TELEGRAM_ALLOWED_USERS.split(',')
        .map((id) => Number.parseInt(id.trim(), 10))
        .filter((id) => !Number.isNaN(id));

      if (allowed.length > 0 && !allowed.includes(userId)) {
        logger.warn('Unauthorized user', {
          userId,
          chatId,
          username: message.from.username,
        });
        await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, you are not authorized.');
        return c.text('OK');
      }
    }

    // Get or create agent for this user
    const agentId = `telegram:${userId}:${chatId}`;
    const agent = await getAgentByName(env.TelegramAgent, agentId);
    await agent.init(userId, chatId);

    let responseText: string;

    // Handle commands
    if (text.startsWith('/start')) {
      logger.info('Command executed', { command: '/start', userId, chatId });
      responseText = await agent.getWelcome();
    } else if (text.startsWith('/help')) {
      logger.info('Command executed', { command: '/help', userId, chatId });
      responseText = await agent.getHelp();
    } else if (text.startsWith('/clear')) {
      logger.info('Command executed', { command: '/clear', userId, chatId });
      responseText = await agent.clearHistory();
    } else {
      // Send processing message immediately to avoid timeout
      const processingMsgId = await sendMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        '🔄 Processing your message...'
      );

      // Process agent chat asynchronously using waitUntil
      // This allows the webhook to return immediately while processing continues
      c.executionCtx.waitUntil(
        (async () => {
          try {
            logger.info('Agent execution started', {
              userId,
              chatId,
              inputLength: text.length,
            });

            const agentResponse = await agent.chat(text);
            const durationMs = Date.now() - startTime;

            logger.info('Agent execution completed', {
              userId,
              chatId,
              durationMs,
              responseLength: agentResponse.length,
            });

            // Edit the processing message with the actual response
            await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, processingMsgId, agentResponse);
          } catch (error) {
            const durationMs = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Agent execution failed', {
              userId,
              chatId,
              durationMs,
              error: errorMessage,
              stack: errorStack,
            });

            // Show detailed error to admin, generic message to others
            const isAdmin = env.TELEGRAM_ADMIN && message.from?.username === env.TELEGRAM_ADMIN;
            const userErrorMessage = isAdmin
              ? `❌ Error: ${errorMessage}`
              : '❌ Sorry, an error occurred. Please try again later.';

            await editMessage(env.TELEGRAM_BOT_TOKEN, chatId, processingMsgId, userErrorMessage);
          }
        })()
      );

      // Return immediately - don't wait for agent
      return c.text('OK');
    }

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);
    return c.text('OK');
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('Webhook error', {
      userId,
      chatId,
      durationMs,
      error: errorMessage,
      stack: errorStack,
    });

    // Show detailed error to admin, generic message to others
    const isAdmin = env.TELEGRAM_ADMIN && message.from.username === env.TELEGRAM_ADMIN;
    const userErrorMessage = isAdmin
      ? `Error: ${errorMessage}\n\nStack: ${errorStack || 'N/A'}`
      : 'Sorry, an error occurred. Please try again later.';

    await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, userErrorMessage).catch(() => {
      // Ignore - already in error handler
    });
    return c.text('Error', 500);
  }
});

async function sendMessage(token: string, chatId: number, text: string): Promise<number> {
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
    logger.error('sendMessage failed', {
      status: response.status,
      error,
      chatId,
    });
    throw new Error(`Telegram API error: ${response.status}`);
  }

  const result = await response.json<{ result: { message_id: number } }>();
  return result.result.message_id;
}

async function editMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error('editMessage failed', {
      status: response.status,
      error,
      chatId,
      messageId,
    });
    // Don't throw - just log, as the message might have been deleted
  }
}

export default app;
