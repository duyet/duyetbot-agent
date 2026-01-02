/**
 * Mock GitHub Event Payloads
 *
 * Realistic mock payloads for GitHub Actions events.
 */

/**
 * Mock issue_comment event payload
 */
export function mockIssueCommentEvent(options: {
  owner: string;
  repo: string;
  issueNumber: number;
  commentBody: string;
  actor: string;
}): any {
  const { owner, repo, issueNumber, commentBody, actor } = options;

  return {
    action: 'created',
    issue: {
      id: 1,
      number: issueNumber,
      title: 'Test Issue',
      body: 'Initial issue description',
      user: {
        login: actor,
        type: 'User',
      },
      labels: [],
      assignees: [],
      state: 'open',
      pull_request: null,
    },
    comment: {
      id: 123456,
      body: commentBody,
      user: {
        login: actor,
        type: 'User',
      },
      created_at: new Date().toISOString(),
    },
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
    sender: {
      login: actor,
    },
  };
}

/**
 * Mock issue_comment event with mention
 */
export function mockIssueCommentWithMention(options: {
  owner: string;
  repo: string;
  issueNumber: number;
  task: string;
  actor: string;
}): any {
  const { task, ...rest } = options;
  return mockIssueCommentEvent({
    ...rest,
    commentBody: `@duyetbot ${task}`,
  });
}

/**
 * Mock issues (opened) event payload
 */
export function mockIssuesOpenedEvent(options: {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  body: string;
  actor: string;
}): any {
  const { owner, repo, issueNumber, title, body, actor } = options;

  return {
    action: 'opened',
    issue: {
      id: 1,
      number: issueNumber,
      title,
      body,
      user: {
        login: actor,
        type: 'User',
      },
      labels: [],
      assignees: [],
      state: 'open',
      pull_request: null,
    },
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
    sender: {
      login: actor,
    },
  };
}

/**
 * Mock pull_request event payload
 */
export function mockPullRequestEvent(options: {
  owner: string;
  repo: string;
  prNumber: number;
  title: string;
  body: string;
  actor: string;
  action?: 'opened' | 'synchronize' | 'closed';
}): any {
  const { owner, repo, prNumber, title, body, actor, action = 'opened' } = options;

  return {
    action,
    pull_request: {
      id: 1,
      number: prNumber,
      title,
      body,
      user: {
        login: actor,
        type: 'User',
      },
      head: {
        ref: 'feature/test-branch',
        sha: 'abc123def456',
      },
      base: {
        ref: 'main',
        sha: '789ghi012jkl',
      },
      labels: [],
      assignees: [],
      state: 'open',
      mergeable: true,
    },
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
    sender: {
      login: actor,
    },
  };
}

/**
 * Mock workflow_dispatch event payload
 */
export function mockWorkflowDispatchEvent(options: {
  owner: string;
  repo: string;
  inputs?: Record<string, string>;
  actor: string;
}): any {
  const { owner, repo, inputs = {}, actor } = options;

  return {
    ref: 'refs/heads/main',
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
    sender: {
      login: actor,
    },
    inputs,
  };
}

/**
 * Mock check_run event for CI status
 */
export function mockCheckRunEvent(options: {
  owner: string;
  repo: string;
  prNumber: number;
  checkName: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  sha: string;
}): any {
  const { owner, repo, prNumber, checkName, status, conclusion, sha } = options;

  return {
    action: 'created',
    check_run: {
      id: 456,
      name: checkName,
      status,
      conclusion,
      head_sha: sha,
      started_at: new Date().toISOString(),
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    },
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
  };
}

/**
 * Mock status event for legacy CI
 */
export function mockStatusEvent(options: {
  owner: string;
  repo: string;
  sha: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  context: string;
}): any {
  const { owner, repo, sha, state, context } = options;

  return {
    id: 789,
    sha,
    state,
    context,
    description: `CI status: ${state}`,
    target_url: `https://github.com/${owner}/${repo}/actions/runs/123`,
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
  };
}

/**
 * Mock issue labeled event
 */
export function mockIssueLabeledEvent(options: {
  owner: string;
  repo: string;
  issueNumber: number;
  label: string;
  actor: string;
}): any {
  const { owner, repo, issueNumber, label, actor } = options;

  return {
    action: 'labeled',
    issue: {
      id: 1,
      number: issueNumber,
      title: 'Test Issue',
      body: 'Issue description',
      user: {
        login: actor,
        type: 'User',
      },
      labels: [
        {
          id: 1,
          name: label,
          color: '000000',
        },
      ],
      assignees: [],
      state: 'open',
      pull_request: null,
    },
    label: {
      id: 1,
      name: label,
      color: '000000',
    },
    repository: {
      id: 123,
      name: repo,
      full_name: `${owner}/${repo}`,
      owner: {
        login: owner,
      },
    },
    sender: {
      login: actor,
    },
  };
}

/**
 * Create complete mock environment for GitHub Actions
 */
export function mockGitHubActionsEnv(options: {
  eventName: string;
  eventAction?: string;
  owner: string;
  repo: string;
  actor: string;
  runId: string;
}): Record<string, string> {
  const { eventName, eventAction, owner, repo, actor, runId } = options;

  return {
    GITHUB_EVENT_NAME: eventName,
    GITHUB_EVENT_ACTION: eventAction || '',
    GITHUB_REPOSITORY: `${owner}/${repo}`,
    GITHUB_ACTOR: actor,
    GITHUB_RUN_ID: runId,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'abc123def456',
    GITHUB_WORKSPACE: `/github/workspace/${repo}`,
    GITHUB_API_URL: 'https://api.github.com',
  };
}
