/**
 * Sessions API Routes
 *
 * Handles session retrieval and validation
 */

import { Hono } from 'hono';
import { AuthError, getSession } from '../lib/auth-middleware';

const sessionsRouter = new Hono();

// Get current session
sessionsRouter.get('/', async (c) => {
  try {
    const session = getSession(c);
    return c.json(session);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Session disabled endpoint (for UI state)
sessionsRouter.get('/disabled', (c) => {
  return c.json({ enabled: false });
});

export { sessionsRouter };
