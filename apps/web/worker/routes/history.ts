/**
 * History API Routes
 *
 * Handles chat history listing and deletion with cursor-based pagination.
 */

import { Hono } from 'hono';
import { getUser, requireAuth } from '../lib/auth-middleware';
import type { Session } from '../lib/db/queries';
import {
  deleteSessionById,
  deleteSessionsByUserId,
  getMessagesBySessionId,
  getSessionsByUserId,
} from '../lib/db/queries';

type Bindings = {
  DB: D1Database;
};

const historyRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/v1/history
 * List user's chat history with cursor-based pagination
 *
 * Query params:
 * - limit: number of items per page (default: 50)
 * - starting_after: cursor ID to get next page
 * - ending_before: cursor ID to get previous page
 */
historyRouter.get('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);

  const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
  const startingAfter = c.req.query('starting_after') || undefined;
  const endingBefore = c.req.query('ending_before') || undefined;

  try {
    const { sessions, hasMore } = await getSessionsByUserId(
      db,
      user.id,
      limit,
      startingAfter,
      endingBefore
    );

    // Format response to match frontend expectations
    // Transform DB Session to frontend Session type
    const formattedSessions = sessions.map((session: Session) => ({
      sessionId: session.id,
      userId: session.user_id,
      chatId: session.id, // Use same as sessionId for now
      title: session.title || 'Untitled Chat',
      messageCount: session.message_count || 0,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      visibility: (session as Session & { visibility?: string }).visibility || 'private',
    }));

    return c.json({
      chats: formattedSessions,
      hasMore,
    });
  } catch (error) {
    console.error('[History API] Error fetching sessions:', error);
    return c.json({ error: 'Failed to fetch chat history' }, 500);
  }
});

/**
 * GET /api/v1/history/:id
 * Get a specific session with its messages
 */
historyRouter.get('/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const sessionId = c.req.param('id');

  try {
    const session = (await db
      .prepare(
        `SELECT id, user_id, title, created_at, updated_at, visibility FROM sessions WHERE id = ?`
      )
      .bind(sessionId)
      .first()) as Session | null;

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Verify ownership
    if (session.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const messages = await getMessagesBySessionId(db, sessionId);

    return c.json({
      id: session.id,
      title: session.title || 'Untitled Chat',
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      visibility: session.visibility || 'private',
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.created_at,
      })),
    });
  } catch (error) {
    console.error('[History API] Error fetching session:', error);
    return c.json({ error: 'Failed to fetch session' }, 500);
  }
});

/**
 * DELETE /api/v1/history
 * Delete all user's chats
 */
historyRouter.delete('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);

  try {
    const deletedCount = await deleteSessionsByUserId(db, user.id);
    return c.json({ success: true, deletedCount });
  } catch (error) {
    console.error('[History API] Error deleting sessions:', error);
    return c.json({ error: 'Failed to delete chat history' }, 500);
  }
});

/**
 * DELETE /api/v1/history/:id
 * Delete a specific session
 */
historyRouter.delete('/:id', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const sessionId = c.req.param('id');

  try {
    // Verify ownership before deleting
    const session = (await db
      .prepare(`SELECT user_id FROM sessions WHERE id = ?`)
      .bind(sessionId)
      .first()) as { user_id: string } | null;

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    if (session.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const deletedCount = await deleteSessionById(db, sessionId);
    return c.json({ success: true, deletedCount });
  } catch (error) {
    console.error('[History API] Error deleting session:', error);
    return c.json({ error: 'Failed to delete session' }, 500);
  }
});

/**
 * PATCH /api/v1/history/:id/visibility
 * Update chat visibility (private/public)
 */
historyRouter.patch('/:id/visibility', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);
  const sessionId = c.req.param('id');

  try {
    const body = await c.req.json();
    const { visibility } = body;

    // Validate visibility value
    if (visibility !== 'private' && visibility !== 'public') {
      return c.json({ error: 'Invalid visibility value. Must be "private" or "public"' }, 400);
    }

    // Verify ownership
    const session = (await db
      .prepare(`SELECT user_id FROM sessions WHERE id = ?`)
      .bind(sessionId)
      .first()) as { user_id: string } | null;

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    if (session.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    // Update visibility
    await db
      .prepare(`UPDATE sessions SET visibility = ?, updated_at = ? WHERE id = ?`)
      .bind(visibility, Date.now(), sessionId)
      .run();

    return c.json({ success: true, visibility });
  } catch (error) {
    console.error('[History API] Error updating visibility:', error);
    return c.json({ error: 'Failed to update visibility' }, 500);
  }
});

export { historyRouter };
