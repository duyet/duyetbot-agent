/**
 * Telegram Webhook Routes
 */

import { Hono } from 'hono';

const telegram = new Hono();

/**
 * Telegram webhook handler
 */
telegram.post('/webhook', async (c) => {
  const secretToken = c.req.header('x-telegram-bot-api-secret-token');
  const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;

  // Verify secret token if configured
  if (expectedToken && secretToken !== expectedToken) {
    return c.json({ error: 'Invalid secret token' }, 401);
  }

  try {
    const update = await c.req.json();

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'telegram_webhook',
        updateId: update.update_id,
        messageType: update.message ? 'message' : update.callback_query ? 'callback' : 'other',
        chatId: update.message?.chat?.id || update.callback_query?.message?.chat?.id,
      })
    );

    // Handle different update types
    if (update.message) {
      const message = update.message;
      const text = message.text || '';

      // Check for commands
      if (text.startsWith('/')) {
        const command = text.split(' ')[0].substring(1);
        // TODO: Route to command handler
        return c.json({ processed: true, command });
      }

      // Regular message
      // TODO: Forward to agent handler
      return c.json({ processed: true, type: 'message' });
    }

    if (update.callback_query) {
      // TODO: Handle callback query
      return c.json({ processed: true, type: 'callback' });
    }

    return c.json({ processed: false, reason: 'unhandled update type' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to process webhook', details: errorMessage }, 500);
  }
});

/**
 * Set webhook endpoint
 */
telegram.post('/set-webhook', async (c) => {
  const body = await c.req.json();
  const { url, secret_token } = body;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token,
        allowed_updates: ['message', 'callback_query', 'edited_message'],
      }),
    });

    const result = await response.json();
    return c.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to set webhook', details: errorMessage }, 500);
  }
});

/**
 * Get webhook info
 */
telegram.get('/webhook-info', async (c) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const result = await response.json();
    return c.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: 'Failed to get webhook info', details: errorMessage }, 500);
  }
});

export { telegram };
