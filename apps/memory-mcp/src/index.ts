/**
 * Memory MCP Server
 *
 * Provides both REST API (for backward compatibility) and MCP SSE endpoints.
 */

import { createAuth, createBaseApp } from '@duyetbot/hono-middleware';
import { D1Storage } from './storage/d1.js';
import type { Env } from './types.js';

import { authenticate, authenticateSchema } from './tools/authenticate.js';
import { getMemory, getMemorySchema } from './tools/get-memory.js';
import { listSessions, listSessionsSchema } from './tools/list-sessions.js';
import { saveMemory, saveMemorySchema } from './tools/save-memory.js';
import { searchMemory, searchMemorySchema } from './tools/search-memory.js';

// Export MCP agent for Durable Object binding
// Note: Dynamic import to avoid cloudflare: protocol issues in tests
export { MemoryMcpAgent } from './mcp-agent.js';

const app = createBaseApp<Env>({
  name: 'duyetbot-memory',
  version: '1.0.0',
  logger: true,
  health: true,
  rateLimit: { limit: 100, window: 60000 },
});

// Authentication (public endpoint)
app.post('/api/authenticate', async (c) => {
  try {
    const body = await c.req.json();
    const input = authenticateSchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const result = await authenticate(input, d1Storage);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

// Token validation function for bearer auth
async function validateToken(token: string, c: any) {
  const d1Storage = new D1Storage(c.env.DB);
  const tokenData = await d1Storage.getToken(token);

  if (!tokenData) {
    return null;
  }

  if (tokenData.expires_at < Date.now()) {
    await d1Storage.deleteToken(token);
    return null;
  }

  return { userId: tokenData.user_id };
}

// Protected routes - apply auth middleware
const authMiddleware = createAuth({
  type: 'bearer',
  validate: validateToken,
});

app.use('/api/memory/*', authMiddleware);
app.use('/api/sessions/*', authMiddleware);

// Protected endpoints
app.post('/api/memory/get', async (c: any) => {
  try {
    const body = await c.req.json();
    const input = getMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const user = c.get('user') as { userId: string };
    const result = await getMemory(input, d1Storage, user.userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/memory/save', async (c: any) => {
  try {
    const body = await c.req.json();
    const input = saveMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const user = c.get('user') as { userId: string };
    const result = await saveMemory(input, d1Storage, user.userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/memory/search', async (c: any) => {
  try {
    const body = await c.req.json();
    const input = searchMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const user = c.get('user') as { userId: string };
    const result = await searchMemory(input, d1Storage, user.userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/sessions/list', async (c: any) => {
  try {
    const body = await c.req.json();
    const input = listSessionsSchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const user = c.get('user') as { userId: string };
    const result = await listSessions(input, d1Storage, user.userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

export default app;

// Re-export types and utilities
export * from './types.js';
export { D1Storage } from './storage/d1.js';
