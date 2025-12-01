/**
 * Real API E2E Tests for Telegram Bot
 *
 * This test suite validates Telegram bot behavior with real LLM APIs,
 * including simple responses, message formatting, and parse mode handling.
 *
 * Tests run only when AI Gateway environment is properly configured.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMockTelegramBot,
  createMockUpdate,
  createTestScenarios,
  measureResponseTime,
  setupTelegramAPISpy,
  validateMessageResponse,
} from '../helpers/bot-test-utils';
import {
  getTestProvider,
  isRealAPITestingAvailable,
  testEnvironment,
} from '../helpers/test-providers';

describe('Telegram Bot - Real API E2E Tests', () => {
  let bot: any;
  let apiSpy: any;

  beforeAll(async () => {
    // Skip tests if real API environment not available
    if (!isRealAPITestingAvailable()) {
      console.warn('⚠️ Skipping real API tests - environment not configured');
      return;
    }

    try {
      bot = await createMockTelegramBot();
      apiSpy = setupTelegramAPISpy(bot);

      console.log('🤖 Telegram bot created for real API testing');
    } catch (error) {
      console.error('❌ Failed to create Telegram bot:', error);
      throw error;
    }
  });

  afterAll(() => {
    if (apiSpy) {
      apiSpy.clearMessages();
    }
  });

  describe('Simple Message Responses', () => {
    it('should respond to "hi" with appropriate greeting', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('hi', { messageId: 1 });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 5,
          maxLength: 500,
          containsText: ['hello', 'hi', 'hey'],
          maxResponseTime: 10000, // 10s for real API
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
      if (validation.warnings.length > 0) {
        console.warn('Warnings:', validation.warnings);
      }
    });

    it('should respond to "hello" with contextual greeting', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('hello', { messageId: 2 });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 5,
          maxLength: 500,
          containsText: ['hello', 'hey', 'greetings'],
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should respond to "help" with assistance information', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('help', { messageId: 3 });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 20,
          maxLength: 2000,
          containsText: ['help', 'assist', 'command', 'available'],
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Message Context Processing', () => {
    it('should maintain conversation context across messages', async () => {
      if (!isRealAPITestingAvailable()) return;

      apiSpy.clearMessages();

      // First message
      const update1 = createMockUpdate('My name is Alice', { messageId: 4 });
      await bot.handleUpdate(update1);

      // Second message that references context
      const update2 = createMockUpdate('What is my name?', { messageId: 5 });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update2));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThanOrEqual(2);

      const lastResponse = sentMessages[sentMessages.length - 1];
      const validation = validateMessageResponse(
        lastResponse,
        {
          minLength: 5,
          maxLength: 500,
          containsText: ['alice', 'name'],
          maxResponseTime: 15000, // Slightly longer for context processing
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });

    it('should handle follow-up questions appropriately', async () => {
      if (!isRealAPITestingAvailable()) return;

      apiSpy.clearMessages();

      // Initial context
      const update1 = createMockUpdate('I live in New York', { messageId: 6 });
      await bot.handleUpdate(update1);

      // Follow-up question
      const update2 = createMockUpdate('What time is it there?', {
        messageId: 7,
      });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update2));

      const sentMessages = apiSpy.getSentMessages();
      const lastResponse = sentMessages[sentMessages.length - 1];

      const validation = validateMessageResponse(
        lastResponse,
        {
          minLength: 10,
          maxLength: 1000,
          containsText: ['time', 'york', 'new york'],
          maxResponseTime: 15000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty messages gracefully', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('', { messageId: 8 });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      // Should either not respond or provide helpful message
      expect(sentMessages.length).toBeLessThanOrEqual(1);

      if (sentMessages.length === 1) {
        const [response] = sentMessages;
        const validation = validateMessageResponse(
          response,
          {
            minLength: 5,
            maxLength: 500,
            containsText: ['message', 'empty', 'help'],
            maxResponseTime: 10000,
          },
          responseTime
        );

        expect(validation.isValid).toBe(true);
      }
    });

    it('should handle very long messages without errors', async () => {
      if (!isRealAPITestingAvailable()) return;

      const longMessage = 'This is a very long message. '.repeat(100); // ~3000 chars
      const update = createMockUpdate(longMessage, { messageId: 9 });

      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages.length).toBeGreaterThan(0);

      const responses = sentMessages.slice(-2); // Check last 2 responses (might be split)
      const totalLength = responses.reduce((sum, msg) => sum + msg.text.length, 0);

      expect(totalLength).toBeGreaterThan(50); // Should respond meaningfully
      expect(responseTime).toBeLessThan(30000); // Should handle within 30s
    });

    it('should handle special characters correctly', async () => {
      if (!isRealAPITestingAvailable()) return;

      const specialMessage = 'Test with emojis 🎉 and special chars: @#$%^&*()';
      const update = createMockUpdate(specialMessage, { messageId: 10 });

      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 5,
          maxLength: 1000,
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
      // Response should handle the input appropriately
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('Parse Mode Handling', () => {
    it('should use HTML parse mode by default', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('Show me some *bold* text', {
        messageId: 11,
      });
      await bot.handleUpdate(update);

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      expect(response.parseMode).toBe('HTML');
    });

    it('should handle message formatting correctly', async () => {
      if (!isRealAPITestingAvailable()) return;

      const update = createMockUpdate('Format this: *bold*, _italic_, `code`', {
        messageId: 12,
      });
      const { result, responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

      const sentMessages = apiSpy.getSentMessages();
      expect(sentMessages).toHaveLength(1);

      const [response] = sentMessages;
      const validation = validateMessageResponse(
        response,
        {
          minLength: 10,
          maxLength: 1000,
          parseMode: 'HTML',
          maxResponseTime: 10000,
        },
        responseTime
      );

      expect(validation.isValid).toBe(true);
      // Response should demonstrate understanding of formatting
      expect(response.text.length).toBeGreaterThan(20);
    });
  });

  describe('Performance and Reliability', () => {
    it('should respond within acceptable time limits', async () => {
      if (!isRealAPITestingAvailable()) return;

      const simpleMessages = ['hi', 'hello', 'help'];
      const responseTimes: number[] = [];

      for (let i = 0; i < simpleMessages.length; i++) {
        apiSpy.clearMessages();

        const update = createMockUpdate(simpleMessages[i], {
          messageId: 20 + i,
        });
        const { responseTime } = await measureResponseTime(() => bot.handleUpdate(update));

        responseTimes.push(responseTime);

        // Add small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Most responses should be under threshold
      const fastResponses = responseTimes.filter((time) => time <= 10000).length;
      const responseRate = fastResponses / responseTimes.length;

      expect(responseRate).toBeGreaterThanOrEqual(0.8); // At least 80% fast responses

      const avgResponseTime =
        responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(15000); // Average under 15s
    });

    it('should handle concurrent requests appropriately', async () => {
      if (!isRealAPITestingAvailable()) return;

      apiSpy.clearMessages();

      // Send multiple concurrent requests
      const messages = ['hi', 'hello', 'help'];
      const updatePromises = messages.map((msg, index) => {
        const update = createMockUpdate(msg, { messageId: 30 + index });
        return bot.handleUpdate(update);
      });

      const results = await Promise.all(updatePromises);
      const sentMessages = apiSpy.getSentMessages();

      // Should respond to all requests
      expect(sentMessages.length).toBe(messages.length);

      // All responses should be valid
      sentMessages.forEach((response, index) => {
        const validation = validateMessageResponse(response, {
          minLength: 5,
          maxLength: 1000,
          maxResponseTime: 20000, // Longer for concurrent
        });

        expect(validation.isValid).toBe(true);
      });
    });
  });

  describe('Environment and Configuration', () => {
    it('should use correct test environment configuration', () => {
      expect(testEnvironment.hasRealAPI).toBe(isRealAPITestingAvailable());
      expect(testEnvironment.configuredModel).toBeDefined();
      expect(testEnvironment.gatewayName).toBe('duyetbot');
    });

    it('should properly initialize test provider', () => {
      const provider = getTestProvider();
      if (isRealAPITestingAvailable()) {
        expect(provider).toBeDefined();
      } else {
        expect(provider).toBeNull();
      }
    });
  });
});
