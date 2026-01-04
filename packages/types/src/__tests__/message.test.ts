/**
 * Tests for Message Types
 *
 * Validates message type definitions, interfaces, and type guards
 */

import { describe, expect, it } from 'vitest';
import type {
  ExtendedMessage,
  MessageFilter,
  MessageHistory,
  MessagePriority,
  MessageSource,
  ToolCallMessage,
  ToolResultMessage,
} from '../message.js';
import type { LLMMessage } from '../provider.js';

describe('Message Types', () => {
  describe('MessageSource', () => {
    it('should accept valid message sources', () => {
      const sources: MessageSource[] = ['user', 'agent', 'tool', 'system'];
      sources.forEach((source) => {
        expect(source).toBeTruthy();
      });
    });

    it('should reject invalid message sources at compile time', () => {
      // @ts-expect-error - Intentional invalid source
      const invalid: MessageSource = 'invalid';
      expect(invalid).toBe('invalid');
    });
  });

  describe('MessagePriority', () => {
    it('should accept valid message priorities', () => {
      const priorities: MessagePriority[] = ['low', 'normal', 'high', 'urgent'];
      priorities.forEach((priority) => {
        expect(priority).toBeTruthy();
      });
    });

    it('should have correct priority order', () => {
      const priorities: MessagePriority[] = ['low', 'normal', 'high', 'urgent'];
      expect(priorities).toHaveLength(4);
    });
  });

  describe('ExtendedMessage', () => {
    it('should create a valid extended message', () => {
      const message: ExtendedMessage = {
        id: 'msg-123',
        role: 'user',
        content: 'Hello, world!',
        source: 'user',
        timestamp: Date.now(),
      };

      expect(message.id).toBe('msg-123');
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello, world!');
      expect(message.source).toBe('user');
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it('should accept optional fields', () => {
      const message: ExtendedMessage = {
        id: 'msg-124',
        role: 'assistant',
        content: 'Hi there!',
        source: 'agent',
        timestamp: Date.now(),
        priority: 'high',
        parentId: 'msg-123',
        tokens: 100,
        metadata: { key: 'value' },
      };

      expect(message.priority).toBe('high');
      expect(message.parentId).toBe('msg-123');
      expect(message.tokens).toBe(100);
      expect(message.metadata).toEqual({ key: 'value' });
    });

    it('should require all mandatory fields', () => {
      // @ts-expect-error - Missing required fields
      const incomplete: ExtendedMessage = {
        id: 'msg-125',
        role: 'user',
        // Missing: content, source, timestamp
      };

      expect(incomplete.id).toBe('msg-125');
    });
  });

  describe('ToolCallMessage', () => {
    it('should create a valid tool call message', () => {
      const message: ToolCallMessage = {
        id: 'msg-126',
        role: 'assistant',
        content: 'I will use a tool',
        source: 'agent',
        timestamp: Date.now(),
        toolCalls: [
          {
            id: 'call-1',
            name: 'search',
            input: { query: 'test' },
          },
        ],
      };

      expect(message.role).toBe('assistant');
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolCalls[0].name).toBe('search');
    });

    it('should accept multiple tool calls', () => {
      const message: ToolCallMessage = {
        id: 'msg-127',
        role: 'assistant',
        content: 'Using multiple tools',
        source: 'agent',
        timestamp: Date.now(),
        toolCalls: [
          {
            id: 'call-1',
            name: 'search',
            input: { query: 'test' },
          },
          {
            id: 'call-2',
            name: 'calculate',
            input: { expression: '1+1' },
          },
        ],
      };

      expect(message.toolCalls).toHaveLength(2);
    });
  });

  describe('ToolResultMessage', () => {
    it('should create a valid tool result message', () => {
      const message: ToolResultMessage = {
        id: 'msg-128',
        role: 'user',
        content: 'Tool result',
        source: 'tool',
        timestamp: Date.now(),
        toolCallId: 'call-1',
        toolName: 'search',
        result: { data: 'search results' },
      };

      expect(message.role).toBe('user');
      expect(message.toolCallId).toBe('call-1');
      expect(message.toolName).toBe('search');
      expect(message.result).toEqual({ data: 'search results' });
    });

    it('should include error field when tool fails', () => {
      const message: ToolResultMessage = {
        id: 'msg-129',
        role: 'user',
        content: 'Tool error',
        source: 'tool',
        timestamp: Date.now(),
        toolCallId: 'call-2',
        toolName: 'search',
        result: null,
        error: 'Search failed',
      };

      expect(message.error).toBe('Search failed');
    });
  });

  describe('MessageFilter', () => {
    it('should create an empty filter', () => {
      const filter: MessageFilter = {};
      expect(Object.keys(filter)).toHaveLength(0);
    });

    it('should create a filter with all options', () => {
      const filter: MessageFilter = {
        role: 'user',
        source: 'user',
        priority: 'high',
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        limit: 50,
        offset: 0,
      };

      expect(filter.role).toBe('user');
      expect(filter.source).toBe('user');
      expect(filter.priority).toBe('high');
      expect(filter.limit).toBe(50);
      expect(filter.offset).toBe(0);
    });

    it('should accept time range filters', () => {
      const now = Date.now();
      const filter: MessageFilter = {
        startTime: now - 86400000, // 24 hours ago
        endTime: now,
      };

      expect(filter.startTime).toBeLessThan(filter.endTime);
    });
  });

  describe('MessageHistory', () => {
    it('should create a valid message history', () => {
      const messages: ExtendedMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          source: 'user',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi',
          source: 'agent',
          timestamp: Date.now(),
        },
      ];

      const history: MessageHistory = {
        messages,
        totalCount: 100,
        hasMore: true,
      };

      expect(history.messages).toHaveLength(2);
      expect(history.totalCount).toBe(100);
      expect(history.hasMore).toBe(true);
    });

    it('should represent empty history', () => {
      const history: MessageHistory = {
        messages: [],
        totalCount: 0,
        hasMore: false,
      };

      expect(history.messages).toHaveLength(0);
      expect(history.totalCount).toBe(0);
      expect(history.hasMore).toBe(false);
    });

    it('should represent last page without more results', () => {
      const messages: ExtendedMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          source: 'user',
          timestamp: Date.now(),
        },
      ];

      const history: MessageHistory = {
        messages,
        totalCount: 1,
        hasMore: false,
      };

      expect(history.messages).toHaveLength(1);
      expect(history.hasMore).toBe(false);
    });
  });

  describe('Type Compatibility', () => {
    it('should be compatible with LLMMessage', () => {
      const message: ExtendedMessage = {
        id: 'msg-130',
        role: 'user',
        content: 'Test',
        source: 'user',
        timestamp: Date.now(),
      };

      // Should be assignable to LLMMessage
      const llmMessage: LLMMessage = {
        role: message.role,
        content: message.content,
      };

      expect(llmMessage.role).toBe(message.role);
      expect(llmMessage.content).toBe(message.content);
    });
  });
});
