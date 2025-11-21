/**
 * Telegram Bot Main Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimpleExecutor, createTelegramBot, createWebhookServer } from './index.js';
import type { TelegramBotConfig } from './types.js';

// Mock Telegraf
vi.mock('telegraf', () => ({
  Telegraf: vi.fn().mockImplementation(() => ({
    command: vi.fn(),
    on: vi.fn(),
    catch: vi.fn(),
    launch: vi.fn(),
    stop: vi.fn(),
    handleUpdate: vi.fn(),
    telegram: {
      setWebhook: vi.fn(),
      sendMessage: vi.fn(),
    },
  })),
}));

describe('Telegram Bot', () => {
  const testConfig: TelegramBotConfig = {
    botToken: 'test-token',
    mcpServerUrl: 'https://memory.test.com',
  };

  describe('createTelegramBot', () => {
    it('should create bot with all components', () => {
      const { bot, sessionManager, notificationManager, startTime } = createTelegramBot(testConfig);

      expect(bot).toBeDefined();
      expect(sessionManager).toBeDefined();
      expect(notificationManager).toBeDefined();
      expect(startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should register all commands', () => {
      const { bot } = createTelegramBot(testConfig);

      // Check that command was called for each command
      expect(bot.command).toHaveBeenCalledWith('start', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('help', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('status', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('sessions', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('chat', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('clear', expect.any(Function));
    });

    it('should register text and callback handlers', () => {
      const { bot } = createTelegramBot(testConfig);

      expect(bot.on).toHaveBeenCalledWith('text', expect.any(Function));
      expect(bot.on).toHaveBeenCalledWith('callback_query', expect.any(Function));
    });

    it('should set up error handler', () => {
      const { bot } = createTelegramBot(testConfig);
      expect(bot.catch).toHaveBeenCalled();
    });
  });

  describe('createWebhookServer', () => {
    it('should create Hono app with routes', () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      expect(app).toBeDefined();
    });

    it('should have health endpoint', async () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      const res = await app.request('/health');
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.bot).toBe('duyetbot-telegram');
    });

    it('should have telegram webhook endpoint', async () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      const res = await app.request('/webhook/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id: 1 }),
      });

      expect(res.status).toBe(200);
    });

    it('should validate webhook secret', async () => {
      const config = { ...testConfig, webhookSecret: 'secret123' };
      const { bot, notificationManager, startTime } = createTelegramBot(config);
      const app = createWebhookServer(bot, notificationManager, config, startTime);

      // Without secret
      const res1 = await app.request('/webhook/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ update_id: 1 }),
      });
      expect(res1.status).toBe(401);

      // With correct secret
      const res2 = await app.request('/webhook/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-bot-api-secret-token': 'secret123',
        },
        body: JSON.stringify({ update_id: 1 }),
      });
      expect(res2.status).toBe(200);
    });

    it('should have github webhook endpoint', async () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      const res = await app.request('/webhook/github', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
    });

    it('should have subscribe endpoint', async () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      const res = await app.request('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 123,
          chatId: 456,
          notifications: ['pr_merged'],
        }),
      });

      expect(res.status).toBe(200);

      const sub = notificationManager.getSubscription(123);
      expect(sub).toBeDefined();
    });

    it('should have unsubscribe endpoint', async () => {
      const { bot, notificationManager, startTime } = createTelegramBot(testConfig);
      const app = createWebhookServer(bot, notificationManager, testConfig, startTime);

      // Subscribe first
      notificationManager.subscribe(123, 456, ['pr_merged']);

      const res = await app.request('/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 123 }),
      });

      expect(res.status).toBe(200);
      expect(notificationManager.getSubscription(123)).toBeUndefined();
    });
  });

  describe('createSimpleExecutor', () => {
    it('should create executor', () => {
      const executor = createSimpleExecutor();
      expect(executor).toBeDefined();
      expect(executor.execute).toBeInstanceOf(Function);
    });

    it('should return test response', async () => {
      const executor = createSimpleExecutor();
      const response = await executor.execute('test-session', [], 'Hello', {});

      expect(response).toContain('Hello');
    });
  });
});

describe('Types', () => {
  it('should export all types', async () => {
    const module = await import('./index.js');

    expect(module.createTelegramBot).toBeDefined();
    expect(module.createWebhookServer).toBeDefined();
    expect(module.TelegramSessionManager).toBeDefined();
    expect(module.NotificationManager).toBeDefined();
    expect(module.createTelegramSessionId).toBeDefined();
    expect(module.parseSessionId).toBeDefined();
  });
});
