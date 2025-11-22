/**
 * Session Manager Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type MCPMemoryClient,
  TelegramSessionManager,
  createSessionId,
  parseSessionId,
} from '../session-manager.js';

describe('createSessionId', () => {
  it('should create valid session ID', () => {
    const sessionId = createSessionId(123456, 789012);
    expect(sessionId).toBe('telegram:123456:789012');
  });
});

describe('parseSessionId', () => {
  it('should parse valid session ID', () => {
    const result = parseSessionId('telegram:123456:789012');
    expect(result).toEqual({ userId: 123456, chatId: 789012 });
  });

  it('should return null for invalid session ID', () => {
    expect(parseSessionId('invalid')).toBeNull();
    expect(parseSessionId('telegram:abc:123')).toBeNull();
    expect(parseSessionId('')).toBeNull();
  });
});

describe('TelegramSessionManager', () => {
  describe('without MCP client', () => {
    let sessionManager: TelegramSessionManager;

    beforeEach(() => {
      sessionManager = new TelegramSessionManager();
    });

    it('should create new session for user', async () => {
      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      expect(session.sessionId).toBe('telegram:123:456');
      expect(session.userId).toBe(123);
      expect(session.chatId).toBe(456);
      expect(session.messages).toEqual([]);
    });

    it('should return cached session', async () => {
      const user = { id: 123, firstName: 'Test' };
      const session1 = await sessionManager.getSession(user, 456);
      const session2 = await sessionManager.getSession(user, 456);

      expect(session1).toBe(session2);
    });

    it('should append messages to session', async () => {
      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');
      await sessionManager.appendMessage(session.sessionId, 'assistant', 'Hi there!');

      expect(session.messages).toHaveLength(2);
      expect(session.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(session.messages[1]).toEqual({ role: 'assistant', content: 'Hi there!' });
    });

    it('should clear session history', async () => {
      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');
      await sessionManager.clearSession(session.sessionId);

      expect(session.messages).toHaveLength(0);
    });

    it('should track session count', async () => {
      expect(sessionManager.getSessionCount()).toBe(0);

      await sessionManager.getSession({ id: 1, firstName: 'A' }, 100);
      expect(sessionManager.getSessionCount()).toBe(1);

      await sessionManager.getSession({ id: 2, firstName: 'B' }, 200);
      expect(sessionManager.getSessionCount()).toBe(2);
    });

    it('should throw error for unknown session', async () => {
      await expect(sessionManager.appendMessage('unknown', 'user', 'test')).rejects.toThrow(
        'Session not found'
      );
    });
  });

  describe('with MCP client', () => {
    let sessionManager: TelegramSessionManager;
    let mockMCPClient: MCPMemoryClient;

    beforeEach(() => {
      mockMCPClient = {
        getMemory: vi.fn(),
        saveMemory: vi.fn(),
      };
      sessionManager = new TelegramSessionManager(mockMCPClient);
    });

    it('should load session from MCP server', async () => {
      const mockMessages = [{ role: 'user' as const, content: 'Previous message' }];

      vi.mocked(mockMCPClient.getMemory).mockResolvedValue({
        messages: mockMessages,
        metadata: { createdAt: 1000 },
      });

      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      expect(mockMCPClient.getMemory).toHaveBeenCalledWith('telegram:123:456');
      expect(session.messages).toEqual(mockMessages);
    });

    it('should create new session if MCP returns null', async () => {
      vi.mocked(mockMCPClient.getMemory).mockResolvedValue(null);

      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      expect(session.messages).toEqual([]);
    });

    it('should save messages to MCP server', async () => {
      vi.mocked(mockMCPClient.getMemory).mockResolvedValue(null);
      vi.mocked(mockMCPClient.saveMemory).mockResolvedValue();

      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');

      expect(mockMCPClient.saveMemory).toHaveBeenCalledWith(
        'telegram:123:456',
        [{ role: 'user', content: 'Hello' }],
        expect.objectContaining({
          userId: 123,
          chatId: 456,
        })
      );
    });

    it('should handle MCP errors gracefully', async () => {
      vi.mocked(mockMCPClient.getMemory).mockRejectedValue(new Error('Network error'));

      const user = { id: 123, firstName: 'Test' };
      const session = await sessionManager.getSession(user, 456);

      // Should create new session on error
      expect(session.messages).toEqual([]);
    });
  });
});
