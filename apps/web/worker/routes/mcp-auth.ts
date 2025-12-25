/**
 * MCP OAuth Authentication Routes
 *
 * Handles OAuth 2.0 flows for GitHub and Google MCP integrations.
 * Stores access tokens and refresh tokens in D1 database.
 */

import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { generateState } from '../lib/auth';
import { getUser, optionalAuth } from '../lib/auth-middleware';

type Bindings = {
  DB: D1Database;
  APP_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

const mcpAuthRouter = new Hono<{ Bindings: Bindings }>();

// OAuth state cookie name for MCP flows
const MCP_STATE_COOKIE_NAME = 'mcp_oauth_state';
const MCP_STATE_PROVIDER_COOKIE_NAME = 'mcp_oauth_provider';

// OAuth provider configurations
interface OAuthProvider {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdKey: keyof Bindings;
  clientSecretKey: keyof Bindings;
}

const OAUTH_PROVIDERS: Record<string, OAuthProvider> = {
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'repo read:user user:email',
    clientIdKey: 'GITHUB_CLIENT_ID',
    clientSecretKey: 'GITHUB_CLIENT_SECRET',
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope:
      'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly',
    clientIdKey: 'GOOGLE_CLIENT_ID',
    clientSecretKey: 'GOOGLE_CLIENT_SECRET',
  },
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

// Helper: Store OAuth state in D1
async function storeOAuthState(
  db: D1Database,
  state: string,
  provider: string,
  userId?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO oauth_states (state, provider, user_id, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(state, provider, userId || '', Date.now(), Date.now() + 10 * 60 * 1000) // 10 min expiry
    .run();
}

// Helper: Validate and consume OAuth state
async function validateOAuthState(
  db: D1Database,
  state: string,
  provider: string
): Promise<{ valid: boolean; userId?: string }> {
  const result = await db
    .prepare(`SELECT user_id, expires_at FROM oauth_states WHERE state = ? AND provider = ?`)
    .bind(state, provider)
    .first();

  if (!result) {
    return { valid: false };
  }

  const expiresAt = result.expires_at as number;
  if (expiresAt < Date.now()) {
    // Clean up expired state
    await db.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run();
    return { valid: false };
  }

  const userId = result.user_id as string | null;

  // Consume the state
  await db.prepare(`DELETE FROM oauth_states WHERE state = ?`).bind(state).run();

  return { valid: true, userId: userId || undefined };
}

// Helper: Store or update MCP token
async function storeMcpToken(
  db: D1Database,
  provider: string,
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number | null
): Promise<void> {
  const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : 0;

  await db
    .prepare(`
      INSERT INTO mcp_tokens (provider, user_id, access_token, refresh_token, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, mcp_tokens.refresh_token),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `)
    .bind(provider, userId, accessToken, refreshToken, expiresAt, Date.now(), Date.now())
    .run();
}

// Helper: Get user ID from context
function getUserId(c: any): string {
  try {
    const user = getUser(c);
    return user.id;
  } catch {
    // Return a session-based ID for unauthenticated users
    const sessionId = c.get('sessionId') || crypto.randomUUID();
    return `guest_${sessionId}`;
  }
}

// GET /api/mcp/auth/:provider - Start OAuth flow
mcpAuthRouter.get('/auth/:provider', optionalAuth, async (c) => {
  const provider = c.req.param('provider');

  if (!OAUTH_PROVIDERS[provider]) {
    return c.json(
      { error: 'Invalid provider', supportedProviders: Object.keys(OAUTH_PROVIDERS) },
      400
    );
  }

  const config = OAUTH_PROVIDERS[provider];
  const clientId = c.env[config.clientIdKey] as string | undefined;
  const userId = getUserId(c);

  if (!clientId) {
    console.error(`[MCP Auth] ${provider} client ID not configured`);
    return c.json({ error: 'Provider not configured' }, 500);
  }

  const state = generateState();
  const db = c.env.DB;

  // Store state in D1 for validation
  await storeOAuthState(db, state, provider, userId);

  // Build authorization URL
  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('redirect_uri', `${c.env.APP_URL}/api/mcp/callback`);
  authUrl.searchParams.set('response_type', 'code');

  // Add provider-specific parameters
  if (provider === 'google') {
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
  }

  // Set state cookie for additional validation
  setCookie(c, MCP_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: c.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  });

  setCookie(c, MCP_STATE_PROVIDER_COOKIE_NAME, provider, {
    httpOnly: true,
    secure: c.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  });

  console.log(`[MCP Auth] Starting ${provider} OAuth flow for user:`, userId);

  return c.json({
    authUrl: authUrl.toString(),
    provider,
  });
});

// GET /api/mcp/callback - Handle OAuth callback
mcpAuthRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // Get provider from cookie
  const storedProvider = getCookie(c, MCP_STATE_PROVIDER_COOKIE_NAME);

  if (error) {
    console.error('[MCP Auth] OAuth error:', error, errorDescription);
    return c.redirect(
      `${c.env.APP_URL}/?error=mcp_oauth_error&provider=${storedProvider}&message=${encodeURIComponent(
        errorDescription || error
      )}`
    );
  }

  if (!code || !state || !storedProvider) {
    return c.redirect(`${c.env.APP_URL}/?error=mcp_invalid_callback`);
  }

  // Validate state from both cookie and D1
  const cookieState = getCookie(c, MCP_STATE_COOKIE_NAME);
  if (cookieState !== state) {
    return c.redirect(`${c.env.APP_URL}/?error=mcp_invalid_state`);
  }

  const config = OAUTH_PROVIDERS[storedProvider];
  if (!config) {
    return c.redirect(`${c.env.APP_URL}/?error=mcp_invalid_provider`);
  }

  const db = c.env.DB;

  // Validate state from D1
  const stateValidation = await validateOAuthState(db, state, storedProvider);
  if (!stateValidation.valid) {
    return c.redirect(`${c.env.APP_URL}/?error=mcp_expired_state`);
  }

  const userId = stateValidation.userId || 'anonymous';

  try {
    // Exchange code for access token
    const clientId = c.env[config.clientIdKey];
    const clientSecret = c.env[config.clientSecretKey];

    if (!clientId || !clientSecret) {
      throw new Error('OAuth credentials not configured');
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${c.env.APP_URL}/api/mcp/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[MCP Auth] Token exchange failed:', tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = (await tokenResponse.json()) as TokenResponse;

    // Store token in D1
    await storeMcpToken(
      db,
      storedProvider,
      userId,
      tokenData.access_token,
      tokenData.refresh_token || null,
      tokenData.expires_in || null
    );

    console.log(`[MCP Auth] Successfully stored ${storedProvider} token for user:`, userId);

    // Clear cookies
    deleteCookie(c, MCP_STATE_COOKIE_NAME, { path: '/' });
    deleteCookie(c, MCP_STATE_PROVIDER_COOKIE_NAME, { path: '/' });

    return c.redirect(`${c.env.APP_URL}/?mcp_connected=${storedProvider}`);
  } catch (error) {
    console.error('[MCP Auth] Callback error:', error);
    return c.redirect(`${c.env.APP_URL}/?error=mcp_callback_failed&provider=${storedProvider}`);
  }
});

