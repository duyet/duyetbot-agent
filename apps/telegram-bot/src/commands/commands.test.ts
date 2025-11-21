/**
 * Command Handler Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TelegramSessionManager } from '../session-manager.js';
import type { TelegramBotConfig } from '../types.js';
import { createSimpleExecutor, handleChat } from './chat.js';
import { handleClear } from './clear.js';
import { handleHelp } from './help.js';
import { handleSessions } from './sessions.js';
import { handleStart } from './start.js';
import { handleStatus } from './status.js';

// Mock context
function createMockContext(overrides = {}) {
  return {
    from: {
      id: 123456,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    },
    message: {
      text: '/test',
    },
    reply: vi.fn().mockResolvedValue({}),
    sendChatAction: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as any;
}

describe('Command Handlers', () => {
  let sessionManager: TelegramSessionManager;
  const testConfig: TelegramBotConfig = {
    botToken: 'test-token',
  };

  beforeEach(() => {
    sessionManager = new TelegramSessionManager();
  });

  describe('handleStart', () => {
    it('should greet user with first name', async () => {
      const ctx = createMockContext();
      await handleStart(ctx, sessionManager);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Hello, Test!'),
        expect.any(Object)
      );
    });

    it('should create session', async () => {
      const ctx = createMockContext();
      await handleStart(ctx, sessionManager);

      const sessions = await sessionManager.listSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].userId).toBe(123456);
    });

    it('should handle missing user', async () => {
      const ctx = createMockContext({ from: undefined });
      await handleStart(ctx, sessionManager);

      expect(ctx.reply).toHaveBeenCalledWith('Unable to identify user.');
    });
  });

  describe('handleHelp', () => {
    it('should show help message', async () => {
      const ctx = createMockContext();
      await handleHelp(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('duyetbot Help'),
        expect.any(Object)
      );
    });

    it('should list commands', async () => {
      const ctx = createMockContext();
      await handleHelp(ctx);

      const call = ctx.reply.mock.calls[0][0];
      expect(call).toContain('/chat');
      expect(call).toContain('/status');
      expect(call).toContain('/sessions');
    });
  });

  describe('handleStatus', () => {
    it('should show bot status', async () => {
      const ctx = createMockContext();
      const startTime = Date.now() - 60000; // 1 minute ago

      await handleStatus(ctx, sessionManager, startTime);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Bot Status'),
        expect.any(Object)
      );
    });

    it('should show session info', async () => {
      const ctx = createMockContext();
      await sessionManager.getSession(123456);

      await handleStatus(ctx, sessionManager, Date.now());

      const call = ctx.reply.mock.calls[0][0];
      expect(call).toContain('telegram:123456');
    });
  });

  describe('handleSessions', () => {
    it('should list user sessions', async () => {
      const ctx = createMockContext();
      await sessionManager.getSession(123456);

      await handleSessions(ctx, sessionManager);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Your Sessions'),
        expect.any(Object)
      );
    });

    it('should show no sessions message', async () => {
      const ctx = createMockContext();
      await handleSessions(ctx, sessionManager);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('No sessions found'));
    });
  });

  describe('handleClear', () => {
    it('should clear session', async () => {
      const ctx = createMockContext();
      const sessionId = 'telegram:123456';

      // Create session with messages
      await sessionManager.getSession(123456);
      await sessionManager.saveMessages(sessionId, [{ role: 'user', content: 'Hello' }]);

      await handleClear(ctx, sessionManager);

      const messages = await sessionManager.getMessages(sessionId);
      expect(messages).toHaveLength(0);
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('cleared'));
    });
  });

  describe('handleChat', () => {
    it('should require message', async () => {
      const ctx = createMockContext({ message: { text: '/chat' } });
      const executor = createSimpleExecutor();

      await handleChat(ctx, '/chat', sessionManager, executor, testConfig);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Please provide a message'));
    });

    it('should process message', async () => {
      const ctx = createMockContext({ message: { text: '/chat Hello' } });
      const executor = createSimpleExecutor();

      await handleChat(ctx, '/chat Hello', sessionManager, executor, testConfig);

      expect(ctx.sendChatAction).toHaveBeenCalledWith('typing');
      expect(ctx.reply).toHaveBeenCalled();
    });

    it('should check allowed users', async () => {
      const ctx = createMockContext();
      const executor = createSimpleExecutor();
      const config = { ...testConfig, allowedUsers: [999] };

      await handleChat(ctx, 'Hello', sessionManager, executor, config);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('not authorized'));
    });

    it('should allow user in allowedUsers', async () => {
      const ctx = createMockContext();
      const executor = createSimpleExecutor();
      const config = { ...testConfig, allowedUsers: [123456] };

      await handleChat(ctx, 'Hello', sessionManager, executor, config);

      expect(ctx.reply).not.toHaveBeenCalledWith(expect.stringContaining('not authorized'));
    });

    it('should save messages to session', async () => {
      const ctx = createMockContext();
      const executor = createSimpleExecutor();

      await handleChat(ctx, 'Hello', sessionManager, executor, testConfig);

      const messages = await sessionManager.getMessages('telegram:123456');
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
    });
  });
});
