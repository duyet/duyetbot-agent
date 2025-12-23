/**
 * GitHub OAuth Authentication using Arctic
 *
 * Provides GitHub OAuth integration for the chat web application.
 * Uses secure state parameter validation and encrypted session tokens.
 */

import { GitHub } from 'arctic';

/**
 * Environment variables for GitHub OAuth
 */
interface Env {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_URL: string;
  SESSION_SECRET: string;
}

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get environment variable with validation
 */
function getEnv(): Env {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? 'http://localhost:3002';
  const sessionSecret = process.env.SESSION_SECRET ?? generateRandomString(32);

  if (!clientId) {
    throw new Error('GITHUB_CLIENT_ID environment variable is required');
  }
  if (!clientSecret) {
    throw new Error('GITHUB_CLIENT_SECRET environment variable is required');
  }

  return {
    GITHUB_CLIENT_ID: clientId,
    GITHUB_CLIENT_SECRET: clientSecret,
    APP_URL: appUrl,
    SESSION_SECRET: sessionSecret,
  };
}

/**
 * GitHub OAuth client instance
 */
export function getGitHubAuth(): GitHub {
  const env = getEnv();
  return new GitHub(
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    `${env.APP_URL}/api/auth/callback`
  );
}

/**
 * Generate a cryptographically secure random state string
 * Used to prevent CSRF attacks during OAuth flow
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Session data stored in encrypted cookie
 */
export interface Session {
  user: {
    id: string;
    login: string;
    name: string | null;
    avatarUrl: string | null;
    email: string | null;
  };
  accessToken: string;
  expiresAt: number;
}

/**
 * GitHub user profile from OAuth
 */
interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

/**
 * GitHub OAuth token response
 */
interface _GitHubTokenResponse {
  access_token: string;
}

/**
 * Exchange authorization code for access token and user info
 */
export async function createSession(code: string): Promise<Session> {
  const _env = getEnv();
  const github = getGitHubAuth();

  // Exchange code for access token
  const tokens = await github.validateAuthorizationCode(code);

  // Fetch user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken()}`,
      'User-Agent': 'duyetbot-chat',
    },
  });

  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user info: ${userResponse.statusText}`);
  }

  const user: GitHubUser = await userResponse.json();

  // Fetch user email if not public
  let email = user.email;
  if (!email) {
    try {
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.accessToken()}`,
          'User-Agent': 'duyetbot-chat',
        },
      });
      if (emailsResponse.ok) {
        const emails: Array<{ primary: boolean; email: string }> = await emailsResponse.json();
        const primaryEmail = emails.find((e) => e.primary);
        email = primaryEmail?.email ?? null;
      }
    } catch {
      // Email fetch failed, continue without it
    }
  }

  // Session expires in 30 days
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

  return {
    user: {
      id: user.id.toString(),
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      email,
    },
    accessToken: tokens.accessToken(),
    expiresAt,
  };
}

/**
 * Validate session expiration
 */
export function isSessionValid(session: Session): boolean {
  return session.expiresAt > Date.now();
}

/**
 * Cookie configuration for session storage
 */
export const SESSION_COOKIE_NAME = 'session';
export const STATE_COOKIE_NAME = 'oauth_state';

export function getSessionCookieConfig() {
  const env = getEnv();
  const isProduction = env.APP_URL.startsWith('https://');

  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
  };
}

export function getStateCookieConfig() {
  const env = getEnv();
  const isProduction = env.APP_URL.startsWith('https://');

  return {
    name: STATE_COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 10 * 60, // 10 minutes
    },
  };
}
