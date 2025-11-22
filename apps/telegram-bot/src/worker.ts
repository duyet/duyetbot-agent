/**
 * Cloudflare Workers entry point for Telegram Bot
 */

import { createTelegramBot } from './index.js';
import type { BotConfig } from './types.js';

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ALLOWED_USERS?: string;
  MCP_SERVER_URL?: string;
  MCP_AUTH_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Verify webhook secret
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      const config: BotConfig = {
        botToken: env.TELEGRAM_BOT_TOKEN,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        allowedUsers: env.ALLOWED_USERS?.split(',').map(Number) || [],
        mcpServerUrl: env.MCP_SERVER_URL,
        mcpAuthToken: env.MCP_AUTH_TOKEN,
      };

      const { bot } = createTelegramBot(config);

      // Process the update
      await bot.handleUpdate(update);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      return new Response('Internal error', { status: 500 });
    }
  },
};
