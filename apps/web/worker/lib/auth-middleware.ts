/**
 * Authentication Middleware for API Routes
 *
 * Provides reusable auth helpers for Hono routes.
 * This replaces the Next.js middleware with endpoint-level auth checks.
 */

import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { isSessionValid, SESSION_COOKIE_NAME, type Session } from './auth';

export interface AuthContext {
  session: Session;
  user: Session['user'];
}

/**
 * Authentication error response
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: 401 | 403 = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Get the current session from the request
 * @throws {AuthError} if not authenticated or session is invalid
 */
export function getSession(c: Context): Session {
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    throw new AuthError('Not authenticated', 401);
  }

  try {
    const session: Session = JSON.parse(sessionCookie);

    if (!isSessionValid(session)) {
      throw new AuthError('Session expired', 401);
    }

    return session;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    console.error('Session parse error:', error);
    throw new AuthError('Invalid session', 401);
  }
}

/**
 * Get the current user from the request
 * @throws {AuthError} if not authenticated or session is invalid
 */
export function getUser(c: Context): Session['user'] {
  const session = getSession(c);
  return session.user;
}

/**
 * Hono middleware to require authentication
 * Returns 401 JSON response if not authenticated
 */
export async function requireAuth(c: Context, next: Next) {
  try {
    const session = getSession(c);
    // Attach session to context for use in route handlers
    c.set('session', session);
    c.set('user', session.user);
    await next();
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    return c.json({ error: 'Authentication failed' }, 500);
  }
}

/**
 * Hono middleware that makes auth optional
 * Attaches session/user to context if available, but doesn't require it
 */
export async function optionalAuth(c: Context, next: Next) {
  try {
    const session = getSession(c);
    c.set('session', session);
    c.set('user', session.user);
  } catch {
    // No session, continue without auth
  }
  await next();
}

/**
 * Type helper to get authenticated context from Hono
 */
export type AuthenticatedContext = Context & {
  get: (key: 'session' | 'user') => Session | Session['user'];
};
