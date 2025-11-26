/**
 * Tests for Telegram transport layer
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type TelegramContext,
  createTelegramContext,
  splitMessage,
  telegramTransport,
} from '../transport.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to safely call optional methods (we know they're defined for telegramTransport)
const edit = telegramTransport.edit!;
const typing = telegramTransport.typing!;

/**
 * Create a mock TelegramContext for testing
 */
function createMockContext(overrides: Partial<TelegramContext> = {}): TelegramContext {
  return {
    token: 'test-bot-token',
    chatId: 123456,
    userId: 789,
    text: 'test message',
    startTime: Date.now(),
    ...overrides,
  };
}

/**
 * Create a mock successful Telegram API response
 */
function createMockResponse(messageId: number, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({ result: { message_id: messageId } }),
    text: vi.fn().mockResolvedValue(''),
  };
}

describe('transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('splitMessage', () => {
    it('returns single chunk for short messages', () => {
      const text = 'Hello, world!';
      const chunks = splitMessage(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('returns single chunk for exactly max length message', () => {
      const text = 'a'.repeat(4096);
      const chunks = splitMessage(text);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('handles empty string', () => {
      const chunks = splitMessage('');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('');
    });

    it('splits at newlines when possible', () => {
      // Create text with newline at position 3000 (above 50% threshold)
      const firstPart = 'a'.repeat(3000);
      const secondPart = 'b'.repeat(2000);
      const text = `${firstPart}\n${secondPart}`;

      const chunks = splitMessage(text);
      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe(firstPart);
      expect(chunks[1]).toBe(secondPart);
    });

    it('splits at spaces when no newlines above threshold', () => {
      // Create text with space at position 3000 but no good newlines
      const firstPart = 'word '.repeat(600).trim(); // ~3000 chars
      const secondPart = 'more '.repeat(400).trim(); // ~2000 chars
      const text = `${firstPart} ${secondPart}`;

      const chunks = splitMessage(text);
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      // First chunk should end at a word boundary
      expect(chunks[0].endsWith(' ')).toBe(false);
    });

    it('hard splits at max length when no break points', () => {
      // Text with no spaces or newlines
      const text = 'a'.repeat(5000);
      const chunks = splitMessage(text);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(4096);
      expect(chunks[1]).toHaveLength(904);
    });

    it('handles multiple chunks correctly', () => {
      // Create very long text requiring multiple splits
      const text = 'a'.repeat(10000);
      const chunks = splitMessage(text);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(4096);
      expect(chunks[1]).toHaveLength(4096);
      expect(chunks[2]).toHaveLength(1808);

      // Verify total length
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalLength).toBe(10000);
    });

    it('prefers newlines over spaces for better formatting', () => {
      // Text with both newlines and spaces - should prefer newline
      const text = `${'a'.repeat(2500)} ${'b'.repeat(500)}\n${'c'.repeat(2000)}`;

      const chunks = splitMessage(text);
      // Should split at the newline, not the earlier space
      expect(chunks[0]).toContain('b'.repeat(500));
      expect(chunks[0]).not.toContain('c');
    });
  });

  describe('telegramTransport.send', () => {
    it('sends message with Markdown parse mode', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce(createMockResponse(42));

      const messageId = await telegramTransport.send(ctx, 'Hello *world*');

      expect(messageId).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: 123456,
            text: 'Hello *world*',
            parse_mode: 'Markdown',
          }),
        })
      );
    });

    it('falls back to plain text on 400 error', async () => {
      const ctx = createMockContext();
      // First call returns 400 (Markdown parse error)
      mockFetch.mockResolvedValueOnce(createMockResponse(0, false, 400));
      // Second call without parse_mode succeeds
      mockFetch.mockResolvedValueOnce(createMockResponse(42));

      const messageId = await telegramTransport.send(ctx, 'Invalid *markdown');

      expect(messageId).toBe(42);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should be without parse_mode
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1].body);
      expect(body.parse_mode).toBeUndefined();
    });

    it('throws on non-400 errors', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      await expect(telegramTransport.send(ctx, 'Hello')).rejects.toThrow('Telegram API error: 500');
    });

    it('handles multiple chunks for long messages', async () => {
      const ctx = createMockContext();
      const longText = 'a'.repeat(5000); // Will be split into 2 chunks

      mockFetch.mockResolvedValueOnce(createMockResponse(41));
      mockFetch.mockResolvedValueOnce(createMockResponse(42));

      const messageId = await telegramTransport.send(ctx, longText);

      expect(messageId).toBe(42); // Returns last message ID
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('telegramTransport.edit', () => {
    it('edits message with Markdown parse mode', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce(createMockResponse(0, true));

      await edit(ctx, 42, 'Updated *text*');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/editMessageText',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: 123456,
            message_id: 42,
            text: 'Updated *text*',
            parse_mode: 'Markdown',
          }),
        })
      );
    });

    it('falls back to plain text on 400 error', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce(createMockResponse(0, false, 400));
      mockFetch.mockResolvedValueOnce(createMockResponse(0, true));

      await edit(ctx, 42, 'Updated text');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second call should be without parse_mode
      const secondCall = mockFetch.mock.calls[1];
      const body = JSON.parse(secondCall[1].body);
      expect(body.parse_mode).toBeUndefined();
    });

    it('truncates long messages', async () => {
      const ctx = createMockContext();
      const longText = 'a'.repeat(5000);
      mockFetch.mockResolvedValueOnce(createMockResponse(0, true));

      await edit(ctx, 42, longText);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.text.length).toBeLessThanOrEqual(4096);
      expect(body.text).toContain('[truncated]');
    });

    it('does not throw on edit failure (message may be deleted)', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request: message not found'),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue('Bad Request: message not found'),
      });

      // Should not throw
      await expect(edit(ctx, 42, 'Text')).resolves.toBeUndefined();
    });
  });

  describe('telegramTransport.typing', () => {
    it('sends typing indicator', async () => {
      const ctx = createMockContext();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
      });

      await typing(ctx);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest-bot-token/sendChatAction',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chat_id: 123456,
            action: 'typing',
          }),
        })
      );
    });

    it('consumes response body to prevent connection pool issues', async () => {
      const ctx = createMockContext();
      const textMock = vi.fn().mockResolvedValue('');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: textMock,
      });

      await typing(ctx);

      expect(textMock).toHaveBeenCalled();
    });
  });

  describe('telegramTransport.parseContext', () => {
    it('extracts correct fields from context', () => {
      const ctx = createMockContext({
        text: 'Hello bot',
        userId: 12345,
        chatId: 67890,
        username: 'testuser',
        startTime: 1700000000000,
        requestId: 'req-123',
      });

      const parsed = telegramTransport.parseContext(ctx);

      expect(parsed).toEqual({
        text: 'Hello bot',
        userId: 12345,
        chatId: 67890,
        username: 'testuser',
        metadata: {
          startTime: 1700000000000,
          requestId: 'req-123',
        },
      });
    });

    it('handles missing optional fields', () => {
      const ctx = createMockContext({
        username: undefined,
        requestId: undefined,
      });

      const parsed = telegramTransport.parseContext(ctx);

      expect(parsed.username).toBeUndefined();
      expect(parsed.metadata?.requestId).toBeUndefined();
    });
  });

  describe('createTelegramContext', () => {
    it('creates context from webhook data', () => {
      const webhookCtx = {
        userId: 12345,
        chatId: 67890,
        text: 'Hello',
        username: 'testuser',
        startTime: 1700000000000,
      };

      const ctx = createTelegramContext('bot-token', webhookCtx, 'admin', 'req-123');

      expect(ctx).toEqual({
        token: 'bot-token',
        chatId: 67890,
        userId: 12345,
        requestId: 'req-123',
        username: 'testuser',
        text: 'Hello',
        startTime: 1700000000000,
        adminUsername: 'admin',
      });
    });

    it('handles missing optional parameters', () => {
      const webhookCtx = {
        userId: 12345,
        chatId: 67890,
        text: 'Hello',
        startTime: 1700000000000,
      };

      const ctx = createTelegramContext('bot-token', webhookCtx);

      expect(ctx.adminUsername).toBeUndefined();
      expect(ctx.requestId).toBeUndefined();
      expect(ctx.username).toBeUndefined();
    });
  });
});
