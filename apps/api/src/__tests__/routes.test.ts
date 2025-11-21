/**
 * Routes Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../index.js';

// Mock the SDK query function
vi.mock('@duyetbot/core', () => ({
  createDefaultOptions: vi.fn(() => ({})),
  query: vi.fn(async function* () {
    yield { type: 'user', content: 'test message' };
    yield { type: 'assistant', content: 'Hello! How can I help?' };
    yield { type: 'result', content: 'Hello! How can I help?' };
  }),
  toSDKTools: vi.fn(() => []),
}));

vi.mock('@duyetbot/tools', () => ({
  getAllBuiltinTools: vi.fn(() => []),
}));

describe('Health Routes', () => {
  const app = createApp({ enableRateLimit: false, enableLogging: false });

  it('GET /health should return healthy status', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
    expect(body.version).toBeDefined();
  });

  it('GET /health/ready should return ready', async () => {
    const res = await app.request('/health/ready');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ready).toBe(true);
  });

  it('GET /health/live should return live', async () => {
    const res = await app.request('/health/live');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.live).toBe(true);
  });

  it('GET /health/detailed should return detailed status', async () => {
    const res = await app.request('/health/detailed');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body.checks).toBeDefined();
    expect(body.checks.api).toBe('healthy');
    expect(body.checks.uptime).toBeTypeOf('number');
  });
});

describe('Agent Routes', () => {
  const app = createApp({ enableRateLimit: false, enableLogging: false });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /agent/execute should require authentication', async () => {
    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    });

    expect(res.status).toBe(401);
  });

  it('POST /agent/execute should validate request body', async () => {
    // Mock auth to pass
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      })
    );

    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
  });

  it('POST /agent/execute should execute message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      })
    );

    const res = await app.request('/agent/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ message: 'Hello' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();
    expect(body.message).toBe('Hello! How can I help?');
  });

  it('GET /agent/session/:id should return session info', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      })
    );

    const res = await app.request('/agent/session/test-session', {
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBe('test-session');
  });

  it('DELETE /agent/session/:id should clear session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      })
    );

    const res = await app.request('/agent/session/test-session', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cleared).toBe(true);
  });
});

describe('GitHub Routes', () => {
  const app = createApp({ enableRateLimit: false, enableLogging: false });

  it('POST /github/webhook should handle ping event', async () => {
    const res = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'ping',
        'x-github-delivery': 'test-delivery-id',
      },
      body: JSON.stringify({ zen: 'Test zen' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('pong');
    expect(body.zen).toBe('Test zen');
  });

  it('POST /github/webhook should handle issue comment with mention', async () => {
    const res = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'issue_comment',
        'x-github-delivery': 'test-delivery-id',
      },
      body: JSON.stringify({
        action: 'created',
        comment: { body: 'Hey @duyetbot please review this' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(true);
    expect(body.mentioned).toBe(true);
  });

  it('POST /github/webhook should handle unknown event', async () => {
    const res = await app.request('/github/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-github-event': 'unknown_event',
        'x-github-delivery': 'test-delivery-id',
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(false);
    expect(body.reason).toBe('unhandled event type');
  });
});

describe('Telegram Routes', () => {
  const app = createApp({ enableRateLimit: false, enableLogging: false });

  it('POST /telegram/webhook should handle message', async () => {
    const res = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 123,
        message: {
          chat: { id: 456 },
          text: 'Hello bot',
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(true);
    expect(body.type).toBe('message');
  });

  it('POST /telegram/webhook should handle command', async () => {
    const res = await app.request('/telegram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        update_id: 123,
        message: {
          chat: { id: 456 },
          text: '/start',
        },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(true);
    expect(body.command).toBe('start');
  });
});

describe('Root and Error Handling', () => {
  const app = createApp({ enableRateLimit: false, enableLogging: false });

  it('GET / should return API info', async () => {
    const res = await app.request('/');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('duyetbot-api');
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints.health).toBe('/health');
    expect(body.endpoints.agent).toBe('/agent');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await app.request('/unknown');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBe('Not found');
  });
});
