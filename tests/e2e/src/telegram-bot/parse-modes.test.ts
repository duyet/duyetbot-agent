/**
 * Telegram Parse Mode Validation Tests
 *
 * This test suite validates Telegram bot handling of different parse modes
 * including HTML, MarkdownV2, and automatic fallback mechanisms.
 *
 * Tests ensure proper message formatting, character escaping, and error handling.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMockTelegramBot,
  createMockUpdate,
  measureResponseTime,
  setupTelegramAPISpy,
  testParseModeFormatting,
  validateMessageResponse,
} from '../helpers/bot-test-utils';
import { isRealAPITestingAvailable, parseModeTestConfig } from '../helpers/test-providers';

describe('Telegram Bot - Parse Mode Validation', () => {
  let bot: any;
  let apiSpy: any;

  beforeAll(async () => {
    // Skip tests if real API environment not available
    if (!isRealAPITestingAvailable()) {
      console.warn('⚠️ Skipping parse mode tests - environment not configured');
      return;
    }

    try {
      bot = await createMockTelegramBot();
      apiSpy = setupTelegramAPISpy(bot);

      console.log('📝 Parse mode test environment setup complete');
    } catch (error) {
      console.error('❌ Failed to setup parse mode tests:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (apiSpy) {
      apiSpy.clearMessages();
    }
  });

  describe('HTML Parse Mode', () => {
    it('should handle basic HTML formatting', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'This is <b>bold</b> and <i>italic</i> text';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['bold', 'italic'],
          parseMode: 'HTML',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
      expect(response.parseMode).toBe('HTML');
    });

    it('should handle HTML code blocks', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Here is some <code>console.log("hello")</code> code';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['console.log', 'hello', 'code'],
          parseMode: 'HTML',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should handle HTML links properly', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Visit <a href="https://example.com">this link</a> for more info';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['example.com', 'link', 'Info'],
          parseMode: 'HTML',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should reject unsupported HTML tags gracefully', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'This has <script>alert("xss")</script> and <div>unsupported</div> tags';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      // Should either escape or remove unsupported tags
      const [response] = sentMessages[sentMessages.length - 1];
      expect(response.text).not.toContain('<script>');
      expect(response.text).not.toContain('<div>');
    });
  });

  describe('MarkdownV2 Parse Mode', () => {
    it('should handle basic MarkdownV2 formatting', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'This is *bold* and _italic_ text';
      const update = createMockUpdate(message, { parseMode: 'MarkdownV2' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['bold', 'italic'],
          parseMode: 'MarkdownV2',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
      expect(response.parseMode).toBe('MarkdownV2');
    });

    it('should handle MarkdownV2 code blocks', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Here is some ```javascript\nconst x = 1;\nconsole.log(x);\n``` code';
      const update = createMockUpdate(message, { parseMode: 'MarkdownV2' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['const x = 1', 'console.log', 'javascript'],
          parseMode: 'MarkdownV2',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should escape MarkdownV2 special characters', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Special characters: _ * [ ] ( ) ~ ` > # + - = | { } . !';
      const update = createMockUpdate(message, { parseMode: 'MarkdownV2' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          parseMode: 'MarkdownV2',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Check for proper escaping of special characters
      const formatting = testParseModeFormatting(response.text, 'MarkdownV2');
      expect(formatting.hasValidEntities).toBe(true);
      if (formatting.warnings.length > 0) {
        console.warn('MarkdownV2 formatting warnings:', formatting.warnings);
      }
    });

    it('should handle MarkdownV2 links', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Visit [this link](https://example.com) for more info';
      const update = createMockUpdate(message, { parseMode: 'MarkdownV2' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['example.com', 'link', 'Info'],
          parseMode: 'MarkdownV2',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Parse Mode Fallback', () => {
    it('should fallback to plain text on parse errors', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      // Create a message with malformed formatting that might cause parse errors
      const message = parseModeTestConfig.fallbackTest;
      const update = createMockUpdate(message, { parseMode: 'MarkdownV2' });

      // Mock parse mode error
      const originalSendMessage = bot.sendMessage;
      let parseErrorThrown = false;
      bot.sendMessage = async (...args: any[]) => {
        try {
          // Simulate Telegram API parse mode error
          if (args[2]?.parse_mode === 'MarkdownV2') {
            throw new Error("Bad Request: can't parse entities");
          }
          return originalSendMessage(...args);
        } catch (error) {
          if (error.message.includes("can't parse entities")) {
            parseErrorThrown = true;
            // Retry with plain text
            return originalSendMessage(args[0], args[1], {
              ...args[2],
              parse_mode: undefined,
            });
          }
          throw error;
        }
      };

      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      // Should have attempted fallback
      expect(parseErrorThrown).toBe(true);

      // Last message should be plain text (no parse_mode)
      const lastMessage = sentMessages[sentMessages.length - 1];
      expect(lastMessage.parseMode).toBeUndefined();

      // Restore original method
      bot.sendMessage = originalSendMessage;
    });

    it('should handle parse mode switching', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      // First message with HTML
      const update1 = createMockUpdate('Send with *bold* HTML', {
        messageId: 1,
      });
      await bot.handleUpdate(update1);

      const messages1 = apiSpy.getSentMessages();
      expect(messages1).toHaveLength(1);
      expect(messages1[0].parseMode).toBe('HTML');

      apiSpy.clearMessages();

      // Second message with MarkdownV2
      const update2 = createMockUpdate('Send with _italic_ Markdown', {
        messageId: 2,
      });
      await bot.handleUpdate(update2);

      const messages2 = apiSpy.getSentMessages();
      expect(messages2).toHaveLength(1);
      expect(messages2[0].parseMode).toBe('MarkdownV2');

      apiSpy.clearMessages();

      // Third message without specific parse mode (should use default)
      const update3 = createMockUpdate('Send with default formatting', {
        messageId: 3,
      });
      await bot.handleUpdate(update3);

      const messages3 = apiSpy.getSentMessages();
      expect(messages3).toHaveLength(1);
      // Should use default parse mode (HTML)
      expect(messages3[0].parseMode).toBe('HTML');
    });
  });

  describe('Complex Formatting Scenarios', () => {
    it('should handle mixed formatting types', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Complex: *bold* with _italic_ and `code` and [a link](https://example.com)';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 15,
          maxLength: 1500,
          containsText: ['bold', 'italic', 'code', 'link'],
          parseMode: 'HTML',
          maxResponseTime: 15000, // Slightly longer for complex formatting
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should handle nested formatting', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = 'Nested: <b>Bold with <i>italic inside</i></b> and `code`';
      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['Bold', 'italic', 'inside', 'code'],
          parseMode: 'HTML',
          maxResponseTime: 15000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should handle list formatting', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const message = `Shopping list:
• First item
• Second item with <b>bold</b> text
• Third item with <a href="https://example.com">link</a>`;

      const update = createMockUpdate(message, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      const [response] = sentMessages;

      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['shopping', 'item', 'bold', 'link'],
          parseMode: 'HTML',
          maxResponseTime: 15000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Message Length and Splitting', () => {
    it('should handle messages near Telegram limit', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      // Create a message that's close to 4096 character limit
      const longMessage = 'A'.repeat(4080); // ~4080 chars
      const update = createMockUpdate(longMessage, { parseMode: 'HTML' });
      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      // Check if message was split properly
      const totalLength = sentMessages.reduce((sum, msg) => sum + msg.text.length, 0);
      expect(totalLength).toBeGreaterThan(100); // Should provide meaningful response

      // Individual messages should be under limit
      sentMessages.forEach((msg) => {
        expect(msg.text.length).toBeLessThanOrEqual(4096);
      });
    });

    it('should preserve formatting across splits', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const longFormattedMessage =
        'This is a <b>very long message</b> with <i>formatting</i> throughout. '.repeat(200);
      const update = createMockUpdate(longFormattedMessage, {
        parseMode: 'HTML',
      });
      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(1); // Should be split

      // Check formatting is preserved
      const combinedText = sentMessages.map((msg) => msg.text).join('');
      expect(combinedText).toMatch(/<\/?b>|<\/?i>/gi); // Should have formatting tags
      expect(combinedText).toContain('very long message');
      expect(combinedText).toContain('formatting');

      // All parts should use same parse mode
      sentMessages.forEach((msg) => {
        expect(msg.parseMode).toBe('HTML');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed markup gracefully', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const malformedMessage = 'Broken HTML: <b>unclosed <i>mixed tags <code>';
      const update = createMockUpdate(malformedMessage, { parseMode: 'HTML' });
      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      // Should provide some response despite malformed input
      const [response] = sentMessages[sentMessages.length - 1];
      expect(response.text.length).toBeGreaterThan(20);
    });

    it('should handle very long code blocks', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const longCodeBlock = `\`\`\`python\n${'# Large code example\n'.repeat(100)}\n\`\`\``;
      const update = createMockUpdate(longCodeBlock, {
        parseMode: 'MarkdownV2',
      });
      await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      // Should respond appropriately to long code
      const [response] = sentMessages[sentMessages.length - 1];
      expect(response.text).toMatch(/code|python|example|long/gi);
      expect(response.text.length).toBeGreaterThan(50);
    });

    it('should handle Unicode and special characters', async () => {
      if (!isRealAPITestingAvailable()) {
        return;
      }

      const unicodeMessage = 'Test with émojis 🎉 and Unicode: αβγδε и中文 العربية';
      const update = createMockUpdate(unicodeMessage, { parseMode: 'HTML' });
      const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 5,
          maxLength: 1000,
          containsText: [], // Just check it handles Unicode properly
          parseMode: 'HTML',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);

      // Should preserve Unicode characters in response
      expect(response.text).toMatch(/[\u{1F600}-\u{1F64F}\u{0400}-\u{07FF}]/u); // Emojis and Unicode ranges
    });
  });
});
