/**
 * GitHub OAuth Callback Endpoint
 *
 * Handles the OAuth callback from GitHub:
 * 1. Validates the state parameter to prevent CSRF
 * 2. Exchanges the authorization code for an access token
 * 3. Fetches user information from GitHub
 * 4. Creates an encrypted session cookie
 * 5. Redirects to the application home
 */

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  createSession,
  getSessionCookieConfig,
  isSessionValid,
  STATE_COOKIE_NAME,
} from '../../../../lib/auth';

/**
 * Serialize session to JSON for cookie storage
 */
function serializeSession(session: unknown): string {
  return JSON.stringify(session);
}

/**
 * Deserialize session from cookie
 */
function _deserializeSession(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors (user denied, etc.)
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(new URL('/?error=oauth_error', request.url));
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(new URL('/?error=invalid_callback', request.url));
    }

    // Get state cookie for CSRF validation
    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value;

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(new URL('/?error=invalid_state', request.url));
    }

    // Exchange code for session
    const session = await createSession(code);

    if (!isSessionValid(session)) {
      return NextResponse.redirect(new URL('/?error=invalid_session', request.url));
    }

    // Create response redirecting to home
    const response = NextResponse.redirect(new URL('/', request.url));

    // Set session cookie
    const { name, options } = getSessionCookieConfig();
    response.cookies.set(name, serializeSession(session), options);

    // Clear state cookie
    response.cookies.delete(STATE_COOKIE_NAME);

    return response;
  } catch (error) {
    console.error('Callback error:', error);
    return NextResponse.redirect(new URL('/?error=callback_failed', request.url));
  }
}
