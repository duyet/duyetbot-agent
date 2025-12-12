/**
 * Mention Middleware Tests
 *
 * Tests for mention detection middleware, including the review_requested bypass.
 */

import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createGitHubMentionMiddleware } from '../middlewares/mention.js';
import type { Env, MentionVariables, WebhookContext } from '../middlewares/types.js';

// Mock logger to prevent console output during tests
vi.mock('@duyetbot/hono-middleware', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('createGitHubMentionMiddleware', () => {
  const mockEnv: Env = {
    GITHUB_TOKEN: 'test-token',
    BOT_USERNAME: 'duyetbot',
    GitHubAgent: {} as Env['GitHubAgent'],
  };

  const createTestApp = (webhookContext: WebhookContext | undefined, skipProcessing = false) => {
    const app = new Hono<{ Bindings: Env; Variables: MentionVariables }>();

    // Setup middleware to set initial context
    app.use('*', async (c, next) => {
      c.set('webhookContext', webhookContext);
      c.set('skipProcessing', skipProcessing);
      c.set('rawBody', '{}');
      await next();
    });

    // Apply mention middleware
    app.use('*', createGitHubMentionMiddleware());

    // Test endpoint to capture results
    app.post('/test', (c) => {
      return c.json({
        hasMention: c.get('hasMention'),
        task: c.get('task'),
        skipProcessing: c.get('skipProcessing'),
      });
    });

    return app;
  };

  const makeRequest = async (app: ReturnType<typeof createTestApp>) => {
    const res = await app.request(
      '/test',
      { method: 'POST' },
      mockEnv // Pass env as the third argument
    );
    return res.json();
  };

  const baseContext: WebhookContext = {
    owner: 'testowner',
    repo: 'testrepo',
    event: 'issue_comment',
    action: 'created',
    deliveryId: 'delivery-123',
    requestId: 'req-abc',
    sender: { login: 'testuser', id: 123 },
    isPullRequest: false,
  };

  describe('review_requested events', () => {
    it('should bypass mention check when bot is the requested reviewer', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        event: 'pull_request',
        action: 'review_requested',
        isPullRequest: true,
        isReviewRequest: true,
        requestedReviewer: 'duyetbot',
        issue: {
          number: 42,
          title: 'Test PR',
          body: 'PR description',
          state: 'open',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('Please review this pull request');
      expect(data.skipProcessing).toBe(false);
    });

    it('should handle bot[bot] format username', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        event: 'pull_request',
        action: 'review_requested',
        isPullRequest: true,
        isReviewRequest: true,
        requestedReviewer: 'duyetbot[bot]',
        issue: {
          number: 42,
          title: 'Test PR',
          body: 'PR description',
          state: 'open',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('Please review this pull request');
      expect(data.skipProcessing).toBe(false);
    });

    it('should be case insensitive for reviewer matching', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        event: 'pull_request',
        action: 'review_requested',
        isPullRequest: true,
        isReviewRequest: true,
        requestedReviewer: 'DuyetBot',
        issue: {
          number: 42,
          title: 'Test PR',
          body: 'PR description',
          state: 'open',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('Please review this pull request');
    });

    it('should skip processing when different user is requested reviewer', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        event: 'pull_request',
        action: 'review_requested',
        isPullRequest: true,
        isReviewRequest: true,
        requestedReviewer: 'otheruser',
        issue: {
          number: 42,
          title: 'Test PR',
          body: 'PR description',
          state: 'open',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(false);
      expect(data.task).toBeUndefined();
      expect(data.skipProcessing).toBe(true);
    });
  });

  describe('regular mention events', () => {
    it('should detect mention in comment', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        comment: {
          id: 100,
          body: '@duyetbot please help me with this',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('please help me with this');
      expect(data.skipProcessing).toBe(false);
    });

    it('should detect mention in issue body', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        event: 'issues',
        action: 'opened',
        issue: {
          number: 42,
          title: 'Need help',
          body: '@duyetbot can you review this issue?',
          state: 'open',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('can you review this issue?');
    });

    it('should skip when no mention in text', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        comment: {
          id: 100,
          body: 'Just a regular comment without mention',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(false);
      expect(data.skipProcessing).toBe(true);
    });

    it('should process mention even when no explicit task (returns mention as task)', async () => {
      // Note: extractTask returns the original text when parseMention fails to extract a task
      // So '@duyetbot' alone returns '@duyetbot' as the task (not empty)
      const ctx: WebhookContext = {
        ...baseContext,
        comment: {
          id: 100,
          body: '@duyetbot',
        },
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      // The current implementation treats '@duyetbot' alone as having a task
      // because extractTask returns the original text when parseMention doesn't match
      expect(data.hasMention).toBe(true);
      expect(data.task).toBe('@duyetbot');
      expect(data.skipProcessing).toBe(false);
    });
  });

  describe('skip conditions', () => {
    it('should skip when skipProcessing is already set', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        comment: {
          id: 100,
          body: '@duyetbot help me',
        },
      };

      const app = createTestApp(ctx, true);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(false);
      expect(data.skipProcessing).toBe(true);
    });

    it('should skip when no webhook context', async () => {
      const app = createTestApp(undefined);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(false);
      expect(data.skipProcessing).toBe(true);
    });

    it('should skip when no text content in context', async () => {
      const ctx: WebhookContext = {
        ...baseContext,
        // No comment or issue body
      };

      const app = createTestApp(ctx);
      const data = await makeRequest(app);

      expect(data.hasMention).toBe(false);
      expect(data.skipProcessing).toBe(true);
    });
  });
});
