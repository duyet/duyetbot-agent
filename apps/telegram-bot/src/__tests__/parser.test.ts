/**
 * Tests for Telegram webhook parser middleware
 */

import { describe, expect, it } from 'vitest';
import { extractWebhookContext, parseCallbackQuery } from '../middlewares/parser.js';
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
      type: 'private',
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

  describe('chat type extraction', () => {
    it('extracts private chat type', () => {
      const privateMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: 12345, type: 'private' },
      };

      const result = extractWebhookContext(privateMessage);

      expect(result.chatType).toBe('private');
      expect(result.isGroupChat).toBe(false);
    });

    it('extracts group chat type', () => {
      const groupMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: -100123456789, type: 'group', title: 'Test Group' },
      };

      const result = extractWebhookContext(groupMessage);

      expect(result.chatType).toBe('group');
      expect(result.chatTitle).toBe('Test Group');
      expect(result.isGroupChat).toBe(true);
    });

    it('extracts supergroup chat type', () => {
      const supergroupMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: -1001234567890, type: 'supergroup', title: 'Test Supergroup' },
      };

      const result = extractWebhookContext(supergroupMessage);

      expect(result.chatType).toBe('supergroup');
      expect(result.chatTitle).toBe('Test Supergroup');
      expect(result.isGroupChat).toBe(true);
    });

    it('defaults to private when type is missing (backward compatibility)', () => {
      const legacyMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: 12345 }, // No type field
      };

      const result = extractWebhookContext(legacyMessage);

      expect(result.chatType).toBe('private');
      expect(result.isGroupChat).toBe(false);
    });

    it('extracts channel chat type', () => {
      const channelMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: -1001234567890, type: 'channel', title: 'Test Channel' },
      };

      const result = extractWebhookContext(channelMessage);

      expect(result.chatType).toBe('channel');
      expect(result.isGroupChat).toBe(false); // Channels are not groups
    });
  });

  describe('mention detection', () => {
    it('detects @duyetbot mention in message', () => {
      const mentionMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: '@duyetbot hello world',
      };

      const result = extractWebhookContext(mentionMessage);

      expect(result.hasBotMention).toBe(true);
      expect(result.task).toBe('hello world');
    });

    it('detects mention with custom bot username', () => {
      const mentionMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: '@mybot please help',
      };

      const result = extractWebhookContext(mentionMessage, 'mybot');

      expect(result.hasBotMention).toBe(true);
      expect(result.task).toBe('please help');
    });

    it('returns false when no mention present', () => {
      const noMentionMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: 'just a regular message',
      };

      const result = extractWebhookContext(noMentionMessage);

      expect(result.hasBotMention).toBe(false);
      expect(result.task).toBeUndefined();
    });

    it('is case insensitive for mention', () => {
      const upperCaseMention: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: '@DUYETBOT hello',
      };

      const result = extractWebhookContext(upperCaseMention);

      expect(result.hasBotMention).toBe(true);
      expect(result.task).toBe('hello');
    });

    it('does not match partial username mentions', () => {
      const partialMention: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: '@duyetbot2 hello',
      };

      const result = extractWebhookContext(partialMention);

      expect(result.hasBotMention).toBe(false);
    });

    it('handles mention at end of message', () => {
      const endMention: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: 'hello @duyetbot',
      };

      const result = extractWebhookContext(endMention);

      // hasMention returns true if @duyetbot is anywhere in text
      expect(result.hasBotMention).toBe(true);
    });
  });

  describe('reply detection', () => {
    it('detects reply to bot message', () => {
      const replyToBot: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        text: 'follow up question',
        reply_to_message: {
          message_id: 100,
          from: {
            id: 987654321,
            is_bot: true,
            username: 'duyetbot',
            first_name: 'DuyetBot',
          },
          text: 'Previous bot response',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyToBot);

      expect(result.isReply).toBe(true);
      expect(result.isReplyToBot).toBe(true);
    });

    it('detects reply to bot with case-insensitive username', () => {
      const replyToBot: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          from: {
            id: 987654321,
            username: 'DuyetBot', // Different case
            first_name: 'DuyetBot',
          },
          text: 'Previous bot response',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyToBot);

      expect(result.isReplyToBot).toBe(true);
    });

    it('detects reply to non-bot user (isReply true, isReplyToBot false)', () => {
      const replyToHuman: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          from: {
            id: 99999,
            username: 'humanuser',
            first_name: 'Human',
          },
          text: 'Human message',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyToHuman);

      expect(result.isReply).toBe(true);
      expect(result.isReplyToBot).toBe(false);
    });

    it('returns false for both isReply and isReplyToBot when no reply_to_message', () => {
      const result = extractWebhookContext(baseMessage);

      expect(result.isReply).toBe(false);
      expect(result.isReplyToBot).toBe(false);
    });

    it('isReply true but isReplyToBot false when reply_to_message has no from', () => {
      const replyNoFrom: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        reply_to_message: {
          message_id: 100,
          // No from field (edge case - system messages)
          text: 'Some message',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyNoFrom);

      expect(result.isReply).toBe(true);
      expect(result.isReplyToBot).toBe(false);
    });
  });

  describe('group chat behavior', () => {
    const groupMessage: NonNullable<TelegramUpdate['message']> = {
      ...baseMessage,
      chat: { id: -100123456789, type: 'group', title: 'Test Group' },
    };

    it('private chat without mention sets isGroupChat false', () => {
      const result = extractWebhookContext(baseMessage);

      expect(result.isGroupChat).toBe(false);
      expect(result.hasBotMention).toBe(false);
    });

    it('group message without mention or reply has correct flags', () => {
      const noMentionGroup: NonNullable<TelegramUpdate['message']> = {
        ...groupMessage,
        text: 'just chatting in the group',
      };

      const result = extractWebhookContext(noMentionGroup);

      expect(result.isGroupChat).toBe(true);
      expect(result.hasBotMention).toBe(false);
      expect(result.isReply).toBe(false);
      expect(result.isReplyToBot).toBe(false);
    });

    it('group message with mention has correct flags', () => {
      const mentionGroup: NonNullable<TelegramUpdate['message']> = {
        ...groupMessage,
        text: '@duyetbot please help with this',
      };

      const result = extractWebhookContext(mentionGroup);

      expect(result.isGroupChat).toBe(true);
      expect(result.hasBotMention).toBe(true);
      expect(result.task).toBe('please help with this');
    });

    it('group message replying to bot has correct flags', () => {
      const replyToBot: NonNullable<TelegramUpdate['message']> = {
        ...groupMessage,
        text: 'thanks for that',
        reply_to_message: {
          message_id: 100,
          from: {
            id: 987654321,
            is_bot: true,
            username: 'duyetbot',
            first_name: 'DuyetBot',
          },
          text: 'Bot response',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyToBot);

      expect(result.isGroupChat).toBe(true);
      expect(result.hasBotMention).toBe(false);
      expect(result.isReply).toBe(true);
      expect(result.isReplyToBot).toBe(true);
    });

    it('group message replying to human user has correct flags (isReply triggers processing)', () => {
      const replyToHuman: NonNullable<TelegramUpdate['message']> = {
        ...groupMessage,
        text: 'I agree with this',
        reply_to_message: {
          message_id: 100,
          from: {
            id: 99999,
            username: 'humanuser',
            first_name: 'Human',
          },
          text: 'Some human message',
          date: 1700000000,
        },
      };

      const result = extractWebhookContext(replyToHuman);

      expect(result.isGroupChat).toBe(true);
      expect(result.hasBotMention).toBe(false);
      expect(result.isReply).toBe(true);
      expect(result.isReplyToBot).toBe(false);
      // This should trigger processing because isReply is true
    });

    it('supergroup has same behavior as group', () => {
      const supergroupMessage: NonNullable<TelegramUpdate['message']> = {
        ...baseMessage,
        chat: { id: -1001234567890, type: 'supergroup', title: 'Test Supergroup' },
        text: '@duyetbot hello',
      };

      const result = extractWebhookContext(supergroupMessage);

      expect(result.isGroupChat).toBe(true);
      expect(result.hasBotMention).toBe(true);
    });
  });
});

