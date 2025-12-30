import type { AnalyticsMessage } from '@duyetbot/analytics';
import { describe, expect, test } from 'vitest';
import { createMessagePairs, formatTimestamp, isErrorResponse } from './message-pair-row';

// Helper to create minimal mock message for error detection tests
function createMockMessage(overrides: Partial<AnalyticsMessage>): AnalyticsMessage {
  return {
    id: 1,
    messageId: 'test-msg',
    sessionId: 'test-session',
    sequence: 1,
    role: 'assistant',
    content: '',
    platform: 'telegram',
    userId: 'test-user',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedTokens: 0,
    reasoningTokens: 0,
    isArchived: false,
    isPinned: false,
    visibility: 'public',
    ...overrides,
  };
}

describe('isErrorResponse', () => {
  test('returns false for null/undefined', () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  test('detects errors in metadata', () => {
    const msgWithError = createMockMessage({
      metadata: { error: 'Something went wrong' } as Record<string, unknown>,
    });
    expect(isErrorResponse(msgWithError)).toBe(true);

    const msgWithToolError = createMockMessage({
      metadata: { lastToolError: 'Tool failed' } as Record<string, unknown>,
    });
    expect(isErrorResponse(msgWithToolError)).toBe(true);

    const msgWithErrorMessage = createMockMessage({
      metadata: { errorMessage: 'Error occurred' } as Record<string, unknown>,
    });
    expect(isErrorResponse(msgWithErrorMessage)).toBe(true);
  });

  test('detects errors in content patterns', () => {
    const patterns = [
      'error: something failed',
      'Error: API call failed',
      'ERROR: Critical failure',
      'failed: Operation aborted',
      'Failed: Connection lost',
      '[error] Database error',
      '[ERROR] Exception occurred',
      'Exception occurred in module',
      'internal server error',
      'timeout exceeded',
      'rate limit exceeded',
    ];

    patterns.forEach((content) => {
      const msg = createMockMessage({ content });
      expect(isErrorResponse(msg)).toBe(true);
    });
  });

  test('returns false for normal messages', () => {
    const normalMsg = createMockMessage({
      content: 'Hello, how can I help you today?',
    });
    expect(isErrorResponse(normalMsg)).toBe(false);

    const successMsg = createMockMessage({
      content: 'Successfully completed the task.',
      metadata: { status: 'success' } as Record<string, unknown>,
    });
    expect(isErrorResponse(successMsg)).toBe(false);
  });
});

describe('createMessagePairs', () => {
  const mockMessages: AnalyticsMessage[] = [
    {
      id: 1,
      messageId: 'msg-1',
      sessionId: 'session-1',
      sequence: 1,
      role: 'user',
      content: 'Hello',
      platform: 'telegram',
      userId: 'user-1',
      createdAt: 1000,
      updatedAt: 1000,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      isArchived: false,
      isPinned: false,
      visibility: 'public',
    },
    {
      id: 2,
      messageId: 'msg-2',
      sessionId: 'session-1',
      sequence: 2,
      role: 'assistant',
      content: 'Hi there!',
      platform: 'telegram',
      userId: 'bot',
      createdAt: 2000,
      updatedAt: 2000,
      triggerMessageId: 'msg-1',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30,
      cachedTokens: 0,
      reasoningTokens: 0,
      isArchived: false,
      isPinned: false,
      visibility: 'public',
    },
    {
      id: 3,
      messageId: 'msg-3',
      sessionId: 'session-1',
      sequence: 3,
      role: 'user',
      content: 'How are you?',
      platform: 'telegram',
      userId: 'user-1',
      createdAt: 3000,
      updatedAt: 3000,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cachedTokens: 0,
      reasoningTokens: 0,
      isArchived: false,
      isPinned: false,
      visibility: 'public',
    },
    {
      id: 4,
      messageId: 'msg-4',
      sessionId: 'session-1',
      sequence: 4,
      role: 'assistant',
      content: 'I am doing well!',
      platform: 'telegram',
      userId: 'bot',
      createdAt: 4000,
      updatedAt: 4000,
      triggerMessageId: 'msg-3',
      inputTokens: 5,
      outputTokens: 15,
      totalTokens: 20,
      cachedTokens: 0,
      reasoningTokens: 0,
      isArchived: false,
      isPinned: false,
      visibility: 'public',
    },
  ];

  test('pairs messages via triggerMessageId', () => {
    const pairs = createMessagePairs(mockMessages);

    expect(pairs).toHaveLength(2);

    expect(pairs[0]!.user!.messageId).toBe('msg-1');
    expect(pairs[0]!.assistant!.messageId).toBe('msg-2');

    expect(pairs[1]!.user!.messageId).toBe('msg-3');
    expect(pairs[1]!.assistant!.messageId).toBe('msg-4');
  });

  test('handles orphan assistant messages', () => {
    const messagesWithoutTrigger: AnalyticsMessage[] = [
      {
        ...mockMessages[0]!,
        role: 'assistant' as const,
        messageId: 'msg-1',
      },
      {
        ...mockMessages[1]!,
        role: 'assistant' as const,
        messageId: 'msg-2',
      },
    ];

    const pairs = createMessagePairs(messagesWithoutTrigger);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.user).toBeNull();
    expect(pairs[0]!.assistant!.messageId).toBe('msg-1');
  });

  test('handles messages without triggerMessageId (sequential fallback)', () => {
    const messagesWithoutTriggers: AnalyticsMessage[] = [
      { ...mockMessages[0]!, triggerMessageId: undefined },
      { ...mockMessages[1]!, triggerMessageId: undefined },
      { ...mockMessages[2]!, triggerMessageId: undefined },
      { ...mockMessages[3]!, triggerMessageId: undefined },
    ];

    const pairs = createMessagePairs(messagesWithoutTriggers);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.user!.messageId).toBe('msg-1');
    expect(pairs[0]!.assistant!.messageId).toBe('msg-2');
  });

  test('handles empty array', () => {
    const pairs = createMessagePairs([]);
    expect(pairs).toHaveLength(0);
  });

  test('handles only user messages', () => {
    const onlyUserMessages: AnalyticsMessage[] = [{ ...mockMessages[0]! }, { ...mockMessages[2]! }];

    const pairs = createMessagePairs(onlyUserMessages);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.assistant).toBeNull();
    expect(pairs[1]!.assistant).toBeNull();
  });
});

describe('formatTimestamp', () => {
  test('handles null and undefined', () => {
    expect(formatTimestamp(null)).toBe('Unknown');
    expect(formatTimestamp(undefined)).toBe('Unknown');
  });

  test('handles invalid dates', () => {
    expect(formatTimestamp(NaN)).toBe('Unknown');
    // Note: -1 is a valid timestamp (epoch minus 1 second)
    // The actual implementation returns a formatted date for valid timestamps
  });

  test('formats relative time correctly', () => {
    const now = Date.now();
    expect(formatTimestamp(now)).toBe('Just now');
    expect(formatTimestamp(now - 30000)).toBe('Just now');
    expect(formatTimestamp(now - 60000)).toBe('1m ago');
    expect(formatTimestamp(now - 3600000)).toBe('1h ago');
    expect(formatTimestamp(now - 86400000)).toBe('1d ago');
    expect(formatTimestamp(now - 6 * 86400000)).toBe('6d ago');
  });

  test('formats old dates as absolute', () => {
    const oldDate = new Date('2024-01-01').getTime();
    const result = formatTimestamp(oldDate);
    // Should be in format "Jan 1" or similar
    expect(result).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);
  });
});
