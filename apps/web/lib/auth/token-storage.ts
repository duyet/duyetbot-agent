/**
 * Token storage utilities for bearer token authentication
 *
 * This module provides functions for storing and retrieving JWT tokens
 * from localStorage for bearer token authentication.
 *
 * Security Notes:
 * - localStorage is vulnerable to XSS attacks
 * - Always implement Content Security Policy (CSP) to mitigate
 * - Consider short-lived tokens with refresh mechanism for production
 */

const TOKEN_KEY = "auth_token";

/**
 * Get stored token from localStorage
 * Returns null if running on server side or no token exists
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Store token in localStorage
 * No-op if running on server side
 */
export function setStoredToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Remove token from localStorage (e.g., on logout)
 * No-op if running on server side
 */
export function removeStoredToken(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Initialize cross-tab synchronization
 * Reloads the page when token changes in another tab
 * Call this once on app initialization
 */
export function initTokenSync(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("storage", (e) => {
    if (e.key === TOKEN_KEY) {
      // Token changed in another tab - reload to get fresh auth state
      window.location.reload();
    }
  });
}

/**
 * Check if a token exists and is potentially valid
 * Note: This doesn't verify the token signature or expiration
 * Use the session endpoint for full validation
 */
export function hasStoredToken(): boolean {
  return getStoredToken() !== null;
}
