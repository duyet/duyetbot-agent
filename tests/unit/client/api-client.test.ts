/**
 * Tests for API Client
 */

import { APIClient, APIError } from '@/client/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('APIClient', () => {
  let client: APIClient;
  const mockApiUrl = 'https://api.test.com';
  const mockAccessToken = 'test-access-token';
  const mockRefreshToken = 'test-refresh-token';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new APIClient({
      apiUrl: mockApiUrl,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create client with required config', () => {
      expect(client).toBeDefined();
    });

    it('should create client without tokens', () => {
      const clientWithoutTokens = new APIClient({
        apiUrl: mockApiUrl,
      });
      expect(clientWithoutTokens).toBeDefined();
    });
  });

  describe('getProfile', () => {
    it('should fetch user profile', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
        provider: 'github',
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockProfile }),
      });

      const profile = await client.getProfile();

      expect(profile).toEqual(mockProfile);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/users/me`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });

    it('should throw error on API error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        }),
      });

      await expect(client.getProfile()).rejects.toThrow(APIError);
    });
  });

  describe('listSessions', () => {
    it('should fetch sessions list', async () => {
      const mockSessions = [
        { id: 'session-1', title: 'Chat 1', createdAt: new Date().toISOString() },
        { id: 'session-2', title: 'Chat 2', createdAt: new Date().toISOString() },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSessions }),
      });

      const sessions = await client.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/agent/sessions`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });
  });

  describe('createSession', () => {
    it('should create new session', async () => {
      const mockSession = {
        id: 'new-session',
        title: 'New Chat',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockSession }),
      });

      const session = await client.createSession('New Chat');

      expect(session.id).toBe('new-session');
      expect(session.title).toBe('New Chat');
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/agent/sessions`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mockAccessToken}`,
          }),
          body: JSON.stringify({ title: 'New Chat' }),
        })
      );
    });
  });

  describe('deleteSession', () => {
    it('should delete session', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.deleteSession('session-123');

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/agent/sessions/session-123`,
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout and revoke tokens', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await client.logout();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockApiUrl}/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ refreshToken: mockRefreshToken }),
        })
      );
    });

    it('should logout without error if no refresh token', async () => {
      const clientWithoutRefresh = new APIClient({
        apiUrl: mockApiUrl,
        accessToken: mockAccessToken,
      });

      await expect(clientWithoutRefresh.logout()).resolves.toBeUndefined();
      // Should not call API if no refresh token
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token', async () => {
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      const onTokenRefresh = vi.fn();
      const clientWithCallback = new APIClient({
        apiUrl: mockApiUrl,
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        onTokenRefresh,
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          },
        }),
      });

      const result = await (clientWithCallback as any).refreshAccessToken();

      expect(result).toBe(true);
      expect(onTokenRefresh).toHaveBeenCalledWith(newAccessToken, newRefreshToken);
    });

    it('should return false if no refresh token', async () => {
      const clientWithoutRefresh = new APIClient({
        apiUrl: mockApiUrl,
        accessToken: mockAccessToken,
      });

      const result = await (clientWithoutRefresh as any).refreshAccessToken();

      expect(result).toBe(false);
    });
  });

  describe('APIError', () => {
    it('should create error with all properties', () => {
      const error = new APIError('Not Found', 404, 'USER_NOT_FOUND');

      expect(error.message).toBe('Not Found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('USER_NOT_FOUND');
      expect(error.name).toBe('APIError');
    });

    it('should be instanceof Error', () => {
      const error = new APIError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(APIError);
    });
  });

  describe('error handling', () => {
    it('should throw APIError for 400 Bad Request', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Bad Request',
          message: 'Invalid input',
          code: 'INVALID_INPUT',
        }),
      });

      try {
        await client.getProfile();
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).statusCode).toBe(400);
        expect((error as APIError).code).toBe('INVALID_INPUT');
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getProfile()).rejects.toThrow('Network error');
    });

    it('should handle non-JSON responses', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      });

      await expect(client.getProfile()).rejects.toThrow();
    });
  });
});
