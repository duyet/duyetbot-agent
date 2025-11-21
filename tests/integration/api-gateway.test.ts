/**
 * API Gateway Integration Tests
 *
 * Tests the full API gateway flow including routing, middleware, and handlers
 */

import { describe, expect, it, vi } from 'vitest';
import { createApp } from '@duyetbot/api';

// Mock SDK for testing
vi.mock('@duyetbot/core', () => ({
  createDefaultOptions: vi.fn(() => ({})),
  query: vi.fn(async function* () {
    yield { type: 'user', content: 'test message' };
    yield { type: 'assistant', content: 'Integration test response' };
    yield { type: 'result', content: 'Integration test response' };
  }),
  toSDKTools: vi.fn(() => []),
}));

vi.mock('@duyetbot/tools', () => ({
  getAllBuiltinTools: vi.fn(() => []),
}));

describe('API Gateway Integration', () => {
  const app = createApp({
    enableRateLimit: false,
    enableLogging: false,
  });

  describe('Health Checks', () => {
    it('should return healthy status on GET /health', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe('healthy');
      expect(body.timestamp).toBeDefined();
    });

    it('should return ready on GET /health/ready', async () => {
      const res = await app.request('/health/ready');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.ready).toBe(true);
    });

    it('should return detailed health on GET /health/detailed', async () => {
      const res = await app.request('/health/detailed');

      const body = await res.json();
      expect(body.checks).toBeDefined();
      expect(body.checks.api).toBe('healthy');
      expect(typeof body.checks.uptime).toBe('number');
    });
  });

  describe('Agent Execution Flow', () => {
    it('should execute agent with valid auth', async () => {
      // Mock GitHub auth
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      }));

      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ message: 'Hello integration test' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionId).toBeDefined();
      expect(body.message).toBe('Integration test response');
    });

    it('should reject unauthenticated agent requests', async () => {
      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Hello' }),
      });

      expect(res.status).toBe(401);
    });

    it('should validate request body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, login: 'testuser' }),
      }));

      const res = await app.request('/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify({ invalid: true }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid request');
    });
  });

  describe('GitHub Webhook Flow', () => {
    it('should handle ping event', async () => {
      const res = await app.request('/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'ping',
          'x-github-delivery': 'test-123',
        },
        body: JSON.stringify({ zen: 'Test zen message' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe('pong');
      expect(body.zen).toBe('Test zen message');
    });

    it('should handle issue comment with @duyetbot mention', async () => {
      const res = await app.request('/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'issue_comment',
          'x-github-delivery': 'test-456',
        },
        body: JSON.stringify({
          action: 'created',
          comment: {
            body: 'Hey @duyetbot can you help?',
          },
          repository: { full_name: 'test/repo' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(true);
      expect(body.mentioned).toBe(true);
    });

    it('should handle PR events', async () => {
      const res = await app.request('/github/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-github-event': 'pull_request',
          'x-github-delivery': 'test-789',
        },
        body: JSON.stringify({
          action: 'opened',
          pull_request: { number: 1 },
          repository: { full_name: 'test/repo' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(true);
    });
  });

  describe('Telegram Webhook Flow', () => {
    it('should handle text message', async () => {
      const res = await app.request('/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          update_id: 1,
          message: {
            chat: { id: 123 },
            from: { id: 456 },
            text: 'Hello bot',
          },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processed).toBe(true);
    });

    it('should handle command', async () => {
      const res = await app.request('/telegram/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          update_id: 2,
          message: {
            chat: { id: 123 },
            from: { id: 456 },
            text: '/help',
          },
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.command).toBe('help');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/unknown/path');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('Not found');
    });

    it('should include request ID in response headers', async () => {
      const app = createApp({ enableRateLimit: false });
      const res = await app.request('/health');

      expect(res.headers.get('X-Request-Id')).toBeDefined();
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const res = await app.request('/health', {
        method: 'OPTIONS',
      });

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      expect(res.headers.get('Access-Control-Allow-Methods')).toBeDefined();
    });
  });
});
