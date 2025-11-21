/**
 * Tests for GitHubSessionManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GitHubSessionManager,
  createIssueSessionId,
  createPRSessionId,
  createDiscussionSessionId,
  parseSessionId,
} from '../session-manager.js';
import type { MCPMemoryClient } from '../session-manager.js';
import type { GitHubRepository } from '../types.js';

const mockRepository: GitHubRepository = {
  owner: { login: 'testowner' },
  name: 'testrepo',
  full_name: 'testowner/testrepo',
};

describe('Session ID functions', () => {
  describe('createIssueSessionId', () => {
    it('should create correct session ID for issue', () => {
      const sessionId = createIssueSessionId(mockRepository, 123);
      expect(sessionId).toBe('github:testowner/testrepo:issue:123');
    });
  });

  describe('createPRSessionId', () => {
    it('should create correct session ID for PR', () => {
      const sessionId = createPRSessionId(mockRepository, 456);
      expect(sessionId).toBe('github:testowner/testrepo:pr:456');
    });
  });

  describe('createDiscussionSessionId', () => {
    it('should create correct session ID for discussion', () => {
      const sessionId = createDiscussionSessionId(mockRepository, 789);
      expect(sessionId).toBe('github:testowner/testrepo:discussion:789');
    });
  });

  describe('parseSessionId', () => {
    it('should parse issue session ID', () => {
      const result = parseSessionId('github:owner/repo:issue:123');
      expect(result).toEqual({
        platform: 'github',
        owner: 'owner',
        repo: 'repo',
        type: 'issue',
        number: 123,
      });
    });

    it('should parse PR session ID', () => {
      const result = parseSessionId('github:owner/repo:pr:456');
      expect(result).toEqual({
        platform: 'github',
        owner: 'owner',
        repo: 'repo',
        type: 'pr',
        number: 456,
      });
    });

    it('should return null for invalid session ID', () => {
      expect(parseSessionId('invalid')).toBeNull();
      expect(parseSessionId('github:owner')).toBeNull();
      expect(parseSessionId('github:owner/repo:unknown:123')).toBeNull();
    });
  });
});

describe('GitHubSessionManager', () => {
  describe('without MCP client', () => {
    let sessionManager: GitHubSessionManager;

    beforeEach(() => {
      sessionManager = new GitHubSessionManager();
    });

    it('should create new issue session', async () => {
      const session = await sessionManager.getIssueSession(
        mockRepository,
        1,
        'Test Issue'
      );

      expect(session.sessionId).toBe('github:testowner/testrepo:issue:1');
      expect(session.messages).toEqual([]);
      expect(session.metadata.type).toBe('issue');
      expect(session.metadata.number).toBe(1);
      expect(session.metadata.title).toBe('Test Issue');
    });

    it('should create new PR session', async () => {
      const session = await sessionManager.getPRSession(
        mockRepository,
        42,
        'Test PR'
      );

      expect(session.sessionId).toBe('github:testowner/testrepo:pr:42');
      expect(session.messages).toEqual([]);
      expect(session.metadata.type).toBe('pr');
      expect(session.metadata.number).toBe(42);
    });

    it('should return cached session', async () => {
      const session1 = await sessionManager.getIssueSession(mockRepository, 1, 'Test');
      await sessionManager.appendMessage(session1.sessionId, 'user', 'Hello');

      const session2 = await sessionManager.getIssueSession(mockRepository, 1, 'Test');
      expect(session2.messages).toHaveLength(1);
      expect(session2.messages[0].content).toBe('Hello');
    });

    it('should append messages', async () => {
      const session = await sessionManager.getIssueSession(mockRepository, 1, 'Test');

      await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');
      await sessionManager.appendMessage(session.sessionId, 'assistant', 'Hi there');

      const cached = sessionManager.getCached(session.sessionId);
      expect(cached?.messages).toHaveLength(2);
      expect(cached?.messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(cached?.messages[1]).toEqual({ role: 'assistant', content: 'Hi there' });
    });

    it('should save session', async () => {
      const session = await sessionManager.getIssueSession(mockRepository, 1, 'Test');

      const messages = [
        { role: 'user', content: 'Message 1' },
        { role: 'assistant', content: 'Response 1' },
      ];

      await sessionManager.saveSession(session.sessionId, messages);

      const cached = sessionManager.getCached(session.sessionId);
      expect(cached?.messages).toEqual(messages);
    });

    it('should throw when appending to non-existent session', async () => {
      await expect(
        sessionManager.appendMessage('nonexistent', 'user', 'Hello')
      ).rejects.toThrow('Session not found');
    });

    it('should clear cache', async () => {
      await sessionManager.getIssueSession(mockRepository, 1, 'Test');
      expect(sessionManager.getCached('github:testowner/testrepo:issue:1')).toBeDefined();

      sessionManager.clearCache();
      expect(sessionManager.getCached('github:testowner/testrepo:issue:1')).toBeUndefined();
    });
  });

  describe('with MCP client', () => {
    let sessionManager: GitHubSessionManager;
    let mockMCPClient: MCPMemoryClient;

    beforeEach(() => {
      mockMCPClient = {
        getMemory: vi.fn(),
        saveMemory: vi.fn(),
      };
      sessionManager = new GitHubSessionManager(mockMCPClient);
    });

    it('should load session from MCP server', async () => {
      const existingMessages = [
        { role: 'user', content: 'Previous message' },
      ];

      (mockMCPClient.getMemory as any).mockResolvedValue({
        session_id: 'github:testowner/testrepo:issue:1',
        messages: existingMessages,
        metadata: {
          type: 'issue',
          repository: { owner: 'testowner', name: 'testrepo', fullName: 'testowner/testrepo' },
          number: 1,
          title: 'Test',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });

      const session = await sessionManager.getIssueSession(mockRepository, 1, 'Test');

      expect(mockMCPClient.getMemory).toHaveBeenCalledWith('github:testowner/testrepo:issue:1');
      expect(session.messages).toEqual(existingMessages);
    });

    it('should create new session when MCP returns error', async () => {
      (mockMCPClient.getMemory as any).mockRejectedValue(new Error('Not found'));

      const session = await sessionManager.getIssueSession(mockRepository, 1, 'Test');

      expect(session.messages).toEqual([]);
      expect(session.metadata.type).toBe('issue');
    });

    it('should save to MCP server when appending messages', async () => {
      (mockMCPClient.getMemory as any).mockRejectedValue(new Error('Not found'));

      const session = await sessionManager.getIssueSession(mockRepository, 1, 'Test');
      await sessionManager.appendMessage(session.sessionId, 'user', 'Hello');

      expect(mockMCPClient.saveMemory).toHaveBeenCalledWith(
        session.sessionId,
        [{ role: 'user', content: 'Hello' }],
        expect.objectContaining({ type: 'issue' })
      );
    });
  });
});
