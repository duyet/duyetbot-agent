/**
 * Tests for SessionManager
 */

import { describe, expect, it } from 'vitest';
import { SessionManager } from '../session-manager.js';

describe('SessionManager', () => {
  describe('createSessionId', () => {
    it('should create session ID with string inputs', () => {
      const sessionId = SessionManager.createSessionId('telegram', '123456789', '-1001234567890');

      expect(sessionId).toEqual({
        platform: 'telegram',
        userId: '123456789',
        chatId: '-1001234567890',
      });
    });

    it('should create session ID with numeric inputs', () => {
      const sessionId = SessionManager.createSessionId('telegram', 123456789, -1001234567890);

      expect(sessionId).toEqual({
        platform: 'telegram',
        userId: '123456789',
        chatId: '-1001234567890',
      });
    });

    it('should create session ID with mixed inputs', () => {
      const sessionId = SessionManager.createSessionId('github', 'user123', 456);

      expect(sessionId).toEqual({
        platform: 'github',
        userId: 'user123',
        chatId: '456',
      });
    });

    it('should handle different platforms', () => {
      const platforms = ['telegram', 'github', 'api', 'slack', 'discord'];

      for (const platform of platforms) {
        const sessionId = SessionManager.createSessionId(platform, 'user1', 'chat1');
        expect(sessionId.platform).toBe(platform);
      }
    });

    it('should handle special characters in IDs', () => {
      const sessionId = SessionManager.createSessionId('api', 'user@example.com', 'chat-123-abc');

      expect(sessionId).toEqual({
        platform: 'api',
        userId: 'user@example.com',
        chatId: 'chat-123-abc',
      });
    });

    it('should handle empty strings', () => {
      const sessionId = SessionManager.createSessionId('test', '', '');

      expect(sessionId).toEqual({
        platform: 'test',
        userId: '',
        chatId: '',
      });
    });

    it('should handle zero values', () => {
      const sessionId = SessionManager.createSessionId('test', 0, 0);

      expect(sessionId).toEqual({
        platform: 'test',
        userId: '0',
        chatId: '0',
      });
    });
  });

  describe('formatSessionKey', () => {
    it('should format session ID as colon-separated string', () => {
      const sessionId = {
        platform: 'telegram',
        userId: '123456789',
        chatId: '-1001234567890',
      };

      const key = SessionManager.formatSessionKey(sessionId);

      expect(key).toBe('telegram:123456789:-1001234567890');
    });

    it('should handle different platforms', () => {
      const sessionId = {
        platform: 'github',
        userId: 'user123',
        chatId: 'chat456',
      };

      const key = SessionManager.formatSessionKey(sessionId);

      expect(key).toBe('github:user123:chat456');
    });

    it('should handle special characters in components', () => {
      const sessionId = {
        platform: 'api',
        userId: 'user@example.com',
        chatId: 'chat-123-abc',
      };

      const key = SessionManager.formatSessionKey(sessionId);

      expect(key).toBe('api:user@example.com:chat-123-abc');
    });

    it('should be consistent with multiple calls', () => {
      const sessionId = {
        platform: 'test',
        userId: 'user1',
        chatId: 'chat1',
      };

      const key1 = SessionManager.formatSessionKey(sessionId);
      const key2 = SessionManager.formatSessionKey(sessionId);

      expect(key1).toBe(key2);
    });
  });

  describe('parseSessionKey', () => {
    it('should parse valid session key', () => {
      const key = 'telegram:123456789:-1001234567890';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toEqual({
        platform: 'telegram',
        userId: '123456789',
        chatId: '-1001234567890',
      });
    });

    it('should parse session key with special characters', () => {
      const key = 'api:user@example.com:chat-123-abc';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toEqual({
        platform: 'api',
        userId: 'user@example.com',
        chatId: 'chat-123-abc',
      });
    });

    it('should handle chatId with colons', () => {
      const key = 'github:user123:repo:owner:name';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toEqual({
        platform: 'github',
        userId: 'user123',
        chatId: 'repo:owner:name',
      });
    });

    it('should return null for invalid format (too few parts)', () => {
      const key = 'telegram:123456789';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toBeNull();
    });

    it('should return null for invalid format (single part)', () => {
      const key = 'telegram';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toBeNull();
    });

    it('should return null for empty string', () => {
      const key = '';

      const sessionId = SessionManager.parseSessionKey(key);

      expect(sessionId).toBeNull();
    });

    it('should return null for empty userId', () => {
      const key = 'test::';

      const sessionId = SessionManager.parseSessionKey(key);

      // Empty userId is invalid
      expect(sessionId).toBeNull();
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain consistency through create -> format -> parse', () => {
      const original = SessionManager.createSessionId('telegram', 123456789, -1001234567890);
      const key = SessionManager.formatSessionKey(original);
      const parsed = SessionManager.parseSessionKey(key);

      expect(parsed).toEqual(original);
    });

    it('should maintain consistency with special characters', () => {
      const original = SessionManager.createSessionId('api', 'user@test.com', 'chat-123:abc');
      const key = SessionManager.formatSessionKey(original);
      const parsed = SessionManager.parseSessionKey(key);

      expect(parsed).toEqual(original);
    });

    it('should maintain consistency with numeric IDs', () => {
      const original = SessionManager.createSessionId('test', 0, 999);
      const key = SessionManager.formatSessionKey(original);
      const parsed = SessionManager.parseSessionKey(key);

      expect(parsed).toEqual(original);
    });
  });
});
