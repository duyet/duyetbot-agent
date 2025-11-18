/**
 * API Router
 *
 * Main Hono router with middleware and route groups
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { authMiddleware, getUser, getOptionalUser } from './middleware/auth';
import { createAuthRoutes } from './routes/auth';
import { createUserRoutes } from './routes/users';
import { createHealthRoutes } from './routes/health';
import type { Env, APIResponse } from './types';

/**
 * Create main API router
 */
export function createRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // Global middleware
  app.use('*', corsMiddleware);

  // Error handling
  app.onError((err, c) => {
    console.error('API Error:', err);

    // Handle JWT errors
    if (err.name === 'JWTExpired') {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Token Expired',
          message: 'Your session has expired. Please log in again.',
          code: 'TOKEN_EXPIRED',
        },
        401
      );
    }

    if (err.name === 'JWTInvalid') {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Invalid Token',
          message: 'Your session is invalid. Please log in again.',
          code: 'TOKEN_INVALID',
        },
        401
      );
    }

    // Generic error response
    return c.json<APIResponse<null>>(
      {
        success: false,
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  });

  // Health check endpoints (no auth required)
  app.route('/health', createHealthRoutes());

  // Auth routes (no auth required)
  app.route('/auth', createAuthRoutes());

  // Protected user routes
  app.route('/users', createUserRoutes());

  // Protected session routes
  const sessions = new Hono<{ Bindings: Env }>();
  sessions.use('*', authMiddleware);
  sessions.use('*', rateLimitMiddleware());

  app.route('/sessions', sessions);

  // Protected agent routes
  const agent = new Hono<{ Bindings: Env }>();
  agent.use('*', authMiddleware);
  agent.use('*', rateLimitMiddleware({ maxRequests: 50, windowSeconds: 60 }));

  app.route('/agent', agent);

  // 404 handler
  app.notFound((c) => {
    return c.json<APIResponse<null>>(
      {
        success: false,
        error: 'Not Found',
        message: `Route ${c.req.path} not found`,
        code: 'NOT_FOUND',
      },
      404
    );
  });

  return app;
}

/**
 * Export router instance
 */
export const router = createRouter();
