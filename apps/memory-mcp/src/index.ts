import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { D1Storage } from './storage/d1.js';
import type { Env } from './types.js';

import { authenticate, authenticateSchema } from './tools/authenticate.js';
import { getMemory, getMemorySchema } from './tools/get-memory.js';
import { listSessions, listSessionsSchema } from './tools/list-sessions.js';
import { saveMemory, saveMemorySchema } from './tools/save-memory.js';
import { searchMemory, searchMemorySchema } from './tools/search-memory.js';

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Middleware
app.use('*', cors());

// Rate limiting state (per-request, stored in KV for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(userId: string, limit = 100, windowMs = 60000): Promise<boolean> {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'duyetbot-memory', timestamp: Date.now() });
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

// Auth middleware for protected routes
app.use('/api/memory/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const d1Storage = new D1Storage(c.env.DB);

  const tokenData = await d1Storage.getToken(token);
  if (!tokenData) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  if (tokenData.expires_at < Date.now()) {
    await d1Storage.deleteToken(token);
    return c.json({ error: 'Token expired' }, 401);
  }

  const allowed = await checkRateLimit(tokenData.user_id);
  if (!allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  c.set('userId', tokenData.user_id);
  await next();
});

app.use('/api/sessions/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const d1Storage = new D1Storage(c.env.DB);

  const tokenData = await d1Storage.getToken(token);
  if (!tokenData) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  if (tokenData.expires_at < Date.now()) {
    await d1Storage.deleteToken(token);
    return c.json({ error: 'Token expired' }, 401);
  }

  const allowed = await checkRateLimit(tokenData.user_id);
  if (!allowed) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  c.set('userId', tokenData.user_id);
  await next();
});

// Protected endpoints
app.post('/api/memory/get', async (c) => {
  try {
    const body = await c.req.json();
    const input = getMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const userId = c.get('userId');
    const result = await getMemory(input, d1Storage, userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/memory/save', async (c) => {
  try {
    const body = await c.req.json();
    const input = saveMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const userId = c.get('userId');
    const result = await saveMemory(input, d1Storage, userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/memory/search', async (c) => {
  try {
    const body = await c.req.json();
    const input = searchMemorySchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const userId = c.get('userId');
    const result = await searchMemory(input, d1Storage, userId);
    return c.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 400);
  }
});

app.post('/api/sessions/list', async (c) => {
  try {
    const body = await c.req.json();
    const input = listSessionsSchema.parse(body);
    const d1Storage = new D1Storage(c.env.DB);
    const userId = c.get('userId');
    const result = await listSessions(input, d1Storage, userId);
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
export { createMCPServer } from './mcp-server.js';
