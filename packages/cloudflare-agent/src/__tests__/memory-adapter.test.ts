import { describe, expect, it, vi } from 'vitest';
import { ChatAgent } from '../agent.js';
import type { MemoryAdapter, MemoryData, SaveMemoryResult } from '../memory-adapter.js';
import { fromMemoryMessage, toMemoryMessage } from '../memory-adapter.js';
import type { Message } from '../types.js';

describe('Memory Adapter', () => {
  describe('toMemoryMessage', () => {
    it('should convert basic message', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello',
      };

      const result = toMemoryMessage(message);

      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello');
      expect(result.timestamp).toBeDefined();
      expect(result.metadata).toBeUndefined();
    });

    it('should include tool metadata for tool messages', () => {
      const message: Message = {
        role: 'tool',
        content: 'result',
        toolCallId: 'call-123',
        name: 'my_tool',
      };

      const result = toMemoryMessage(message);

      expect(result.role).toBe('tool');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.toolCallId).toBe('call-123');
      expect(result.metadata?.name).toBe('my_tool');
    });
  });

  describe('fromMemoryMessage', () => {
    it('should convert basic memory message', () => {
      const memoryMessage = {
        role: 'assistant' as const,
        content: 'Hello there',
        timestamp: Date.now(),
      };

      const result = fromMemoryMessage(memoryMessage);

      expect(result.role).toBe('assistant');
      expect(result.content).toBe('Hello there');
      expect(result.toolCallId).toBeUndefined();
    });

    it('should restore tool metadata', () => {
      const memoryMessage = {
        role: 'tool' as const,
        content: 'result',
        metadata: {
          toolCallId: 'call-456',
          name: 'search',
        },
      };

      const result = fromMemoryMessage(memoryMessage);

      expect(result.role).toBe('tool');
      expect(result.toolCallId).toBe('call-456');
      expect(result.name).toBe('search');
    });
  });

  describe('ChatAgent with MemoryAdapter', () => {
    // Mock LLM provider
    const mockProvider = {
      chat: vi.fn().mockResolvedValue({ content: 'Hello!' }),
    };

    // Mock memory adapter
    const createMockAdapter = (): MemoryAdapter & {
      savedMessages: Message[];
      savedSessionId: string | undefined;
    } => ({
      savedMessages: [],
      savedSessionId: undefined,
      async getMemory(sessionId: string): Promise<MemoryData> {
        return {
          sessionId,
          messages: [],
          metadata: {},
        };
      },
      async saveMemory(sessionId: string, messages: Message[]): Promise<SaveMemoryResult> {
        this.savedSessionId = sessionId;
        this.savedMessages = messages;
        return {
          sessionId,
          savedCount: messages.length,
          updatedAt: Date.now(),
        };
      },
    });

    it('should create agent with memory adapter', () => {
      const adapter = createMockAdapter();

      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        memoryAdapter: adapter,
        sessionId: 'test-session',
      });

      expect(agent.getSessionId()).toBe('test-session');
    });

    it('should auto-save messages after chat', async () => {
      const adapter = createMockAdapter();

      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        memoryAdapter: adapter,
        sessionId: 'test-session',
        autoSave: true,
      });

      await agent.chat('Hello');

      expect(adapter.savedSessionId).toBe('test-session');
      expect(adapter.savedMessages.length).toBe(2); // user + assistant
      expect(adapter.savedMessages[0]?.role).toBe('user');
      expect(adapter.savedMessages[1]?.role).toBe('assistant');
    });

    it('should not save when autoSave is false', async () => {
      const adapter = createMockAdapter();

      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        memoryAdapter: adapter,
        sessionId: 'test-session',
        autoSave: false,
      });

      await agent.chat('Hello');

      expect(adapter.savedSessionId).toBeUndefined();
    });

    it('should load memory on first chat', async () => {
      const adapter: MemoryAdapter = {
        async getMemory(sessionId: string): Promise<MemoryData> {
          return {
            sessionId,
            messages: [
              { role: 'user', content: 'Previous message' },
              { role: 'assistant', content: 'Previous response' },
            ],
            metadata: {},
          };
        },
        async saveMemory(sessionId: string, messages: Message[]): Promise<SaveMemoryResult> {
          return {
            sessionId,
            savedCount: messages.length,
            updatedAt: Date.now(),
          };
        },
      };

      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        memoryAdapter: adapter,
        sessionId: 'test-session',
        autoSave: false,
      });

      await agent.chat('New message');

      const messages = agent.getMessages();
      expect(messages.length).toBe(4); // 2 loaded + 1 user + 1 assistant
      expect(messages[0]?.content).toBe('Previous message');
    });

    it('should allow manual save', async () => {
      const adapter = createMockAdapter();

      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        memoryAdapter: adapter,
        sessionId: 'test-session',
        autoSave: false,
      });

      await agent.chat('Hello');
      await agent.saveMemory({ customKey: 'value' });

      expect(adapter.savedSessionId).toBe('test-session');
      expect(adapter.savedMessages.length).toBe(2);
    });

    it('should update session ID', () => {
      const agent = new ChatAgent({
        llmProvider: mockProvider,
        systemPrompt: 'You are helpful.',
        sessionId: 'old-session',
      });

      agent.setSessionId('new-session');

      expect(agent.getSessionId()).toBe('new-session');
    });
  });
});
