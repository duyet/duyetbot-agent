/**
 * Parser Middleware Tests
 *
 * Tests for webhook payload parsing, including the new review_requested event.
 */

import { describe, expect, it } from 'vitest';
import { buildWebhookContext, parseWebhookPayload } from '../middlewares/parser.js';
import type { GitHubWebhookPayload } from '../middlewares/types.js';

describe('parseWebhookPayload', () => {
  it('should parse valid JSON payload', () => {
    const rawBody = JSON.stringify({ action: 'created', sender: { login: 'user' } });
    const result = parseWebhookPayload(rawBody);
    expect(result).toEqual({ action: 'created', sender: { login: 'user' } });
  });

  it('should return null for invalid JSON', () => {
    const result = parseWebhookPayload('not json');
    expect(result).toBeNull();
  });
});

describe('buildWebhookContext', () => {
  const basePayload: GitHubWebhookPayload = {
    action: 'created',
    sender: { login: 'testuser', id: 123 },
    repository: {
      name: 'test-repo',
      full_name: 'owner/test-repo',
      owner: { login: 'owner', id: 1 },
    },
  };

  describe('issue_comment events', () => {
    it('should build context for issue comment', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        issue: {
          number: 42,
          title: 'Test Issue',
          body: 'Issue body',
          state: 'open',
          labels: [{ name: 'bug' }],
          html_url: 'https://github.com/owner/test-repo/issues/42',
        },
        comment: {
          id: 100,
          body: '@duyetbot help',
          user: { login: 'commenter', id: 456 },
          html_url: 'https://github.com/owner/test-repo/issues/42#comment-100',
          created_at: '2024-01-01T00:00:00Z',
        },
      };

      const ctx = buildWebhookContext(payload, 'issue_comment', 'delivery-123', 'req-abc');

      expect(ctx.owner).toBe('owner');
      expect(ctx.repo).toBe('test-repo');
      expect(ctx.event).toBe('issue_comment');
      expect(ctx.action).toBe('created');
      expect(ctx.issue?.number).toBe(42);
      expect(ctx.issue?.title).toBe('Test Issue');
      expect(ctx.comment?.id).toBe(100);
      expect(ctx.comment?.body).toBe('@duyetbot help');
      expect(ctx.isPullRequest).toBe(false);
      expect(ctx.isReviewRequest).toBeUndefined();
    });

    it('should detect PR from issue with pull_request property', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        issue: {
          number: 42,
          title: 'Test PR',
          body: 'PR body',
          state: 'open',
          labels: [],
          html_url: 'https://github.com/owner/test-repo/pull/42',
          pull_request: { url: 'https://api.github.com/repos/owner/test-repo/pulls/42' },
        },
      };

      const ctx = buildWebhookContext(payload, 'issue_comment', 'delivery-123', 'req-abc');
      expect(ctx.isPullRequest).toBe(true);
    });
  });

  describe('pull_request:review_requested events', () => {
    it('should build context for review_requested event', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        action: 'review_requested',
        pull_request: {
          number: 99,
          title: 'Add new feature',
          body: 'This PR adds a new feature',
          state: 'open',
          labels: [{ name: 'enhancement' }],
          html_url: 'https://github.com/owner/test-repo/pull/99',
          additions: 100,
          deletions: 20,
          commits: 5,
          changed_files: 10,
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' },
        },
        requested_reviewer: { login: 'duyetbot', id: 789 },
      };

      const ctx = buildWebhookContext(payload, 'pull_request', 'delivery-456', 'req-def');

      expect(ctx.owner).toBe('owner');
      expect(ctx.repo).toBe('test-repo');
      expect(ctx.event).toBe('pull_request');
      expect(ctx.action).toBe('review_requested');
      expect(ctx.isPullRequest).toBe(true);
      expect(ctx.isReviewRequest).toBe(true);
      expect(ctx.requestedReviewer).toBe('duyetbot');

      // Issue context should be populated from PR data
      expect(ctx.issue?.number).toBe(99);
      expect(ctx.issue?.title).toBe('Add new feature');
      expect(ctx.issue?.body).toBe('This PR adds a new feature');
      expect(ctx.issue?.state).toBe('open');

      // PR metadata should be extracted
      expect(ctx.additions).toBe(100);
      expect(ctx.deletions).toBe(20);
      expect(ctx.commits).toBe(5);
      expect(ctx.changedFiles).toBe(10);
      expect(ctx.headRef).toBe('feature-branch');
      expect(ctx.baseRef).toBe('main');

      // No comment for review requests
      expect(ctx.comment).toBeUndefined();
    });

    it('should handle review_requested without requested_reviewer', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        action: 'review_requested',
        pull_request: {
          number: 99,
          title: 'Add new feature',
          body: null,
          state: 'open',
          labels: [],
          html_url: 'https://github.com/owner/test-repo/pull/99',
        },
        // Note: requested_reviewer can be undefined for team review requests
      };

      const ctx = buildWebhookContext(payload, 'pull_request', 'delivery-456', 'req-def');

      expect(ctx.isReviewRequest).toBe(true);
      expect(ctx.requestedReviewer).toBeUndefined();
      expect(ctx.issue?.body).toBe(''); // null body converted to empty string
    });

    it('should handle review_requested with bot format username', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        action: 'review_requested',
        pull_request: {
          number: 99,
          title: 'Add new feature',
          body: 'Description',
          state: 'open',
          labels: [],
          html_url: 'https://github.com/owner/test-repo/pull/99',
        },
        requested_reviewer: { login: 'duyetbot[bot]', id: 789 },
      };

      const ctx = buildWebhookContext(payload, 'pull_request', 'delivery-456', 'req-def');

      expect(ctx.isReviewRequest).toBe(true);
      expect(ctx.requestedReviewer).toBe('duyetbot[bot]');
    });
  });

  describe('non-review PR events', () => {
    it('should not set isReviewRequest for other PR events', () => {
      const payload: GitHubWebhookPayload = {
        ...basePayload,
        action: 'opened',
        pull_request: {
          number: 99,
          title: 'Add new feature',
          body: 'Description',
          state: 'open',
          labels: [],
          html_url: 'https://github.com/owner/test-repo/pull/99',
        },
      };

      const ctx = buildWebhookContext(payload, 'pull_request', 'delivery-456', 'req-def');

      expect(ctx.isPullRequest).toBe(true);
      expect(ctx.isReviewRequest).toBeUndefined();
      expect(ctx.requestedReviewer).toBeUndefined();
    });
  });
});
