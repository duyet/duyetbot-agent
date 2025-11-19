/**
 * User Management Routes
 *
 * Protected endpoints for user profile and settings
 */

import { Hono } from 'hono';

import { getUser } from '../middleware/auth';
import { RefreshTokenRepository } from '../repositories/refresh-token';
import { UserRepository } from '../repositories/user';
import type { APIResponse, AppEnv, UpdateUserInput, UserSettings } from '../types';

/**
 * Create user routes
 */
export function createUserRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  /**
   * GET /users/me
   * Get current user profile
   */
  app.get('/me', async (c) => {
    const user = getUser(c);

    return c.json<
      APIResponse<{
        id: string;
        email: string;
        name: string | null;
        picture: string | null;
        provider: string;
        createdAt: string;
        updatedAt: string;
        settings?: UserSettings;
      }>
    >(
      {
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          provider: user.provider,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          settings: user.settings,
        },
      },
      200
    );
  });

  /**
   * PATCH /users/me
   * Update current user profile
   */
  app.patch('/me', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<Partial<UpdateUserInput>>();

    // Validate input
    const allowedFields = ['name', 'picture', 'settings'];
    const updates: Partial<UpdateUserInput> = {};

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates[key as keyof UpdateUserInput] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'No Valid Fields',
          message: 'No valid fields to update',
          code: 'NO_VALID_FIELDS',
        },
        400
      );
    }

    try {
      const userRepo = new UserRepository(c.env.DB);
      const updatedUser = await userRepo.update(user.id, updates);

      return c.json<
        APIResponse<{
          id: string;
          email: string;
          name: string | null;
          picture: string | null;
          provider: string;
          createdAt: string;
          updatedAt: string;
          settings?: UserSettings;
        }>
      >(
        {
          success: true,
          data: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            picture: updatedUser.picture,
            provider: updatedUser.provider,
            createdAt: updatedUser.createdAt.toISOString(),
            updatedAt: updatedUser.updatedAt.toISOString(),
            settings: updatedUser.settings,
          },
        },
        200
      );
    } catch (error) {
      console.error('User update error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Update Failed',
          message: error instanceof Error ? error.message : 'Failed to update user',
          code: 'UPDATE_FAILED',
        },
        500
      );
    }
  });

  /**
   * DELETE /users/me
   * Delete current user account (GDPR compliance)
   */
  app.delete('/me', async (c) => {
    const user = getUser(c);

    try {
      const userRepo = new UserRepository(c.env.DB);
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);

      // Delete all refresh tokens
      await refreshTokenRepo.deleteByUserId(user.id);

      // Delete user account
      await userRepo.delete(user.id);

      return c.json<APIResponse<{ message: string }>>(
        {
          success: true,
          data: { message: 'Account deleted successfully' },
        },
        200
      );
    } catch (error) {
      console.error('User deletion error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Deletion Failed',
          message: error instanceof Error ? error.message : 'Failed to delete account',
          code: 'DELETION_FAILED',
        },
        500
      );
    }
  });

  /**
   * GET /users/me/sessions
   * Get all active sessions (refresh tokens) for current user
   */
  app.get('/me/sessions', async (c) => {
    const user = getUser(c);

    try {
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const tokens = await refreshTokenRepo.findByUserId(user.id);

      return c.json<
        APIResponse<{
          sessions: Array<{
            id: string;
            createdAt: string;
            expiresAt: string;
          }>;
        }>
      >(
        {
          success: true,
          data: {
            sessions: tokens.map((token) => ({
              id: token.id,
              createdAt: token.createdAt.toISOString(),
              expiresAt: token.expiresAt.toISOString(),
            })),
          },
        },
        200
      );
    } catch (error) {
      console.error('Sessions list error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'List Failed',
          message: error instanceof Error ? error.message : 'Failed to list sessions',
          code: 'LIST_FAILED',
        },
        500
      );
    }
  });

  /**
   * DELETE /users/me/sessions
   * Revoke all sessions except current one
   */
  app.delete('/me/sessions', async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ currentRefreshToken?: string }>();

    try {
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const tokens = await refreshTokenRepo.findByUserId(user.id);

      // Delete all tokens except the current one
      for (const token of tokens) {
        if (token.token !== body.currentRefreshToken) {
          await refreshTokenRepo.delete(token.token);
        }
      }

      return c.json<APIResponse<{ message: string; revokedCount: number }>>(
        {
          success: true,
          data: {
            message: 'Sessions revoked successfully',
            revokedCount: tokens.length - (body.currentRefreshToken ? 1 : 0),
          },
        },
        200
      );
    } catch (error) {
      console.error('Sessions revoke error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Revoke Failed',
          message: error instanceof Error ? error.message : 'Failed to revoke sessions',
          code: 'REVOKE_FAILED',
        },
        500
      );
    }
  });

  return app;
}
