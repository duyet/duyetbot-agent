/**
 * Authentication Middleware
 */

import type { Context, Next } from 'hono';
import type { AuthUser } from '../types.js';

/**
 * Verify GitHub token
 */
export async function verifyGitHubToken(token: string): Promise<AuthUser | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as { id: number; login: string };
    return {
      id: `github:${user.id}`,
      type: 'github',
      username: user.login,
    };
  } catch {
    return null;
  }
}

/**
 * Authentication middleware
 */
export function authMiddleware(requiredAuth = true) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      if (requiredAuth) {
        return c.json({ error: 'Authorization header required' }, 401);
      }
      return next();
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Try GitHub token verification
    const user = await verifyGitHubToken(token);
    if (user) {
      c.set('user', user);
      return next();
    }

    // Check for API key (simple token comparison)
    const apiKey = process.env.API_KEY;
    if (apiKey && token === apiKey) {
      c.set('user', {
        id: 'api:default',
        type: 'api',
      } as AuthUser);
      return next();
    }

    if (requiredAuth) {
      return c.json({ error: 'Invalid authentication token' }, 401);
    }

    return next();
  };
}

/**
 * Optional auth middleware (doesn't fail if no token)
 */
export function optionalAuthMiddleware() {
  return authMiddleware(false);
}
