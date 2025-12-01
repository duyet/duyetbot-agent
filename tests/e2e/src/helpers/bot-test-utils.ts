/**
 * Bot testing utilities for E2E testing
 *
 * This module provides utilities for testing bot behavior including:
 * - Telegram webhook simulation
 * - Message formatting validation
 * - Response timing and content analysis
 * - Parse mode detection and validation
 */

import { createTelegramBot, type TelegramBot } from '@duyetbot/telegram-bot';
import type { Message, Update } from 'telegram-bot-api-types';
import { getPerformanceThresholds, parseModeTestConfig } from './test-providers';

/**
 * Create a mock Telegram update for testing
 */
export function createMockUpdate(
  message: string,
  options: {
    userId?: number;
    chatId?: number;
    messageId?: number;
    parseMode?: 'HTML' | 'MarkdownV2';
  } = {}
): Update {
  const { userId = 12345, chatId = 12345, messageId = 1, parseMode = 'HTML' } = options;

  return {
    update_id: Date.now(),
    message: {
      message_id: messageId,
      from: {
        id: userId,
        is_bot: false,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      },
      chat: {
        id: chatId,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: message,
      entities:
        parseMode === 'MarkdownV2'
          ? [
              {
                type: 'bold',
                offset: message.indexOf('*') + 1,
                length: message.split('*')[1]?.length || 0,
              },
            ]
          : [],
    },
  } as Update;
}

/**
 * Create a mock Telegram bot instance for testing
 */
export async function createMockTelegramBot(): Promise<TelegramBot> {
  // Create bot with test configuration
  const bot = await createTelegramBot({
    // Mock environment for testing
    env: {
      TELEGRAM_BOT_TOKEN: 'test_token',
      AI_GATEWAY_NAME: 'test-gateway',
      AI_GATEWAY_API_KEY: 'test-key',
      MODEL: 'test-model',
    },
    // Mock bindings
    bindings: {},
  });

  return bot;
}

/**
 * Extract messages from bot API calls for validation
 */
export interface ExtractedMessage {
  text: string;
  parseMode?: string;
  replyToMessageId?: number;
  chatId: number;
  timestamp: number;
}

/**
 * Mock Telegram API calls and extract sent messages
 */
export function setupTelegramAPISpy(bot: TelegramBot): {
  getSentMessages: () => ExtractedMessage[];
  clearMessages: () => void;
} {
  const sentMessages: ExtractedMessage[] = [];

  // Spy on bot's sendMessage method
  const originalSendMessage = bot.sendMessage;
  bot.sendMessage = async (chatId: number, text: string, options?: any) => {
    sentMessages.push({
      text,
      parseMode: options?.parse_mode,
      replyToMessageId: options?.reply_to_message_id,
      chatId,
      timestamp: Date.now(),
    });

    // Mock successful response
    return {
      message_id: sentMessages.length,
      date: Math.floor(Date.now() / 1000),
      text,
      chat: {
        id: chatId,
        type: 'private',
      },
    };
  };

  return {
    getSentMessages: () => [...sentMessages],
    clearMessages: () => {
      sentMessages.length = 0;
    },
  };
}

/**
 * Validate message response against expectations
 */
export function validateMessageResponse(
  sentMessage: ExtractedMessage,
  expectations: {
    minLength?: number;
    maxLength?: number;
    containsText?: string[];
    parseMode?: string;
    isReplyTo?: number;
    maxResponseTime?: number;
  },
  actualResponseTime?: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const {
    minLength = 1,
    maxLength = 4096,
    containsText = [],
    parseMode: expectedParseMode,
    isReplyTo,
    maxResponseTime,
  } = expectations;

  // Content validation
  if (sentMessage.text.length < minLength) {
    errors.push(`Response too short: ${sentMessage.text.length} < ${minLength}`);
  }

  if (sentMessage.text.length > maxLength) {
    errors.push(`Response too long: ${sentMessage.text.length} > ${maxLength}`);
  }

  // Required text validation
  for (const requiredText of containsText) {
    if (!sentMessage.text.toLowerCase().includes(requiredText.toLowerCase())) {
      errors.push(`Missing required text: "${requiredText}"`);
    }
  }

  // Parse mode validation
  if (expectedParseMode && sentMessage.parseMode !== expectedParseMode) {
    errors.push(
      `Parse mode mismatch: expected "${expectedParseMode}", got "${sentMessage.parseMode}"`
    );
  }

  // Reply validation
  if (isReplyTo && sentMessage.replyToMessageId !== isReplyTo) {
    errors.push(
      `Reply to wrong message: expected ${isReplyTo}, got ${sentMessage.replyToMessageId}`
    );
  }

  // Performance validation
  if (actualResponseTime && maxResponseTime) {
    if (actualResponseTime > maxResponseTime) {
      warnings.push(
        `Response time exceeded threshold: ${actualResponseTime}ms > ${maxResponseTime}ms`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Test message formatting for different parse modes
 */
export function testParseModeFormatting(
  message: string,
  parseMode: 'HTML' | 'MarkdownV2'
): {
  formattedMessage: string;
  hasValidEntities: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (parseMode === 'HTML') {
    // HTML formatting validation
    const hasInvalidTags = /<\/?(?!b|i|u|s|a|code|pre)[^>]*>/i.test(message);
    if (hasInvalidTags) {
      warnings.push('Contains unsupported HTML tags');
    }

    return {
      formattedMessage: message,
      hasValidEntities: !hasInvalidTags,
      warnings,
    };
  }

  if (parseMode === 'MarkdownV2') {
    // MarkdownV2 special characters that need escaping
    const specialChars = [
      '_',
      '*',
      '[',
      ']',
      '(',
      ')',
      '~',
      '`',
      '>',
      '#',
      '+',
      '-',
      '=',
      '|',
      '{',
      '}',
      '.',
      '!',
    ];
    const unescapedChars = specialChars.filter((char) => {
      const regex = new RegExp(`(?<!\\\\)${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
      return regex.test(message) && !message.includes(`\\${char}`);
    });

    if (unescapedChars.length > 0) {
      warnings.push(`Unescaped MarkdownV2 characters: ${unescapedChars.join(', ')}`);
    }

    return {
      formattedMessage: message,
      hasValidEntities: unescapedChars.length === 0,
      warnings,
    };
  }

  return {
    formattedMessage: message,
    hasValidEntities: true,
    warnings: [],
  };
}

/**
 * Measure response time for a bot operation
 */
export async function measureResponseTime<T>(
  operation: () => Promise<T>
): Promise<{ result: T; responseTime: number }> {
  const startTime = Date.now();
  const result = await operation();
  const responseTime = Date.now() - startTime;

  return { result, responseTime };
}

/**
 * Create test scenarios for different message types
 */
export function createTestScenarios() {
  const thresholds = getPerformanceThresholds();

  return {
    simpleMessages: parseModeTestConfig.testMessages.simple.map((text) => ({
      input: text,
      expectations: {
        minLength: thresholds.simpleMessage.minResponseLength,
        maxLength: thresholds.simpleMessage.maxResponseLength,
        maxResponseTime: thresholds.simpleMessage.maxResponseTime,
      },
    })),

    formattedMessages: parseModeTestConfig.testMessages.formatted.map((text) => ({
      input: text,
      expectations: {
        minLength: 10,
        maxLength: 2000,
        containsText: text.match(/`([^`]+)`/)?.[1] ? [text.match(/`([^`]+)`/)?.[1]!] : [],
      },
    })),

    complexMessages: parseModeTestConfig.testMessages.complex.map((text) => ({
      input: text,
      expectations: {
        minLength: thresholds.complexQuery.minResponseLength,
        maxResponseTime: thresholds.complexQuery.maxResponseTime,
      },
    })),
  };
}

/**
 * Validate web search responses
 */
export function validateWebSearchResponse(
  response: string,
  expectations: {
    requiresCitations: boolean;
    hasCurrentInfo?: boolean;
    maxResponseTime?: number;
  },
  actualResponseTime?: number
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasCitations: boolean;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for citations (URLs in response)
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const citations = response.match(urlRegex) || [];
  const hasCitations = citations.length > 0;

  if (expectations.requiresCitations && !hasCitations) {
    errors.push('Response requires citations but none found');
  }

  // Basic content validation
  if (response.length < 50) {
    errors.push('Web search response too short');
  }

  // Performance validation
  if (actualResponseTime && expectations.maxResponseTime) {
    if (actualResponseTime > expectations.maxResponseTime) {
      warnings.push(
        `Web search response time exceeded threshold: ${actualResponseTime}ms > ${expectations.maxResponseTime}ms`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    hasCitations,
  };
}
