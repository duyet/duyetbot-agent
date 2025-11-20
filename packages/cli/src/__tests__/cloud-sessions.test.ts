/**
 * Cloud Session Manager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudSessionManager } from '../cloud-sessions.js';

// Mock MCPMemoryClient
vi.mock('@duyetbot/core', () => ({
  MCPMemoryClient: vi.fn().mockImplementation(() => ({
    setToken: vi.fn(),
    authenticate: vi.fn().mockResolvedValue({ session_token: 'test-token', user_id: 'user-1', expires_at: Date.now() + 3600000 }),
    saveMemory: vi.fn().mockResolvedValue({}),
    getMemory: vi.fn().mockResolvedValue(null),
    listSessions: vi.fn().mockResolvedValue({ sessions: [], total: 0 }),
    searchMemory: vi.fn().mockResolvedValue({ results: [] }),
  })),
}));

describe('CloudSessionManager', () => {
  const mcpServerUrl = 'https://mcp.example.com';
  const userId = 'test-user';
  let manager: CloudSessionManager;

  beforeEach(() => {
    manager = new CloudSessionManager(mcpServerUrl, userId);
  });

  describe('constructor', () => {
    it('should create manager with MCP client', () => {
      expect(manager).toBeDefined();
    });

    it('should accept token in constructor', () => {
      const managerWithToken = new CloudSessionManager(mcpServerUrl, userId, 'existing-token');
      expect(managerWithToken).toBeDefined();
    });
  });

  describe('authenticate', () => {
    it('should authenticate with GitHub token', async () => {
      const token = await manager.authenticate('ghp_test');
      expect(token).toBe('test-token');
    });
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const session = await manager.createSession({
        title: 'Test Session',
      });

      expect(session.id).toBeDefined();
      expect(session.title).toBe('Test Session');
      expect(session.state).toBe('active');
      expect(session.messages).toEqual([]);
    });

    it('should include metadata if provided', async () => {
      const session = await manager.createSession({
        title: 'Test Session',
        metadata: { key: 'value' },
      });

      expect(session.metadata).toEqual({ key: 'value' });
    });
  });

  describe('getSession', () => {
    it('should return undefined for non-existent session', async () => {
      const session = await manager.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions', async () => {
      const sessions = await manager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('searchSessions', () => {
    it('should search sessions by query', async () => {
      const sessions = await manager.searchSessions('test query');
      expect(sessions).toEqual([]);
    });
  });

  describe('exportSession', () => {
    it('should throw for non-existent session', async () => {
      await expect(manager.exportSession('non-existent')).rejects.toThrow(
        'Session not found'
      );
    });
  });
});

describe('CloudSessionManager types', () => {
  it('should have correct interface', () => {
    const manager = new CloudSessionManager('https://example.com', 'user-1');

    expect(typeof manager.createSession).toBe('function');
    expect(typeof manager.getSession).toBe('function');
    expect(typeof manager.updateSession).toBe('function');
    expect(typeof manager.deleteSession).toBe('function');
    expect(typeof manager.listSessions).toBe('function');
    expect(typeof manager.searchSessions).toBe('function');
    expect(typeof manager.exportSession).toBe('function');
  });
});
