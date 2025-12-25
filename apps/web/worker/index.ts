/**
 * Web Worker - Unified Cloudflare Worker
 *
 * Serves static Next.js assets via Assets binding
 * Handles API routes for chat, auth, and sessions
 *
 * This replaces the OpenNext approach with a lightweight worker
 * that's well under the 3MB free tier limit.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { chatRouter } from './routes/chat';
import { documentsRouter } from './routes/documents';
import { filesUploadRouter } from './routes/files-upload';
import { historyRouter } from './routes/history';
import { sessionsRouter } from './routes/sessions';
import { settingsRouter } from './routes/settings';
import { voteRouter } from './routes/vote';

type Bindings = {
  AI: any;
  DB: D1Database;
  ENVIRONMENT: string;
  MODEL: string;
  AI_GATEWAY_NAME: string;
  AI_GATEWAY_API_KEY: string;
  APP_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS configuration - exclude chat route to handle streaming properly
app.use(
  '/api/auth/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/sessions/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/auth/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/sessions/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/history/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/settings/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/documents/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/files/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

app.use(
  '/api/v1/vote/*',
  cors({
    origin: '*',
    credentials: true,
    allowMethods: ['GET', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Execution-ID', 'X-Session-ID'],
    exposeHeaders: ['X-Execution-ID', 'X-Session-ID'],
  })
);

// API v1 routes
app.route('/api/v1/chat', chatRouter);
app.route('/api/v1/auth', authRouter);
app.route('/api/v1/sessions', sessionsRouter);
app.route('/api/v1/history', historyRouter);
app.route('/api/v1/settings', settingsRouter);
app.route('/api/v1/documents', documentsRouter);
app.route('/api/v1/files', filesUploadRouter);
app.route('/api/v1/vote', voteRouter);

// Legacy routes (backward compatibility - redirect to v1)
app.route('/api/chat', chatRouter);
app.route('/api/auth', authRouter);
app.route('/api/sessions', sessionsRouter);
app.route('/api/history', historyRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/documents', documentsRouter);
app.route('/api/files', filesUploadRouter);
app.route('/api/vote', voteRouter);

// Serve static assets from Assets binding
app.get('/*', async (c) => {
  const assets = c.env.ASSETS;
  if (!assets) {
    return c.json({ error: 'Assets not configured' }, 500);
  }

  const url = new URL(c.req.url);
  let path = url.pathname;

  // Default to index.html for root
  if (path === '/') {
    path = '/index.html';
  } else if (!path.includes('.')) {
    // For paths without extension, serve index.html (SPA routing)
    path = '/index.html';
  }

  // Fetch from Assets binding
  const assetUrl = new URL(path, url.origin);
  const assetRequest = new Request(assetUrl.toString(), c.req.raw);
  return assets.fetch(assetRequest);
});

// 404 handler
app.notFound((c) => {
  // For API routes, return JSON 404
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not Found' }, 404);
  }

  // For non-API routes, try to serve index.html (SPA routing)
  const assets = c.env.ASSETS;
  if (assets) {
    try {
      const assetUrl = new URL('/index.html', c.req.url);
      return assets.fetch(new Request(assetUrl.toString()));
    } catch {
      // Fall through to JSON 404
    }
  }
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Worker Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
