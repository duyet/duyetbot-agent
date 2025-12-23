/**
 * GitHub OAuth Login Endpoint
 *
 * Initiates the GitHub OAuth flow by:
 * 1. Generating a secure state parameter
 * 2. Storing the state in a cookie
 * 3. Redirecting to GitHub's authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateState, getGitHubAuth, getStateCookieConfig } from '../../../../lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const github = getGitHubAuth();
    const state = generateState();

    // Generate GitHub authorization URL with scopes
    // read:user - Access user profile data
    // user:email - Access user email addresses
    const url = github.createAuthorizationURL(state, ['read:user', 'user:email']);

    // Create response with redirect
    const response = NextResponse.redirect(url.toString());

    // Set state cookie for CSRF protection
    const { name, options } = getStateCookieConfig();
    response.cookies.set(name, state, options);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Failed to initiate login' }, { status: 500 });
  }
}
