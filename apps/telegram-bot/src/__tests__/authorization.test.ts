/**
 * Tests for authorization middleware (parser + auth)
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AuthVariables,
  createTelegramAuthMiddleware,
  createTelegramParserMiddleware,
  type Env,
  isUserAuthorized,
  type TelegramUpdate,
  type WebhookContext,
} from '../middlewares/index.js';

/** Response type from test endpoint */
interface TestResponse {
  skipProcessing: boolean;
  unauthorized: boolean | undefined;
  webhookContext: WebhookContext | undefined;
}

/**
 * Create a mock Hono app with authorization middleware
 * Uses a middleware to inject env since Hono test helper doesn't support it directly
 */
function createTestApp(envOverrides: Partial<Env> = {}) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

  // Inject env via middleware (Hono's test helper doesn't pass env correctly)
  app.use('*', async (c, next) => {
    const mockEnv: Env = { TELEGRAM_BOT_TOKEN: 'test-token', ...envOverrides };
    c.env = mockEnv;
    return next();
  });

  // Add parser and auth middlewares (replaced deprecated authorizationMiddleware)
  app.use('*', createTelegramParserMiddleware());
  app.use('*', createTelegramAuthMiddleware());

  // Test endpoint that returns middleware state
  app.post('/webhook', (c) => {
    return c.json({
      skipProcessing: c.get('skipProcessing'),
      unauthorized: c.get('unauthorized'),
      webhookContext: c.get('webhookContext'),
    });
  });

  return {
    app,
    request: (body: unknown) =>
      app.request('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}

/**
 * Create a valid Telegram update payload
 */
function createValidUpdate(overrides: Partial<TelegramUpdate['message']> = {}): TelegramUpdate {
  return {
    message: {
      message_id: 1,
      from: {
        id: 12345,
        first_name: 'Test',
        username: 'testuser',
      },
      chat: {
        id: 67890,
      },
      text: 'Hello bot',
      ...overrides,
    },
  };
}

describe('authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isUserAuthorized', () => {
    it('allows all when TELEGRAM_ALLOWED_USERS is not set', () => {
      const env: Env = { TELEGRAM_BOT_TOKEN: 'token' };
      expect(isUserAuthorized(env, 12345)).toBe(true);
    });

    it('allows all when TELEGRAM_ALLOWED_USERS is empty string', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '',
      };
      expect(isUserAuthorized(env, 12345)).toBe(true);
    });

    it('allows all when TELEGRAM_ALLOWED_USERS contains only whitespace', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '   ',
      };
      expect(isUserAuthorized(env, 12345)).toBe(true);
    });

    it('allows user in allowlist', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '12345,67890',
      };
      expect(isUserAuthorized(env, 12345)).toBe(true);
      expect(isUserAuthorized(env, 67890)).toBe(true);
    });

    it('rejects user not in allowlist', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '12345,67890',
      };
      expect(isUserAuthorized(env, 99999)).toBe(false);
    });

    it('handles spaces in allowlist', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '12345, 67890, 11111',
      };
      expect(isUserAuthorized(env, 67890)).toBe(true);
      expect(isUserAuthorized(env, 11111)).toBe(true);
    });

    it('ignores invalid user IDs in allowlist', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '12345,invalid,67890,abc',
      };
      expect(isUserAuthorized(env, 12345)).toBe(true);
      expect(isUserAuthorized(env, 67890)).toBe(true);
    });

    it('allows all when allowlist contains only invalid IDs', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: 'invalid,abc,xyz',
      };
      // After filtering, allowed list is empty, so should allow all
      expect(isUserAuthorized(env, 12345)).toBe(true);
    });

    it('passes optional parameters to logging', () => {
      const env: Env = {
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_ALLOWED_USERS: '12345',
      };
      // Should not throw when called with all params
      expect(isUserAuthorized(env, 99999, 'username', 67890)).toBe(false);
    });
  });

  describe('authorizationMiddleware', () => {
    it('sets skipProcessing for invalid JSON', async () => {
      const { app } = createTestApp();

      const response = await app.request('/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const data = (await response.json()) as TestResponse;
      expect(data.skipProcessing).toBe(true);
    });

    it('sets skipProcessing for missing message', async () => {
      const { request } = createTestApp();

      const response = await request({});
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(true);
    });

    it('sets skipProcessing for message without text', async () => {
      const { request } = createTestApp();

      const response = await request({
        message: {
          message_id: 1,
          from: { id: 12345, first_name: 'Test' },
          chat: { id: 67890 },
          // No text field
        },
      });
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(true);
    });

    it('sets skipProcessing for message without from', async () => {
      const { request } = createTestApp();

      const response = await request({
        message: {
          message_id: 1,
          chat: { id: 67890 },
          text: 'Hello',
          // No from field
        },
      });
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(true);
    });

    it('sets webhookContext for valid authorized request', async () => {
      const { request } = createTestApp();

      const response = await request(createValidUpdate());
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(false);
      expect(data.webhookContext).toMatchObject({
        userId: 12345,
        chatId: 67890,
        text: 'Hello bot',
        username: 'testuser',
      });
      expect(data.webhookContext?.startTime).toBeTypeOf('number');
    });

    it('sets unauthorized flag for rejected users', async () => {
      const { request } = createTestApp({ TELEGRAM_ALLOWED_USERS: '99999' });

      const response = await request(createValidUpdate());
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(true);
      expect(data.unauthorized).toBe(true);
      // webhookContext should still be set so we can send rejection message
      expect(data.webhookContext).toMatchObject({
        userId: 12345,
        chatId: 67890,
      });
    });

    it('allows authorized users in allowlist', async () => {
      const { request } = createTestApp({
        TELEGRAM_ALLOWED_USERS: '12345,99999',
      });

      const response = await request(createValidUpdate());
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(false);
      expect(data.unauthorized).toBe(false);
    });

    it('handles missing username', async () => {
      const { request } = createTestApp();

      const response = await request(
        createValidUpdate({
          from: { id: 12345, first_name: 'Test' }, // No username
        })
      );
      const data = (await response.json()) as TestResponse;

      expect(data.skipProcessing).toBe(false);
      expect(data.webhookContext?.username).toBeUndefined();
    });
  });
});
