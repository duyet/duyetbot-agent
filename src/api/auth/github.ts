/**
 * GitHub OAuth Integration
 *
 * Handle GitHub OAuth flow and profile fetching
 */

import type { GitHubProfile, OAuthProfile } from '../types';

/**
 * GitHub OAuth URLs
 */
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';

/**
 * GitHub OAuth configuration
 */
export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(config: GitHubOAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'read:user user:email',
    ...(state && { state }),
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeGitHubCode(code: string, config: GitHubOAuthConfig): Promise<string> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new GitHubOAuthError('Failed to exchange code for token', 'TOKEN_EXCHANGE_FAILED');
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
  };

  if (data.error) {
    throw new GitHubOAuthError(`GitHub OAuth error: ${data.error}`, 'GITHUB_OAUTH_ERROR');
  }

  if (!data.access_token) {
    throw new GitHubOAuthError('No access token returned', 'NO_ACCESS_TOKEN');
  }

  return data.access_token;
}

/**
 * Fetch GitHub user profile
 */
export async function getGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch(GITHUB_USER_API, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new GitHubOAuthError('Failed to fetch user profile', 'PROFILE_FETCH_FAILED');
  }

  const data = (await response.json()) as GitHubProfile & { email?: string };

  // If email is null, fetch from emails endpoint
  let email = data.email;
  if (!email) {
    email = await getGitHubPrimaryEmail(accessToken);
  }

  return {
    id: String(data.id),
    email: email || '',
    name: data.name,
    picture: data.avatarUrl || null,
  };
}

/**
 * Fetch primary email from GitHub (when user email is private)
 */
async function getGitHubPrimaryEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new GitHubOAuthError('Failed to fetch user emails', 'EMAIL_FETCH_FAILED');
  }

  const emails = (await response.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  // Find primary verified email
  const primaryEmail = emails.find((e) => e.primary && e.verified);
  if (primaryEmail) {
    return primaryEmail.email;
  }

  // Fallback to first verified email
  const verifiedEmail = emails.find((e) => e.verified);
  if (verifiedEmail) {
    return verifiedEmail.email;
  }

  throw new GitHubOAuthError('No verified email found', 'NO_VERIFIED_EMAIL');
}

/**
 * Complete GitHub OAuth flow (exchange code + fetch profile)
 */
export async function completeGitHubOAuth(
  code: string,
  config: GitHubOAuthConfig
): Promise<OAuthProfile> {
  const accessToken = await exchangeGitHubCode(code, config);
  const profile = await getGitHubProfile(accessToken);
  return profile;
}

/**
 * GitHub OAuth error
 */
export class GitHubOAuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'GitHubOAuthError';
  }
}
