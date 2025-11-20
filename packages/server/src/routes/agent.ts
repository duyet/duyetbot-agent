/**
 * Agent Routes
 *
 * HTTP API endpoints for agent operations
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { AgentSessionManager, CreateSessionInput, ListSessionsOptions } from '../session-manager.js';

// Request schemas
const createSessionSchema = z.object({
  user_id: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

const executeSchema = z.object({
  session_id: z.string().min(1),
  message: z.string().min(1),
});

/**
 * Create agent routes
 */
export function createAgentRoutes(sessionManager: AgentSessionManager): Hono {
  const app = new Hono();

  // Create session
  app.post('/sessions', async (c) => {
    const body = await c.req.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const createInput: CreateSessionInput = {
      userId: parsed.data.user_id,
    };
    if (parsed.data.messages) {
      createInput.messages = parsed.data.messages;
    }
    if (parsed.data.metadata) {
      createInput.metadata = parsed.data.metadata;
    }
    const session = await sessionManager.createSession(createInput);

    return c.json(
      {
        id: session.id,
        user_id: session.userId,
        state: session.state,
        messages: session.messages,
        created_at: session.createdAt.toISOString(),
      },
      201
    );
  });

  // Get session
  app.get('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const session = await sessionManager.getSession(id);

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({
      id: session.id,
      user_id: session.userId,
      state: session.state,
      messages: session.messages,
      metadata: session.metadata,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
    });
  });

  // List sessions
  app.get('/sessions', async (c) => {
    const userId = c.req.query('user_id');

    if (!userId) {
      return c.json({ error: 'user_id is required' }, 400);
    }

    const options: ListSessionsOptions = {};
    const state = c.req.query('state') as 'active' | 'paused' | 'completed' | 'failed' | undefined;
    if (state) {
      options.state = state;
    }
    const limitStr = c.req.query('limit');
    if (limitStr) {
      options.limit = Number.parseInt(limitStr, 10);
    }
    const offsetStr = c.req.query('offset');
    if (offsetStr) {
      options.offset = Number.parseInt(offsetStr, 10);
    }

    const sessions = await sessionManager.listSessions(userId, options);

    return c.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        user_id: s.userId,
        state: s.state,
        message_count: s.messages.length,
        created_at: s.createdAt.toISOString(),
        updated_at: s.updatedAt.toISOString(),
      })),
    });
  });

  // Delete session
  app.delete('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    await sessionManager.deleteSession(id);
    return c.body(null, 204);
  });

  // Execute message
  app.post('/execute', async (c) => {
    const body = await c.req.json();
    const parsed = executeSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid request', details: parsed.error.issues }, 400);
    }

    const session = await sessionManager.getSession(parsed.data.session_id);

    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    // Add user message
    const userMessage = { role: 'user' as const, content: parsed.data.message };
    const updatedMessages = [...session.messages, userMessage];

    // TODO: Actually execute agent here
    // For now, return a mock response
    const assistantMessage = {
      role: 'assistant' as const,
      content: `Echo: ${parsed.data.message}`,
    };
    updatedMessages.push(assistantMessage);

    // Update session
    await sessionManager.updateSession(session.id, {
      messages: updatedMessages,
    });

    return c.json({
      session_id: session.id,
      response: assistantMessage.content,
      messages: updatedMessages,
    });
  });

  return app;
}