// GET /api/mcp/tokens - List stored tokens for current user
mcpAuthRouter.get('/tokens', optionalAuth, async (c) => {
  const userId = getUserId(c);
  const db = c.env.DB;

  const tokens = await db
    .prepare(
      `SELECT provider, scope, created_at, updated_at, expires_at
       FROM mcp_tokens
       WHERE user_id = ?`
    )
    .bind(userId)
    .all();

  return c.json({
    tokens: tokens.results.map((t: any) => ({
      provider: t.provider,
      scope: t.scope,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      expiresAt: t.expires_at,
      hasExpired: t.expires_at && t.expires_at < Date.now(),
    })),
  });
});

// DELETE /api/mcp/tokens/:provider - Revoke access for a provider
mcpAuthRouter.delete('/tokens/:provider', optionalAuth, async (c) => {
  const provider = c.req.param('provider');
  const userId = getUserId(c);
  const db = c.env.DB;

  if (!OAUTH_PROVIDERS[provider]) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const result = await db
    .prepare(`DELETE FROM mcp_tokens WHERE provider = ? AND user_id = ?`)
    .bind(provider, userId)
    .run();

  console.log(
    `[MCP Auth] Revoked ${provider} token for user:`,
    userId,
    'rows affected:',
    result.meta.changes
  );

  return c.json({
    success: true,
    provider,
    deleted: (result.meta.changes || 0) > 0,
  });
});

// GET /api/mcp/status/:provider - Check if provider is connected
mcpAuthRouter.get('/status/:provider', optionalAuth, async (c) => {
  const provider = c.req.param('provider');
  const userId = getUserId(c);
  const db = c.env.DB;

  if (!OAUTH_PROVIDERS[provider]) {
    return c.json({ error: 'Invalid provider' }, 400);
  }

  const token = await db
    .prepare(
      `SELECT provider, scope, created_at, updated_at, expires_at
       FROM mcp_tokens
       WHERE provider = ? AND user_id = ?`
    )
    .bind(provider, userId)
    .first();

  if (!token) {
    return c.json({
      connected: false,
      provider,
    });
  }

  return c.json({
    connected: true,
    provider,
    scope: token.scope,
    createdAt: token.created_at,
    updatedAt: token.updated_at,
    expiresAt: token.expires_at,
    hasExpired: token.expires_at && (token.expires_at as number) < Date.now(),
  });
});

export { mcpAuthRouter };
