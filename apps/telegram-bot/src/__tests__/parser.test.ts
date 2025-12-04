/**
 * Tests for Telegram webhook parser middleware
 */

import { describe, expect, it } from 'vitest';
import { extractWebhookContext } from '../middlewares/parser.js';
import type { TelegramUpdate } from '../middlewares/types.js';

describe('extractWebhookContext', () => {
  const baseMessage: NonNullable<TelegramUpdate['message']> = {
    message_id: 123,
    from: {
      id: 12345,
      username: 'testuser',
      first_name: 'Test',
    },
    chat: {
      id: 67890,
    },
    text: 'Hello, bot!',
  };

  it('extracts basic context from message', () => {
    const result = extractWebhookContext(baseMessage);

    expect(result.userId).toBe(12345);
    expect(result.chatId).toBe(67890);
    expect(result.text).toBe('Hello, bot!');
    expect(result.username).toBe('testuser');
    expect(result.messageId).toBe(123);
  });

  it('extracts messageId for reply threading', () => {
    const result = extractWebhookContext(baseMessage);

    expect(result.messageId).toBe(123);
  });

  it('sets startTime to current timestamp', () => {
    const before = Date.now();
    const result = extractWebhookContext(baseMessage);
    const after = Date.now();

    expect(result.startTime).toBeGreaterThanOrEqual(before);
    expect(result.startTime).toBeLessThanOrEqual(after);
  });

  describe('quoted messages', () => {
    it('extracts quoted message fields when reply_to_message present', () => {
      const messageWithReply: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          from: {
            id: 99999,
            username: 'quoteduser',
            first_name: 'Quoted',
          },
          text: 'Original message content',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(messageWithReply);

      expect(result.replyToMessageId).toBe(100);
      expect(result.quotedText).toBe('Original message content');
      expect(result.quotedUsername).toBe('quoteduser');
    });

    it('handles reply_to_message without text (e.g., photos)', () => {
      const messageWithReplyNoText: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          from: {
            id: 99999,
            username: 'quoteduser',
            first_name: 'Quoted',
          },
          date: 1700000000,
          // No text field
        },
      };

      const result = extractWebhookContext(messageWithReplyNoText);

      expect(result.replyToMessageId).toBe(100);
      expect(result.quotedText).toBeUndefined();
      expect(result.quotedUsername).toBe('quoteduser');
    });

    it('handles reply_to_message without username', () => {
      const messageWithReplyNoUsername: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          from: {
            id: 99999,
            first_name: 'Quoted',
            // No username
          },
          text: 'Quoted text',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(messageWithReplyNoUsername);

      expect(result.replyToMessageId).toBe(100);
      expect(result.quotedText).toBe('Quoted text');
      expect(result.quotedUsername).toBeUndefined();
    });

    it('sets undefined for quoted fields when no reply_to_message', () => {
      const result = extractWebhookContext(baseMessage);

      expect(result.replyToMessageId).toBeUndefined();
      expect(result.quotedText).toBeUndefined();
      expect(result.quotedUsername).toBeUndefined();
    });
  });
});
