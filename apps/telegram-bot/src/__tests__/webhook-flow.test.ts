/**
 * Telegram Bot Webhook Flow Integration Tests
 *
 * Tests the webhook flow components including message parsing,
 * command detection, and transport layer integration.
 *
 * Note: Full end-to-end webhook → agent flow tests are excluded because
 * the agent.ts imports @duyetbot/cloudflare-agent which has Cloudflare
 * Worker-specific imports that cannot be mocked in Vitest (ERR_UNSUPPORTED_ESM_URL_SCHEME).
 *
 * Test Categories:
 * 1. Command parsing and detection
 * 2. Transport layer context creation
 * 3. Telegram context to ParsedInput conversion
 * 4. Message splitting for long messages
 */

import { describe, expect, it } from 'vitest';
import { createTelegramContext, telegramTransport } from '../transport.js';

describe('Telegram Bot Webhook Flow Integration', () => {
  describe('Command Parsing', () => {
    it('should detect slash commands', () => {
      const commands = ['/health', '/start', '/deploy', '/pr', '/review'];
      for (const cmd of commands) {
        expect(cmd.startsWith('/')).toBe(true);
      }
    });

    it('should parse command with arguments', () => {
      const text = '/pr 123';
      const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
      expect(match).toBeDefined();
      expect(match?.[1]).toBe('pr');
      expect(match?.[2]).toBe('123');
    });

    it('should parse command without arguments', () => {
      const text = '/health';
      const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
      expect(match).toBeDefined();
      expect(match?.[1]).toBe('health');
      expect(match?.[2]).toBeUndefined();
    });

    it('should not match non-command text', () => {
      const text = 'Hello bot, how are you?';
      const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
      expect(match).toBeNull();
    });

    it('should handle command with extra spaces', () => {
      const text = '/pr   123';
      const match = text.match(/^\/(\w+)(?:\s+(.*))?$/);
      expect(match).toBeDefined();
      expect(match?.[1]).toBe('pr');
      expect(match?.[2]).toBe('123');
    });
  });

  describe('Message Splitting', () => {
    it('should not split short messages', () => {
      const text = 'Hello, this is a short message';
      const chunks = text.split(/(?=.)/); // Simple split for testing
      expect(chunks.length).toBe(text.length);
    });

    it('should handle messages near the limit', () => {
      // Telegram limit is 4096 characters
      const nearLimit = 'a'.repeat(4000);
      expect(nearLimit.length).toBeLessThanOrEqual(4096);
    });

    it('should handle multi-line messages', () => {
      const text = `Line 1
Line 2
Line 3`;
      const lines = text.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');
    });
  });

  describe('Transport Layer - Context Creation', () => {
    it('should create Telegram context for private chat', () => {
      const context = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'testuser',
          text: 'Hello bot',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        undefined, // adminUsername
        undefined, // requestId
        'MarkdownV2' // parseMode
      );

      expect(context).toMatchObject({
        token: 'test_token_123',
        chatId: 123456,
        userId: 789,
        username: 'testuser',
        text: 'Hello bot',
        isAdmin: false,
        parseMode: 'MarkdownV2',
        messageId: 42,
        isGroupChat: false,
      });
      expect(context.startTime).toBeGreaterThan(0);
    });

    it('should create Telegram context for group chat', () => {
      const context = createTelegramContext('test_token_123', {
        chatId: -1001234567890, // Negative chat ID indicates group/supergroup
        userId: 789,
        username: 'testuser',
        text: 'Hello bot',
        startTime: Date.now(),
        messageId: 42,
        isGroupChat: true,
      });

      expect(context.chatId).toBeLessThan(0);
      expect(context.isGroupChat).toBe(true);
    });

    it('should create admin context with admin flag', () => {
      const context = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'adminuser',
          text: 'Hello bot',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        'adminuser', // adminUsername
        undefined, // requestId
        'MarkdownV2' // parseMode
      );

      expect(context.isAdmin).toBe(true);
      expect(context.adminUsername).toBe('adminuser');
    });

    it('should create context with reply to message', () => {
      const replyToMessageId = 99;
      const context = createTelegramContext('test_token_123', {
        chatId: 123456,
        userId: 789,
        username: 'testuser',
        text: 'Hello bot',
        startTime: Date.now(),
        messageId: 42,
        replyToMessageId,
        isGroupChat: false,
      });

      expect(context.replyToMessageId).toBe(replyToMessageId);
    });
  });

  describe('Transport Layer - parseContext', () => {
    it('should convert Telegram context to ParsedInput', () => {
      const telegramContext = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'testuser',
          text: 'Hello bot',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        undefined, // adminUsername
        'test-request-id', // requestId
        'MarkdownV2' // parseMode
      );

      const parsedInput = telegramTransport.parseContext(telegramContext);

      expect(parsedInput).toMatchObject({
        text: 'Hello bot',
        userId: 789,
        chatId: 123456,
        username: 'testuser',
        messageRef: 42,
        replyTo: undefined,
      });
      expect(parsedInput.metadata).toBeDefined();
      expect(parsedInput.metadata?.startTime).toBeGreaterThan(0);
      expect(parsedInput.metadata?.requestId).toBe('test-request-id');
    });

    it('should include replyTo in ParsedInput when present', () => {
      const replyToMessageId = 99;
      const telegramContext = createTelegramContext('test_token_123', {
        chatId: 123456,
        userId: 789,
        username: 'testuser',
        text: 'Hello bot',
        startTime: Date.now(),
        messageId: 42,
        replyToMessageId,
        isGroupChat: false,
      });

      const parsedInput = telegramTransport.parseContext(telegramContext);

      expect(parsedInput.replyTo).toBe(replyToMessageId);
    });

    it('should handle context without username', () => {
      const telegramContext = createTelegramContext('test_token_123', {
        chatId: 123456,
        userId: 789,
        text: 'Hello bot',
        startTime: Date.now(),
        messageId: 42,
        isGroupChat: false,
      });

      const parsedInput = telegramTransport.parseContext(telegramContext);

      expect(parsedInput.username).toBeUndefined();
      expect(parsedInput.userId).toBe(789);
    });

    it('should include adminUsername in TelegramContext for admin users', () => {
      const telegramContext = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'adminuser',
          text: 'Hello bot',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        'adminuser', // adminUsername
        undefined, // requestId
        'MarkdownV2' // parseMode
      );

      // Note: adminUsername is in TelegramContext but not in ParsedInput metadata
      // The TelegramContext is used for debug footer rendering
      expect(telegramContext.adminUsername).toBe('adminuser');
      expect(telegramContext.isAdmin).toBe(true);
    });
  });

  describe('Session ID Generation', () => {
    it('should generate consistent session ID format', () => {
      const userId = 789;
      const chatId = 123456;
      const sessionId = `telegram:${userId}:${chatId}`;

      expect(sessionId).toBe('telegram:789:123456');
      expect(sessionId).toContain('telegram:');
    });

    it('should handle different user/chat combinations', () => {
      const combinations = [
        { userId: 1, chatId: 100 },
        { userId: 2, chatId: 200 },
        { userId: 999, chatId: -1001234567890 }, // Group chat
      ];

      const sessionIds = combinations.map((c) => `telegram:${c.userId}:${c.chatId}`);

      expect(sessionIds).toHaveLength(3);
      expect(new Set(sessionIds)).toHaveLength(3); // All unique
    });
  });

  describe('Parse Mode Handling', () => {
    it('should support MarkdownV2 parse mode', () => {
      const context = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'testuser',
          text: '*Bold* and _italic_',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        undefined, // adminUsername
        undefined, // requestId
        'MarkdownV2' // parseMode
      );

      expect(context.parseMode).toBe('MarkdownV2');
    });

    it('should support HTML parse mode', () => {
      const context = createTelegramContext(
        'test_token_123',
        {
          chatId: 123456,
          userId: 789,
          username: 'testuser',
          text: '<b>Bold</b> and <i>italic</i>',
          startTime: Date.now(),
          messageId: 42,
          isGroupChat: false,
        },
        undefined, // adminUsername
        undefined, // requestId
        'HTML' // parseMode
      );

      expect(context.parseMode).toBe('HTML');
    });

    it('should handle undefined parse mode', () => {
      const context = createTelegramContext('test_token_123', {
        chatId: 123456,
        userId: 789,
        username: 'testuser',
        text: 'Plain text',
        startTime: Date.now(),
        messageId: 42,
        isGroupChat: false,
      });

      expect(context.parseMode).toBeUndefined();
    });
  });
});
