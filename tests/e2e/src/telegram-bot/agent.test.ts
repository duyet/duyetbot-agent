import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * E2E tests for Telegram Bot webhook handler
 *
 * Tests the route logic with mocked dependencies
 */

// Mock fetch for Telegram API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock agent
const mockAgent = {
  init: vi.fn(),
  chat: vi.fn().mockResolvedValue('AI response'),
  clearHistory: vi.fn().mockResolvedValue('History cleared'),
  getWelcome: vi.fn().mockResolvedValue('Welcome message'),
  getHelp: vi.fn().mockResolvedValue('Help message'),
};

// Mock getAgentByName
const mockGetAgentByName = vi.fn().mockResolvedValue(mockAgent);

// Create test app that mirrors the telegram-bot app structure
function createTestApp() {
  const app = new Hono<{ Bindings: any }>();

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
    let update: any;
    try {
      update = await c.req.json();
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
          .map((id: string) => Number.parseInt(id.trim(), 10))
          .filter((id: number) => !Number.isNaN(id));

        if (allowed.length > 0 && !allowed.includes(userId)) {
          await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, you are not authorized.');
          return c.text('OK');
        }
      }

      // Get or create agent for this user
      const agentId = `telegram:${userId}:${chatId}`;
      const agent = await mockGetAgentByName(env.TelegramAgent, agentId);
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
        responseText = await agent.chat(text);
      }

      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText);
      return c.text('OK');
    } catch (error) {
      console.error('Webhook error:', error);
      await sendMessage(env.TELEGRAM_BOT_TOKEN, chatId, 'Sorry, an error occurred.').catch(
        () => {}
      );
      return c.text('Error', 500);
    }
  });

  return app;
}

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

describe('Telegram Bot E2E', () => {
  const app = createTestApp();

  const mockEnv = {
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    AI_GATEWAY_NAME: 'test-gateway',
    ENVIRONMENT: 'test',
    TelegramAgent: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('ok'),
      json: () => Promise.resolve({ ok: true }),
    });
  });

  describe('Health Check', () => {
    it('should respond to root endpoint', async () => {
      const res = await app.request('/', {}, mockEnv);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('OK');
    });
  });

  describe('Webhook Endpoint', () => {
    it('should return 400 for invalid JSON', async () => {
      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        },
        mockEnv
      );

      expect(res.status).toBe(400);
    });

    it('should return OK for empty update', async () => {
      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
    });

    it('should handle /start command', async () => {
      const update = createTelegramUpdate({
        text: '/start',
        chatId: 123456,
        userId: 789,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      expect(mockAgent.getWelcome).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.any(Object)
      );
    });

    it('should handle /help command', async () => {
      const update = createTelegramUpdate({
        text: '/help',
        chatId: 123456,
        userId: 789,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      expect(mockAgent.getHelp).toHaveBeenCalled();
    });

    it('should handle /clear command', async () => {
      const update = createTelegramUpdate({
        text: '/clear',
        chatId: 123456,
        userId: 789,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      expect(mockAgent.clearHistory).toHaveBeenCalled();
    });

    it('should handle regular message', async () => {
      const update = createTelegramUpdate({
        text: 'Hello, bot!',
        chatId: 123456,
        userId: 789,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      expect(mockAgent.chat).toHaveBeenCalledWith('Hello, bot!');
    });

    it('should initialize agent with user context', async () => {
      const update = createTelegramUpdate({
        text: 'Test',
        chatId: 111,
        userId: 222,
      });

      await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(mockAgent.init).toHaveBeenCalledWith(222, 111);
    });
  });

  describe('Authentication', () => {
    it('should reject invalid webhook secret', async () => {
      const envWithSecret = {
        ...mockEnv,
        TELEGRAM_WEBHOOK_SECRET: 'secret123',
      };
      const update = createTelegramUpdate({
        text: '/start',
        chatId: 123,
        userId: 456,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
          },
          body: JSON.stringify(update),
        },
        envWithSecret
      );

      expect(res.status).toBe(401);
    });

    it('should accept valid webhook secret', async () => {
      const envWithSecret = {
        ...mockEnv,
        TELEGRAM_WEBHOOK_SECRET: 'secret123',
      };
      const update = createTelegramUpdate({
        text: '/start',
        chatId: 123,
        userId: 456,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'secret123',
          },
          body: JSON.stringify(update),
        },
        envWithSecret
      );

      expect(res.status).toBe(200);
    });
  });

  describe('User Authorization', () => {
    it('should reject unauthorized users', async () => {
      const envWithAllowed = { ...mockEnv, ALLOWED_USERS: '100,200,300' };
      const update = createTelegramUpdate({
        text: 'Hello',
        chatId: 999,
        userId: 999,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        envWithAllowed
      );

      expect(res.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          body: expect.stringContaining('not authorized'),
        })
      );
    });

    it('should allow authorized users', async () => {
      const envWithAllowed = { ...mockEnv, ALLOWED_USERS: '100,200,300' };
      const update = createTelegramUpdate({
        text: 'Hello',
        chatId: 200,
        userId: 200,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        envWithAllowed
      );

      expect(res.status).toBe(200);
      expect(mockAgent.chat).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing message text', async () => {
      const update = {
        update_id: Date.now(),
        message: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: 123 },
          from: { id: 456, is_bot: false, first_name: 'Test' },
        },
      };

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      expect(mockAgent.chat).not.toHaveBeenCalled();
    });

    it('should handle agent errors gracefully', async () => {
      mockAgent.chat.mockRejectedValueOnce(new Error('Agent error'));
      const update = createTelegramUpdate({
        text: 'Hello',
        chatId: 123,
        userId: 456,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(500);
    });

    it('should handle Telegram API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      });
      const update = createTelegramUpdate({
        text: '/start',
        chatId: 123,
        userId: 456,
      });

      const res = await app.request(
        '/webhook',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update),
        },
        mockEnv
      );

      expect(res.status).toBe(500);
    });
  });
});

function createTelegramUpdate(options: { text: string; chatId: number; userId: number }) {
  return {
    update_id: Date.now(),
    message: {
      message_id: Math.floor(Math.random() * 10000),
      date: Math.floor(Date.now() / 1000),
      chat: { id: options.chatId, type: 'private' },
      from: {
        id: options.userId,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      text: options.text,
    },
  };
}
