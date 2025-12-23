/**
 * useAuth Hook
 *
 * Manages authentication state for the chat web application.
 * Handles login/logout operations and persists auth state.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * User information from authentication
 */
export interface AuthUser {
  /** User ID */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Profile avatar URL */
  avatar?: string;
  /** User role/permissions */
  role?: 'user' | 'admin';
}

/**
 * Authentication state
 */
type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

/**
 * Result from useAuth hook
 */
interface UseAuthResult {
  /** Current authentication state */
  authState: AuthState;
  /** Authenticated user (null if not authenticated) */
  user: AuthUser | null;
  /** Error message if auth failed */
  error: string | null;
  /** Login function */
  login: (email: string, password: string) => Promise<void>;
  /** Logout function */
  logout: () => Promise<void>;
  /** Refresh authentication */
  refresh: () => Promise<void>;
}

/**
 * Storage key for auth token
 */
const AUTH_TOKEN_KEY = 'chat_web_auth_token';
const AUTH_USER_KEY = 'chat_web_auth_user';

/**
 * Manages authentication state and operations.
 *
 * @example
 * ```tsx
 * const { authState, user, login, logout } = useAuth();
 *
 * if (authState === 'loading') {
 *   return <div>Loading...</div>;
 * }
 *
 * if (authState === 'unauthenticated') {
 *   return <LoginForm onLogin={login} />;
 * }
 *
 * return <ChatContainer user={user} />;
 * ```
 */
export function useAuth(): UseAuthResult {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Store auth data in localStorage
   */
  const storeAuth = useCallback((token: string, userData: AuthUser) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
  }, []);

  /**
   * Clear auth data from localStorage
   */
  const clearAuth = useCallback(() => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }, []);

  /**
   * Load auth state from localStorage on mount
   */
  useEffect(() => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const userJson = localStorage.getItem(AUTH_USER_KEY);

      if (token && userJson) {
        const userData = JSON.parse(userJson) as AuthUser;
        setUser(userData);
        setAuthState('authenticated');
      } else {
        setAuthState('unauthenticated');
      }
    } catch (err) {
      console.error('[useAuth] Failed to load auth state:', err);
      clearAuth();
      setAuthState('unauthenticated');
    }
  }, [clearAuth]);

  /**
   * Login with email and password
   */
  const login = useCallback(
    async (email: string, password: string) => {
      setAuthState('loading');
      setError(null);

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Login failed');
        }

        const data = (await response.json()) as {
          token: string;
          user: AuthUser;
        };
        const userData: AuthUser = {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          avatar: data.user.avatar,
          role: data.user.role,
        };

        storeAuth(data.token, userData);
        setUser(userData);
        setAuthState('authenticated');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Login failed';
        setError(errorMessage);
        setAuthState('error');
      }
    },
    [storeAuth]
  );

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    setAuthState('loading');
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);

      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
    } catch (err) {
      console.error('[useAuth] Logout error:', err);
    } finally {
      clearAuth();
      setUser(null);
      setAuthState('unauthenticated');
    }
  }, [clearAuth]);

  /**
   * Refresh authentication (validate current session)
   */
  const refresh = useCallback(async () => {
    setAuthState('loading');
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);

      if (!token) {
        setAuthState('unauthenticated');
        return;
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        clearAuth();
        setAuthState('unauthenticated');
        return;
      }

      const data = (await response.json()) as { user: AuthUser };
      const userData: AuthUser = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        avatar: data.user.avatar,
        role: data.user.role,
      };

      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
      setUser(userData);
      setAuthState('authenticated');
    } catch (err) {
      console.error('[useAuth] Refresh error:', err);
      clearAuth();
      setAuthState('unauthenticated');
    }
  }, [clearAuth]);

  return {
    authState,
    user,
    error,
    login,
    logout,
    refresh,
  };
}

/**
 * Convenience hook to get just the auth token for API requests
 */
export function useAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem(AUTH_TOKEN_KEY) || null);
  }, []);

  return token;
}