describe('parseCallbackQuery', () => {
  const baseCallback: NonNullable<TelegramUpdate['callback_query']> = {
    id: 'callback_123',
    from: {
      id: 12345,
      username: 'testuser',
      first_name: 'Test',
    },
    chat_instance: 'chat_instance_123',
    message: {
      message_id: 456,
      chat: {
        id: 67890,
      },
    },
    data: 'button_clicked',
  };

  it('parses valid callback query', () => {
    const result = parseCallbackQuery(baseCallback);

    expect(result).not.toBeNull();
    expect(result!.callbackQueryId).toBe('callback_123');
    expect(result!.userId).toBe(12345);
    expect(result!.username).toBe('testuser');
    expect(result!.chatId).toBe(67890);
    expect(result!.messageId).toBe(456);
    expect(result!.data).toBe('button_clicked');
  });

  it('sets startTime to current timestamp', () => {
    const before = Date.now();
    const result = parseCallbackQuery(baseCallback);
    const after = Date.now();

    expect(result).not.toBeNull();
    expect(result!.startTime).toBeGreaterThanOrEqual(before);
    expect(result!.startTime).toBeLessThanOrEqual(after);
  });

  it('returns null when missing callback ID', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      id: '', // Empty ID
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('returns null when missing from field', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      from: undefined as any, // Missing from
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('returns null when data is undefined', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      data: undefined,
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('returns null when data is empty string', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      data: '   ', // Whitespace only
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('trims whitespace from data payload', () => {
    const callbackWithWhitespace: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      data: '  button_clicked  ',
    };

    const result = parseCallbackQuery(callbackWithWhitespace);

    expect(result).not.toBeNull();
    expect(result!.data).toBe('button_clicked');
  });

  it('returns null when missing message', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      message: undefined,
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('returns null when message missing message_id', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      message: {
        message_id: undefined as any,
        chat: {
          id: 67890,
        },
      },
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('returns null when message missing chat id', () => {
    const invalidCallback: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      message: {
        message_id: 456,
        chat: {
          id: undefined as any,
        },
      },
    };

    const result = parseCallbackQuery(invalidCallback);
    expect(result).toBeNull();
  });

  it('handles callback without username', () => {
    const callbackNoUsername: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      from: {
        id: 12345,
        // No username
        first_name: 'Test',
      },
    };

    const result = parseCallbackQuery(callbackNoUsername);

    expect(result).not.toBeNull();
    expect(result!.username).toBeUndefined();
    expect(result!.userId).toBe(12345);
  });

  it('preserves complex data payloads', () => {
    const complexData = 'action:update|id:123|value:test';
    const callbackWithComplexData: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      data: complexData,
    };

    const result = parseCallbackQuery(callbackWithComplexData);

    expect(result).not.toBeNull();
    expect(result!.data).toBe(complexData);
  });

  it('handles large data payloads', () => {
    const largeData = 'x'.repeat(1000);
    const callbackWithLargeData: NonNullable<TelegramUpdate['callback_query']> = {
      ...baseCallback,
      data: largeData,
    };

    const result = parseCallbackQuery(callbackWithLargeData);

    expect(result).not.toBeNull();
    expect(result!.data).toBe(largeData);
  });
});
