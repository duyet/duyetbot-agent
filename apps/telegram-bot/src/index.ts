/**
 * Telegram Bot using Hono + Cloudflare Agents SDK
 *
 * Simple webhook handler with stateful agent sessions via Durable Objects.
 * Uses transport layer pattern for clean separation of concerns.
 */

import { createBaseApp, createTelegramWebhookAuth, logger } from '@duyetbot/hono-middleware';
import { getAgentByName } from 'agents';
import { type Env, TelegramAgent } from './agent.js';
import { authorizationMiddleware } from './middlewares/authorization.js';
import { createTelegramContext } from './transport.js';

// Re-export agent for Durable Object binding
export { TelegramAgent };

const app = createBaseApp<Env>({
  name: 'telegram-bot',
  version: '1.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Telegram webhook handler
app.post('/webhook', createTelegramWebhookAuth<Env>(), authorizationMiddleware(), async (c) => {
  const env = c.env;

  // Check if we should skip processing
  if (c.get('skipProcessing')) {
    // Handle unauthorized users
    if (c.get('unauthorized')) {
      const webhookCtx = c.get('webhookContext');
      const ctx = createTelegramContext(env.TELEGRAM_BOT_TOKEN, webhookCtx, env.TELEGRAM_ADMIN);

      // Import transport to send unauthorized message
      const { telegramTransport } = await import('./transport.js');
      await telegramTransport.send(ctx, 'Sorry, you are not authorized.');
    }
    return c.text('OK');
  }

  const webhookCtx = c.get('webhookContext');

  // Create transport context
  const ctx = createTelegramContext(env.TELEGRAM_BOT_TOKEN, webhookCtx, env.TELEGRAM_ADMIN);

  // Get agent by name
  const agentId = `telegram:${ctx.userId}:${ctx.chatId}`;
  logger.info('[WEBHOOK] Getting agent', { agentId });

  const agent = await getAgentByName(env.TelegramAgent, agentId).catch((error) => {
    logger.error('[WEBHOOK] Failed to get agent', {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  });

  // Agent handles everything: commands, chat, sending response
  await agent.handle(ctx);

  return c.text('OK');
});

export default app;
