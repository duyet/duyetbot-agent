/**
 * Authentication Routes
 *
 * OAuth callbacks and token management endpoints
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { completeGitHubOAuth, getGitHubAuthorizationUrl } from '../auth/github';
import { completeGoogleOAuth, getGoogleAuthorizationUrl } from '../auth/google';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../auth/jwt';
import { RefreshTokenRepository } from '../repositories/refresh-token';
import { UserRepository } from '../repositories/user';
import type { APIResponse, AuthResponse, Env, RefreshTokenRequest } from '../types';

/**
 * Create auth routes
 */
export function createAuthRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  /**
   * GET /auth/github
   * Start GitHub OAuth flow
   */
  app.get('/github', (c) => {
    const clientId = c.env.GITHUB_CLIENT_ID;
    const redirectUri = c.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Configuration Error',
          message: 'GitHub OAuth not configured',
          code: 'OAUTH_NOT_CONFIGURED',
        },
        500
      );
    }

    const state = crypto.randomUUID();
    const authUrl = getGitHubAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    });

    // Store state in cookie for CSRF protection
    c.header(
      'Set-Cookie',
      `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
    );

    return c.json<APIResponse<{ url: string }>>(
      {
        success: true,
        data: { url: authUrl },
      },
      200
    );
  });

  /**
   * GET /auth/github/callback
   * Handle GitHub OAuth callback
   */
  app.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const cookieState = c.req.header('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];

    // Validate state (CSRF protection)
    if (!state || state !== cookieState) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Invalid State',
          message: 'OAuth state mismatch',
          code: 'INVALID_STATE',
        },
        400
      );
    }

    if (!code) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Code',
          message: 'OAuth code not provided',
          code: 'MISSING_CODE',
        },
        400
      );
    }

    try {
      // Exchange code for access token and get profile
      const profile = await completeGitHubOAuth(code, {
        clientId: c.env.GITHUB_CLIENT_ID,
        clientSecret: c.env.GITHUB_CLIENT_SECRET,
        redirectUri: c.env.GITHUB_REDIRECT_URI,
      });

      // Find or create user
      const userRepo = new UserRepository(c.env.DB);
      const user = await userRepo.findOrCreate('github', profile.id, {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });

      // Generate tokens
      const accessToken = await generateAccessToken(user, c.env.JWT_SECRET);
      const refreshToken = await generateRefreshToken();

      // Store refresh token
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await refreshTokenRepo.create(user.id, refreshToken, expiresAt);

      // Clear state cookie
      c.header('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

      return c.json<APIResponse<AuthResponse>>(
        {
          success: true,
          data: {
            accessToken,
            refreshToken,
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              picture: user.picture,
              provider: user.provider,
            },
          },
        },
        200
      );
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'OAuth Failed',
          message: error instanceof Error ? error.message : 'Failed to complete OAuth',
          code: 'OAUTH_FAILED',
        },
        500
      );
    }
  });

  /**
   * GET /auth/google
   * Start Google OAuth flow
   */
  app.get('/google', (c) => {
    const clientId = c.env.GOOGLE_CLIENT_ID;
    const redirectUri = c.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Configuration Error',
          message: 'Google OAuth not configured',
          code: 'OAUTH_NOT_CONFIGURED',
        },
        500
      );
    }

    const state = crypto.randomUUID();
    const authUrl = getGoogleAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    });

    // Store state in cookie for CSRF protection
    c.header(
      'Set-Cookie',
      `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
    );

    return c.json<APIResponse<{ url: string }>>(
      {
        success: true,
        data: { url: authUrl },
      },
      200
    );
  });

  /**
   * GET /auth/google/callback
   * Handle Google OAuth callback
   */
  app.get('/google/callback', async (c) => {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const cookieState = c.req.header('Cookie')?.match(/oauth_state=([^;]+)/)?.[1];

    // Validate state (CSRF protection)
    if (!state || state !== cookieState) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Invalid State',
          message: 'OAuth state mismatch',
          code: 'INVALID_STATE',
        },
        400
      );
    }

    if (!code) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Code',
          message: 'OAuth code not provided',
          code: 'MISSING_CODE',
        },
        400
      );
    }

    try {
      // Exchange code for access token and get profile
      const profile = await completeGoogleOAuth(code, {
        clientId: c.env.GOOGLE_CLIENT_ID,
        clientSecret: c.env.GOOGLE_CLIENT_SECRET,
        redirectUri: c.env.GOOGLE_REDIRECT_URI,
      });

      // Find or create user
      const userRepo = new UserRepository(c.env.DB);
      const user = await userRepo.findOrCreate('google', profile.id, {
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });

      // Generate tokens
      const accessToken = await generateAccessToken(user, c.env.JWT_SECRET);
      const refreshToken = await generateRefreshToken();

      // Store refresh token
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await refreshTokenRepo.create(user.id, refreshToken, expiresAt);

      // Clear state cookie
      c.header('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');

      return c.json<APIResponse<AuthResponse>>(
        {
          success: true,
          data: {
            accessToken,
            refreshToken,
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              picture: user.picture,
              provider: user.provider,
            },
          },
        },
        200
      );
    } catch (error) {
      console.error('Google OAuth error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'OAuth Failed',
          message: error instanceof Error ? error.message : 'Failed to complete OAuth',
          code: 'OAUTH_FAILED',
        },
        500
      );
    }
  });

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   */
  app.post('/refresh', async (c) => {
    const body = await c.req.json<RefreshTokenRequest>();
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Refresh Token',
          message: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN',
        },
        400
      );
    }

    try {
      // Validate refresh token
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const isValid = await refreshTokenRepo.isValid(refreshToken);

      if (!isValid) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Invalid Refresh Token',
            message: 'Refresh token is invalid or expired',
            code: 'INVALID_REFRESH_TOKEN',
          },
          401
        );
      }

      // Get user from refresh token
      const storedToken = await refreshTokenRepo.findByToken(refreshToken);
      if (!storedToken) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Token Not Found',
            message: 'Refresh token not found',
            code: 'TOKEN_NOT_FOUND',
          },
          401
        );
      }

      const userRepo = new UserRepository(c.env.DB);
      const user = await userRepo.findById(storedToken.userId);

      if (!user) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'User Not Found',
            message: 'User associated with token not found',
            code: 'USER_NOT_FOUND',
          },
          401
        );
      }

      // Generate new access token
      const accessToken = await generateAccessToken(user, c.env.JWT_SECRET);

      return c.json<APIResponse<{ accessToken: string; expiresIn: number; tokenType: string }>>(
        {
          success: true,
          data: {
            accessToken,
            expiresIn: 3600, // 1 hour
            tokenType: 'Bearer',
          },
        },
        200
      );
    } catch (error) {
      console.error('Token refresh error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Refresh Failed',
          message: error instanceof Error ? error.message : 'Failed to refresh token',
          code: 'REFRESH_FAILED',
        },
        500
      );
    }
  });

  /**
   * POST /auth/logout
   * Logout and invalidate refresh token
   */
  app.post('/logout', async (c) => {
    const body = await c.req.json<RefreshTokenRequest>();
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Refresh Token',
          message: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN',
        },
        400
      );
    }

    try {
      // Delete refresh token
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      await refreshTokenRepo.delete(refreshToken);

      return c.json<APIResponse<{ message: string }>>(
        {
          success: true,
          data: { message: 'Logged out successfully' },
        },
        200
      );
    } catch (error) {
      console.error('Logout error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Logout Failed',
          message: error instanceof Error ? error.message : 'Failed to logout',
          code: 'LOGOUT_FAILED',
        },
        500
      );
    }
  });

  return app;
}
