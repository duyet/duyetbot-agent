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
import { authMiddleware, getUser } from '../middleware/auth';
import { RefreshTokenRepository } from '../repositories/refresh-token';
import { UserRepository } from '../repositories/user';
import type {
  APIResponse,
  AuthResponse,
  DeviceAuthorizationResponse,
  DevicePendingAuthorization,
  DeviceTokenRequest,
  Env,
  RefreshTokenRequest,
} from '../types';

/**
 * Generate a user-friendly code (e.g., "ABCD-1234")
 */
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar-looking chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

  /**
   * POST /auth/device
   * Start device flow for CLI authentication
   */
  app.post('/device', async (c) => {
    try {
      const deviceCode = crypto.randomUUID();
      const userCode = generateUserCode();
      const expiresIn = 600; // 10 minutes
      const interval = 5; // Poll every 5 seconds

      const pending: DevicePendingAuthorization = {
        deviceCode,
        userCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + expiresIn * 1000,
      };

      // Store in KV with expiration
      await c.env.KV.put(`device:${deviceCode}`, JSON.stringify(pending), {
        expirationTtl: expiresIn,
      });

      // Also store by user code for lookup
      await c.env.KV.put(`usercode:${userCode}`, deviceCode, {
        expirationTtl: expiresIn,
      });

      const verificationUri = `${c.env.WEB_URL}/auth/device`;

      return c.json<APIResponse<DeviceAuthorizationResponse>>(
        {
          success: true,
          data: {
            deviceCode,
            userCode,
            verificationUri,
            expiresIn,
            interval,
          },
        },
        200
      );
    } catch (error) {
      console.error('Device flow start error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Device Flow Failed',
          message: error instanceof Error ? error.message : 'Failed to start device flow',
          code: 'DEVICE_FLOW_FAILED',
        },
        500
      );
    }
  });

  /**
   * POST /auth/device/token
   * Poll for device authorization (used by CLI)
   */
  app.post('/device/token', async (c) => {
    const body = await c.req.json<DeviceTokenRequest>();
    const { deviceCode } = body;

    if (!deviceCode) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing Device Code',
          message: 'Device code is required',
          code: 'MISSING_DEVICE_CODE',
        },
        400
      );
    }

    try {
      // Get pending authorization from KV
      const pendingData = await c.env.KV.get(`device:${deviceCode}`);

      if (!pendingData) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Expired Token',
            message: 'Device code has expired',
            code: 'EXPIRED_TOKEN',
          },
          400
        );
      }

      const pending: DevicePendingAuthorization = JSON.parse(pendingData);

      // Check if expired
      if (Date.now() > pending.expiresAt) {
        await c.env.KV.delete(`device:${deviceCode}`);
        await c.env.KV.delete(`usercode:${pending.userCode}`);
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Expired Token',
            message: 'Device code has expired',
            code: 'EXPIRED_TOKEN',
          },
          400
        );
      }

      // Check if authorized
      if (!pending.userId) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Authorization Pending',
            message: 'User has not authorized this device yet',
            code: 'AUTHORIZATION_PENDING',
          },
          400
        );
      }

      // User has authorized - generate tokens
      const userRepo = new UserRepository(c.env.DB);
      const user = await userRepo.findById(pending.userId);

      if (!user) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'User Not Found',
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          },
          404
        );
      }

      // Generate tokens
      const accessToken = await generateAccessToken(user, c.env.JWT_SECRET);
      const refreshToken = await generateRefreshToken();

      // Store refresh token
      const refreshTokenRepo = new RefreshTokenRepository(c.env.DB);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      await refreshTokenRepo.create(user.id, refreshToken, expiresAt);

      // Clean up device flow data
      await c.env.KV.delete(`device:${deviceCode}`);
      await c.env.KV.delete(`usercode:${pending.userCode}`);

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
      console.error('Device token error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Device Token Failed',
          message: error instanceof Error ? error.message : 'Failed to get device token',
          code: 'DEVICE_TOKEN_FAILED',
        },
        500
      );
    }
  });

  /**
   * GET /auth/device/authorize
   * Web page for users to enter device code and authorize
   */
  app.get('/device/authorize', async (c) => {
    // Simple HTML form for device authorization
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Device - duyetbot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      max-width: 500px;
      width: 100%;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 40px;
    }
    h1 { font-size: 24px; margin-bottom: 10px; color: #fff; }
    p { margin-bottom: 20px; color: #999; line-height: 1.6; }
    input {
      width: 100%;
      padding: 12px;
      background: #0a0a0a;
      border: 1px solid #333;
      border-radius: 4px;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 16px;
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-align: center;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      font-family: inherit;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover { background: #0052a3; }
    button:disabled { background: #333; cursor: not-allowed; }
    .error { color: #ff4444; margin-bottom: 20px; display: none; }
    .success { color: #44ff44; margin-bottom: 20px; display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorize Device</h1>
    <p>Enter the code shown in your terminal to authorize this device.</p>
    <div id="error" class="error"></div>
    <div id="success" class="success"></div>
    <form id="authForm">
      <input
        type="text"
        id="userCode"
        placeholder="XXXX-XXXX"
        maxlength="9"
        pattern="[A-Z0-9]{4}-[A-Z0-9]{4}"
        required
        autocomplete="off"
      />
      <button type="submit">Authorize</button>
    </form>
  </div>
  <script>
    const form = document.getElementById('authForm');
    const input = document.getElementById('userCode');
    const error = document.getElementById('error');
    const success = document.getElementById('success');

    input.addEventListener('input', (e) => {
      let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (value.length > 4) {
        value = value.slice(0, 4) + '-' + value.slice(4, 8);
      }
      e.target.value = value;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      error.style.display = 'none';
      success.style.display = 'none';

      const userCode = input.value.trim();
      if (!userCode) {
        error.textContent = 'Please enter a code';
        error.style.display = 'block';
        return;
      }

      try {
        const res = await fetch('/auth/device/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userCode }),
        });

        const data = await res.json();

        if (data.success) {
          success.textContent = 'Device authorized successfully! You can close this window.';
          success.style.display = 'block';
          input.disabled = true;
          form.querySelector('button').disabled = true;
        } else {
          error.textContent = data.message || 'Authorization failed';
          error.style.display = 'block';
        }
      } catch (err) {
        error.textContent = 'Network error. Please try again.';
        error.style.display = 'block';
      }
    });
  </script>
</body>
</html>
    `;

    return c.html(html);
  });

  /**
   * POST /auth/device/confirm
   * Confirm device authorization (requires authenticated user)
   */
  app.post('/device/confirm', authMiddleware, async (c) => {
    const user = getUser(c);
    const body = await c.req.json<{ userCode: string }>();
    const { userCode } = body;

    if (!userCode) {
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Missing User Code',
          message: 'User code is required',
          code: 'MISSING_USER_CODE',
        },
        400
      );
    }

    try {
      // Get device code from user code
      const deviceCode = await c.env.KV.get(`usercode:${userCode.toUpperCase()}`);

      if (!deviceCode) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Invalid Code',
            message: 'Invalid or expired user code',
            code: 'INVALID_USER_CODE',
          },
          400
        );
      }

      // Get pending authorization
      const pendingData = await c.env.KV.get(`device:${deviceCode}`);

      if (!pendingData) {
        return c.json<APIResponse<null>>(
          {
            success: false,
            error: 'Expired Code',
            message: 'Device code has expired',
            code: 'EXPIRED_CODE',
          },
          400
        );
      }

      const pending: DevicePendingAuthorization = JSON.parse(pendingData);

      // Update with user ID
      pending.userId = user.id;

      // Store updated authorization
      const ttl = Math.floor((pending.expiresAt - Date.now()) / 1000);
      if (ttl > 0) {
        await c.env.KV.put(`device:${deviceCode}`, JSON.stringify(pending), {
          expirationTtl: ttl,
        });
      }

      return c.json<APIResponse<{ message: string }>>(
        {
          success: true,
          data: { message: 'Device authorized successfully' },
        },
        200
      );
    } catch (error) {
      console.error('Device confirm error:', error);
      return c.json<APIResponse<null>>(
        {
          success: false,
          error: 'Confirmation Failed',
          message: error instanceof Error ? error.message : 'Failed to confirm authorization',
          code: 'CONFIRM_FAILED',
        },
        500
      );
    }
  });

  return app;
}
