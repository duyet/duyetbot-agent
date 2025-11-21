/**
 * Message Handler Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleMessage, isUserAllowed } from '../handlers/message.js';
import { TelegramSessionManager } from '../session-manager.js';
import type { BotConfig, TelegramUser } from '../types.js';

// Mock @duyetbot/core
vi.mock('@duyetbot/core', () => ({
  createDefaultOptions: vi.fn().mockReturnValue({
    model: 'sonnet',
    maxTokens: 4096,
  }),
  query: vi.fn().mockImplementation(async function* () {
    yield {
      type: 'assistant',
      content: 'Hello! How can I help you?',
    };
    yield {
      type: 'result',
      content: 'Hello! How can I help you?',
    };
  }),
  toSDKTools: vi.fn().mockReturnValue([]),
}));

// Mock @duyetbot/tools
vi.mock('@duyetbot/tools', () => ({
  getAllBuiltinTools: vi.fn().mockReturnValue([]),
}));

describe('isUserAllowed', () => {
  it('should allow all users when no allowlist', () => {
    expect(isUserAllowed(123)).toBe(true);
    expect(isUserAllowed(456, [])).toBe(true);
    expect(isUserAllowed(789, undefined)).toBe(true);
  });

  it('should allow users in allowlist', () => {
    const allowedUsers = [100, 200, 300];
    expect(isUserAllowed(100, allowedUsers)).toBe(true);
    expect(isUserAllowed(200, allowedUsers)).toBe(true);
  });

  it('should deny users not in allowlist', () => {
    const allowedUsers = [100, 200, 300];
    expect(isUserAllowed(999, allowedUsers)).toBe(false);
    expect(isUserAllowed(0, allowedUsers)).toBe(false);
  });
});

describe('handleMessage', () => {
  let sessionManager: TelegramSessionManager;
  let config: BotConfig;
  let user: TelegramUser;

  beforeEach(() => {
    sessionManager = new TelegramSessionManager();
    config = {
      botToken: 'test-token',
      model: 'sonnet',
    };
    user = {
      id: 123,
      username: 'testuser',
      firstName: 'Test',
    };
  });

  it('should handle message and return response', async () => {
    const response = await handleMessage('Hello', user, 456, config, sessionManager);

    expect(response).toBe('Hello! How can I help you?');
  });

  it('should create session for new user', async () => {
    await handleMessage('Hello', user, 456, config, sessionManager);

    expect(sessionManager.getSessionCount()).toBe(1);
  });

  it('should save messages to session', async () => {
    await handleMessage('Hello', user, 456, config, sessionManager);

    const session = await sessionManager.getSession(user, 456);
    expect(session.messages).toHaveLength(2);
    expect(session.messages[0]).toEqual({ role: 'user', content: 'Hello' });
    expect(session.messages[1]).toEqual({
      role: 'assistant',
      content: 'Hello! How can I help you?',
    });
  });

  it('should handle errors gracefully', async () => {
    const { query } = await import('@duyetbot/core');
    // biome-ignore lint/correctness/useYield: intentional - testing error before any yield
    vi.mocked(query).mockImplementationOnce(async function* () {
      throw new Error('API error');
    });

    const response = await handleMessage('Hello', user, 456, config, sessionManager);

    expect(response).toContain('error');
    expect(response).toContain('API error');
  });

  it('should use config model', async () => {
    const { createDefaultOptions } = await import('@duyetbot/core');

    config.model = 'haiku';
    await handleMessage('Hello', user, 456, config, sessionManager);

    expect(createDefaultOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'haiku',
      })
    );
  });
});
