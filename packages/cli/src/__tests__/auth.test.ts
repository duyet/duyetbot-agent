/**
 * CLI Auth Commands Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AuthManager, AuthState } from '../auth.js';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
  });

  describe('getAuthState', () => {
    it('should return unauthenticated state initially', () => {
      const state = authManager.getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeUndefined();
    });

    it('should return authenticated state after login', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        user: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
        },
      });

      const state = authManager.getAuthState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.login).toBe('testuser');
    });
  });

  describe('setAuth', () => {
    it('should store auth credentials', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        user: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
        },
      });

      expect(authManager.getGitHubToken()).toBe('ghp_test');
      expect(authManager.getSessionToken()).toBe('session-123');
    });

    it('should update existing auth', () => {
      authManager.setAuth({
        githubToken: 'ghp_old',
        sessionToken: 'old-session',
      });

      authManager.setAuth({
        githubToken: 'ghp_new',
        sessionToken: 'new-session',
      });

      expect(authManager.getGitHubToken()).toBe('ghp_new');
    });
  });

  describe('clearAuth', () => {
    it('should clear all auth data', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        user: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
        },
      });

      authManager.clearAuth();

      const state = authManager.getAuthState();
      expect(state.isAuthenticated).toBe(false);
      expect(authManager.getGitHubToken()).toBeUndefined();
    });
  });

  describe('isTokenExpired', () => {
    it('should return true for expired token', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        expiresAt: Date.now() - 1000, // expired
      });

      expect(authManager.isTokenExpired()).toBe(true);
    });

    it('should return false for valid token', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        expiresAt: Date.now() + 3600000, // 1 hour from now
      });

      expect(authManager.isTokenExpired()).toBe(false);
    });

    it('should return false if no expiry set', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
      });

      expect(authManager.isTokenExpired()).toBe(false);
    });
  });

  describe('getUser', () => {
    it('should return undefined when not authenticated', () => {
      expect(authManager.getUser()).toBeUndefined();
    });

    it('should return user info when authenticated', () => {
      authManager.setAuth({
        githubToken: 'ghp_test',
        sessionToken: 'session-123',
        user: {
          id: 'user-1',
          login: 'testuser',
          name: 'Test User',
          email: 'test@example.com',
          avatarUrl: 'https://example.com/avatar.png',
        },
      });

      const user = authManager.getUser();

      expect(user?.login).toBe('testuser');
      expect(user?.email).toBe('test@example.com');
    });
  });
});

describe('AuthState', () => {
  it('should have correct shape', () => {
    const state: AuthState = {
      isAuthenticated: true,
      user: {
        id: 'user-1',
        login: 'testuser',
        name: 'Test User',
      },
      expiresAt: Date.now() + 3600000,
    };

    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe('user-1');
  });
});
