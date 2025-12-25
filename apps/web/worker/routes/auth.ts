/**
 * Authentication API Routes
 *
 * Handles GitHub OAuth login and callback
 */

import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import {
  createSession,
  generateState,
  isSessionValid,
  SESSION_COOKIE_NAME,
  STATE_COOKIE_NAME,
} from '../lib/auth';

type Bindings = {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  APP_URL: string;
};

const authRouter = new Hono<{ Bindings: Bindings }>();

authRouter.get('/login', async (c) => {
  const state = generateState();
  const clientId = c.env.GITHUB_CLIENT_ID || '';

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('redirect_uri', `${c.env.APP_URL}/api/auth/callback`);

  // Set state cookie for CSRF protection
  setCookie(c, STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: c.env.APP_URL?.startsWith('https://') ?? false,
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  });

  return c.redirect(url.toString());
});

authRouter.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    console.error('OAuth error:', error);
    return c.redirect(`${c.env.APP_URL}/?error=oauth_error`);
  }

  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/?error=invalid_callback`);
  }

  // Get state cookie for CSRF validation
  const storedState = getCookie(c, STATE_COOKIE_NAME);

  if (!storedState || storedState !== state) {
    return c.redirect(`${c.env.APP_URL}/?error=invalid_state`);
  }

  try {
    const session = await createSession(
      code,
      c.env.GITHUB_CLIENT_ID || '',
      c.env.GITHUB_CLIENT_SECRET || ''
    );

    if (!isSessionValid(session)) {
      return c.redirect(`${c.env.APP_URL}/?error=invalid_session`);
    }

    // Set session cookie
    setCookie(c, SESSION_COOKIE_NAME, JSON.stringify(session), {
      httpOnly: true,
      secure: c.env.APP_URL?.startsWith('https://') ?? false,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Clear state cookie
    deleteCookie(c, STATE_COOKIE_NAME, { path: '/' });

    return c.redirect(`${c.env.APP_URL}/`);
  } catch (error) {
    console.error('Callback error:', error);
    return c.redirect(`${c.env.APP_URL}/?error=callback_failed`);
  }
});

authRouter.post('/logout', async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return c.json({ success: true });
});

export { authRouter };
