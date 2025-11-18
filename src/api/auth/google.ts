/**
 * Google OAuth Integration
 *
 * Handle Google OAuth flow and profile fetching
 */

import type { GoogleProfile, OAuthProfile } from '../types';

/**
 * Google OAuth URLs
 */
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Google OAuth configuration
 */
export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Generate Google OAuth authorization URL
 */
export function getGoogleAuthUrl(config: GoogleOAuthConfig, state?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    ...(state && { state }),
  });

  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeGoogleCode(code: string, config: GoogleOAuthConfig): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    throw new GoogleOAuthError('Failed to exchange code for token', 'TOKEN_EXCHANGE_FAILED');
  }

  const data = (await response.json()) as { access_token?: string; error?: string };

  if (data.error) {
    throw new GoogleOAuthError(`Google OAuth error: ${data.error}`, 'GOOGLE_OAUTH_ERROR');
  }

  if (!data.access_token) {
    throw new GoogleOAuthError('No access token returned', 'NO_ACCESS_TOKEN');
  }

  return data.access_token;
}

/**
 * Fetch Google user profile
 */
export async function getGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new GoogleOAuthError('Failed to fetch user profile', 'PROFILE_FETCH_FAILED');
  }

  const data = (await response.json()) as GoogleProfile & {
    id?: string;
    given_name?: string;
    family_name?: string;
  };

  const name =
    data.givenName && data.familyName
      ? `${data.givenName} ${data.familyName}`
      : data.given_name && data.family_name
        ? `${data.given_name} ${data.family_name}`
        : data.name;

  return {
    id: data.sub || data.id || '',
    email: data.email,
    name: name || null,
    picture: data.picture,
  };
}

/**
 * Complete Google OAuth flow (exchange code + fetch profile)
 */
export async function completeGoogleOAuth(
  code: string,
  config: GoogleOAuthConfig
): Promise<OAuthProfile> {
  const accessToken = await exchangeGoogleCode(code, config);
  const profile = await getGoogleProfile(accessToken);
  return profile;
}

/**
 * Google OAuth error
 */
export class GoogleOAuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}
