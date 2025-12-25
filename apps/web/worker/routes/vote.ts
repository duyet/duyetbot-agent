/**
 * Vote API Routes
 *
 * Handles message voting (up/down) for feedback
 */

import { Hono } from 'hono';
import { AuthError, getSession } from '../lib/auth-middleware';

type Bindings = {
  DB: D1Database;
};

interface VoteRequest {
  sessionId: string;
  messageId: string;
  type: 'up' | 'down';
}

interface Vote {
  session_id: string;
  message_id: string;
  is_upvoted: number;
  created_at: number;
}

const voteRouter = new Hono<{ Bindings: Bindings }>();

/**
 * Validate that the session belongs to the authenticated user
 */
async function validateSessionOwnership(
  db: D1Database,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await db
    .prepare(`SELECT user_id FROM sessions WHERE id = ?`)
    .bind(sessionId)
    .first<{ user_id: string }>();

  return session?.user_id === userId;
}

/**
 * GET /api/v1/vote?sessionId={id}
 * Fetch votes for a session
 */
voteRouter.get('/', async (c) => {
  try {
    const sessionId = c.req.query('sessionId');

    if (!sessionId) {
      return c.json({ error: 'Bad Request', message: 'Parameter sessionId is required' }, 400);
    }

    const session = getSession(c);
    const db = c.env.DB;

    // Validate session ownership
    const isOwner = await validateSessionOwnership(db, sessionId, session.user.id);
    if (!isOwner) {
      return c.json({ error: 'Forbidden', message: 'Access denied to this session' }, 403);
    }

    // Fetch votes for the session
    const votes = await db
      .prepare(
        `SELECT session_id, message_id, is_upvoted, created_at FROM votes WHERE session_id = ?`
      )
      .bind(sessionId)
      .all<Vote>();

    // Convert is_upvoted integer to vote type string
    const result = votes.results.map((vote) => ({
      sessionId: vote.session_id,
      messageId: vote.message_id,
      type: vote.is_upvoted ? ('up' as const) : ('down' as const),
    }));

    return c.json(result, 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    console.error('[Vote API] GET error:', error);
    return c.json({ error: 'Internal Server Error', message: 'Failed to fetch votes' }, 500);
  }
});

/**
 * PATCH /api/v1/vote
 * Record vote (up/down) for a message
 */
voteRouter.patch('/', async (c) => {
  try {
    const body = (await c.req.json()) as VoteRequest;
    const { sessionId, messageId, type } = body;

    // Validate required fields
    if (!sessionId || !messageId || !type) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Parameters sessionId, messageId, and type are required',
        },
        400
      );
    }

    // Validate vote type
    if (type !== 'up' && type !== 'down') {
      return c.json({ error: 'Bad Request', message: 'Type must be "up" or "down"' }, 400);
    }

    const session = getSession(c);
    const db = c.env.DB;

    // Validate session ownership
    const isOwner = await validateSessionOwnership(db, sessionId, session.user.id);
    if (!isOwner) {
      return c.json({ error: 'Forbidden', message: 'Access denied to this session' }, 403);
    }

    // Convert type to is_upvoted integer
    const isUpvoted = type === 'up' ? 1 : 0;

    // Upsert vote (insert or replace existing vote)
    await db
      .prepare(
        `INSERT INTO votes (session_id, message_id, is_upvoted, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(session_id, message_id)
         DO UPDATE SET is_upvoted = ?, created_at = ?`
      )
      .bind(sessionId, messageId, isUpvoted, Date.now(), isUpvoted, Date.now())
      .run();

    return c.text('Message voted', 200);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: error.message }, 401);
    }
    console.error('[Vote API] PATCH error:', error);
    return c.json({ error: 'Internal Server Error', message: 'Failed to record vote' }, 500);
  }
});

export { voteRouter };
