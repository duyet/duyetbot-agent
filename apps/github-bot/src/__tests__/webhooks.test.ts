/**
 * Tests for webhook handlers (issues and pull_request events)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MentionContext } from '../types.js';
import { handleIssueEvent } from '../webhooks/issues.js';
import type { IssueEvent } from '../webhooks/issues.js';
import { handlePullRequestEvent } from '../webhooks/pull-request.js';
import type { PullRequestEvent } from '../webhooks/pull-request.js';

// Mock Octokit
const mockCreateComment = vi.fn();
const mockOctokit = {
  issues: {
    createComment: mockCreateComment,
  },
} as any;

const mockRepository = {
  owner: { login: 'owner' },
  name: 'repo',
  full_name: 'owner/repo',
};

const mockUser = {
  id: 1,
  login: 'testuser',
};

const botUsername = 'duyetbot';

describe('handleIssueEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not respond to bot actions', async () => {
    const onMention = vi.fn();
    const event: IssueEvent = {
      action: 'opened',
      issue: {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        user: { id: 1, login: botUsername },
        labels: [],
      },
      repository: mockRepository,
      sender: { id: 1, login: botUsername },
    };

    await handleIssueEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).not.toHaveBeenCalled();
  });

  it('should respond to opened issues when configured', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: IssueEvent = {
      action: 'opened',
      issue: {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        user: mockUser,
        labels: [],
      },
      repository: mockRepository,
      sender: mockUser,
    };

    await handleIssueEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).toHaveBeenCalled();
    const context: MentionContext = onMention.mock.calls[0][0];
    expect(context.task).toContain('Test Issue');
    expect(context.issue).toBeDefined();
    expect(mockCreateComment).toHaveBeenCalled();
  });

  it('should respond to label triggers', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: IssueEvent = {
      action: 'labeled',
      issue: {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'open',
        user: mockUser,
        labels: [{ name: 'needs-review' }],
      },
      repository: mockRepository,
      sender: mockUser,
      label: { id: 1, name: 'needs-review', color: 'red' },
    };

    await handleIssueEvent(event, mockOctokit, botUsername, onMention, {
      triggerLabels: ['needs-review'],
    });

    expect(onMention).toHaveBeenCalled();
  });

  it('should not respond to non-configured actions', async () => {
    const onMention = vi.fn();
    const event: IssueEvent = {
      action: 'closed',
      issue: {
        number: 1,
        title: 'Test Issue',
        body: 'Test body',
        state: 'closed',
        user: mockUser,
        labels: [],
      },
      repository: mockRepository,
      sender: mockUser,
    };

    await handleIssueEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).not.toHaveBeenCalled();
  });
});

describe('handlePullRequestEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPR = {
    number: 1,
    title: 'Test PR',
    body: 'PR body',
    state: 'open' as const,
    user: mockUser,
    head: { ref: 'feature', sha: 'abc123' },
    base: { ref: 'main', sha: 'def456' },
    changed_files: 5,
    additions: 100,
    deletions: 50,
  };

  it('should not respond to bot actions', async () => {
    const onMention = vi.fn();
    const event: PullRequestEvent = {
      action: 'opened',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: { id: 1, login: botUsername },
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).not.toHaveBeenCalled();
  });

  it('should respond to opened PRs when configured', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: PullRequestEvent = {
      action: 'opened',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: mockUser,
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).toHaveBeenCalled();
    const context: MentionContext = onMention.mock.calls[0][0];
    expect(context.task).toContain('Test PR');
    expect(context.pullRequest).toBeDefined();
    expect(context.pullRequest?.number).toBe(1);
  });

  it('should respond to ready_for_review when autoReviewOnReady is true', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: PullRequestEvent = {
      action: 'ready_for_review',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: mockUser,
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      autoReviewOnReady: true,
    });

    expect(onMention).toHaveBeenCalled();
    expect(mockCreateComment).toHaveBeenCalled();
  });

  it('should respond to synchronize when configured', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: PullRequestEvent = {
      action: 'synchronize',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: mockUser,
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['synchronize'],
    });

    expect(onMention).toHaveBeenCalled();
  });

  it('should respond to label triggers', async () => {
    const onMention = vi.fn().mockResolvedValue('Response');
    const event: PullRequestEvent = {
      action: 'labeled',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: mockUser,
      label: { id: 1, name: 'needs-review', color: 'red' },
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      triggerLabels: ['needs-review'],
    });

    expect(onMention).toHaveBeenCalled();
  });

  it('should not respond to non-configured actions', async () => {
    const onMention = vi.fn();
    const event: PullRequestEvent = {
      action: 'closed',
      number: 1,
      pull_request: mockPR,
      repository: mockRepository,
      sender: mockUser,
    };

    await handlePullRequestEvent(event, mockOctokit, botUsername, onMention, {
      autoRespondActions: ['opened'],
    });

    expect(onMention).not.toHaveBeenCalled();
  });
});
