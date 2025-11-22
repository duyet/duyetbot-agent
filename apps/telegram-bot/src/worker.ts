/**
 * Cloudflare Workers entry point for Telegram Bot
 *
 * Handles Telegram webhook requests in a serverless environment.
 * Important: Sessions are stateless per request - configure MCP_SERVER_URL for persistence.
 */

import type { Update } from 'telegraf/types';
import { createTelegramBot } from './index.js';
import type { BotConfig } from './types.js';

export interface Env {
  // Required
  TELEGRAM_BOT_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  TELEGRAM_WEBHOOK_SECRET: string;

  // Optional
  ALLOWED_USERS?: string;
  MCP_SERVER_URL?: string;
  MCP_AUTH_TOKEN?: string;
  MODEL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Verify webhook secret token
    const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      // Set ANTHROPIC_API_KEY for @duyetbot/core to use
      if (typeof process !== 'undefined') {
        process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
      }

      const update = (await request.json()) as Update;

      // Parse allowed users
      const allowedUsers = env.ALLOWED_USERS
        ? env.ALLOWED_USERS.split(',')
            .map((id) => Number.parseInt(id.trim(), 10))
            .filter((id) => !Number.isNaN(id))
        : [];

      const config: BotConfig = {
        botToken: env.TELEGRAM_BOT_TOKEN,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        allowedUsers,
        mcpServerUrl: env.MCP_SERVER_URL,
        mcpAuthToken: env.MCP_AUTH_TOKEN,
        model: env.MODEL || 'sonnet',
      };

      const { bot } = createTelegramBot(config);

      // Process the Telegram update
      await bot.handleUpdate(update);

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Webhook error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(`Error: ${message}`, { status: 500 });
    }
  },
};
