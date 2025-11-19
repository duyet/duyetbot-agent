/**
 * Authentication Middleware
 *
 * JWT verification and user context injection
 */

import type { Context, Next } from 'hono';
import { extractToken, verifyToken } from '../auth/jwt';
import { UserRepository } from '../repositories/user';
import type { AppEnv, User } from '../types';

/**
 * Authentication middleware
 *
 * Verifies JWT and attaches user to context
 */
export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader || null);

  if (!token) {
    return c.json({ error: 'Unauthorized', message: 'No token provided', code: 'NO_TOKEN' }, 401);
  }

  try {
    const env = c.env;
    const claims = await verifyToken(token, env.JWT_SECRET);

    // Fetch user from database to ensure still exists
    const userRepo = new UserRepository(env.DB);
    const user = await userRepo.findById(claims.sub);

    if (!user) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        401
      );
    }

    // Attach user to context
    c.set('user', user);

    await next();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'TOKEN_EXPIRED') {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Token expired',
          code: 'TOKEN_EXPIRED',
        },
        401
      );
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'TOKEN_INVALID') {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid token',
          code: 'TOKEN_INVALID',
        },
        401
      );
    }

    return c.json(
      {
        error: 'Unauthorized',
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      },
      401
    );
  }
}

/**
 * Optional authentication middleware
 *
 * Verifies JWT if present, but doesn't require it
 */
export async function optionalAuthMiddleware(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = extractToken(authHeader || null);

  if (token) {
    try {
      const env = c.env;
      const claims = await verifyToken(token, env.JWT_SECRET);

      const userRepo = new UserRepository(env.DB);
      const user = await userRepo.findById(claims.sub);

      if (user) {
        c.set('user', user);
      }
    } catch {
      // Ignore authentication errors for optional auth
    }
  }

  await next();
}

/**
 * Get authenticated user from context
 */
export function getUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not found in context. Did you forget to use authMiddleware?');
  }
  return user;
}

/**
 * Get optional user from context
 */
export function getOptionalUser(c: Context<AppEnv>): User | null {
  return c.get('user') || null;
}
