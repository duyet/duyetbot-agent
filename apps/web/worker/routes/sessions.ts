/**
 * Sessions API Routes
 *
 * Handles session retrieval and validation
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME, isSessionValid, type Session } from '../lib/auth';

const sessionsRouter = new Hono();

// Get current session
sessionsRouter.get('/', async (c) => {
  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);

  if (!sessionCookie) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const session: Session = JSON.parse(sessionCookie);

    if (!isSessionValid(session)) {
      return c.json({ error: 'Session expired' }, 401);
    }

    return c.json(session);
  } catch (error) {
    console.error('Session parse error:', error);
    return c.json({ error: 'Invalid session' }, 401);
  }
});

// Session disabled endpoint (for UI state)
sessionsRouter.get('/disabled', (c) => {
  return c.json({ enabled: false });
});

export { sessionsRouter };
