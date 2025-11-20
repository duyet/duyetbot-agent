import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyGitHubToken,
  githubUserToUser,
  generateUserId,
  generateSessionToken,
  generateSessionId,
} from '../auth/github.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GitHub Auth', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('verifyGitHubToken', () => {
    it('should return user data for valid token', async () => {
      const mockUser = {
        id: 12345,
        login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      });

      const result = await verifyGitHubToken('valid_token');
      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: {
          Authorization: 'Bearer valid_token',
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'duyetbot-memory-mcp',
        },
      });
    });

    it('should return null for invalid token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await verifyGitHubToken('invalid_token');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await verifyGitHubToken('token');
      expect(result).toBeNull();
    });
  });

  describe('githubUserToUser', () => {
    it('should convert GitHub user to User format', () => {
      const githubUser = {
        id: 12345,
        login: 'testuser',
        email: 'test@example.com',
        name: 'Test User',
        avatar_url: 'https://github.com/avatar.png',
      };

      const result = githubUserToUser(githubUser);

      expect(result.github_id).toBe('12345');
      expect(result.github_login).toBe('testuser');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
      expect(result.avatar_url).toBe('https://github.com/avatar.png');
      expect(result.created_at).toBeDefined();
      expect(result.updated_at).toBeDefined();
    });

    it('should handle null email and name', () => {
      const githubUser = {
        id: 12345,
        login: 'testuser',
        email: null,
        name: null,
        avatar_url: 'https://github.com/avatar.png',
      };

      const result = githubUserToUser(githubUser);
      expect(result.email).toBeNull();
      expect(result.name).toBeNull();
    });
  });

  describe('ID generators', () => {
    it('should generate user ID with prefix', () => {
      const id = generateUserId();
      expect(id).toMatch(/^user_[a-f0-9]{32}$/);
    });

    it('should generate session token with prefix', () => {
      const token = generateSessionToken();
      expect(token).toMatch(/^st_[a-f0-9]{32}$/);
    });

    it('should generate session ID with prefix', () => {
      const id = generateSessionId();
      expect(id).toMatch(/^sess_[a-f0-9]{32}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateUserId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
