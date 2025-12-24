/**
 * Authentication utilities for the worker
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

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export function generateState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createSession(
  code: string,
  clientId: string,
  clientSecret: string
): Promise<Session> {
  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to exchange token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json() as { access_token: string };
  const accessToken = tokenData.access_token;

  // Fetch user info from GitHub
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
          Authorization: `Bearer ${accessToken}`,
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
    accessToken,
    expiresAt,
  };
}

export function isSessionValid(session: Session): boolean {
  return session.expiresAt > Date.now();
}

export const SESSION_COOKIE_NAME = 'session';
export const STATE_COOKIE_NAME = 'oauth_state';
