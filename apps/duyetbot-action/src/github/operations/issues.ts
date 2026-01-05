/**
 * Issue Operations
 *
 * GitHub API operations for issues.
 */

import type { Octokit } from '../api/client.js';

export interface CreateIssueOptions {
  owner: string;
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

export interface UpdateIssueOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  title?: string;
  body?: string;
  state?: 'open' | 'closed';
  labels?: string[];
  assignees?: string[];
}

export interface IssueResult {
  number: number;
  htmlUrl: string;
}

/**
 * Create a new issue
 */
export async function createIssue(
  octokit: Octokit,
  options: CreateIssueOptions
): Promise<IssueResult> {
  const { owner, repo, title, body, labels, assignees } = options;

  const params: Record<string, unknown> = {
    owner,
    repo,
    title,
  };
  if (body !== undefined) {
    params.body = body;
  }
  if (labels !== undefined) {
    params.labels = labels;
  }
  if (assignees !== undefined) {
    params.assignees = assignees;
  }

  const response = await octokit.rest.issues.create(params as any);

  return {
    number: response.data.number,
    htmlUrl: response.data.html_url,
  };
}

/**
 * Update an existing issue
 */
export async function updateIssue(octokit: Octokit, options: UpdateIssueOptions): Promise<void> {
  const { owner, repo, issueNumber, title, body, state, labels, assignees } = options;

  const params: Record<string, unknown> = {
    owner,
    repo,
    issue_number: issueNumber,
  };
  if (title !== undefined) {
    params.title = title;
  }
  if (body !== undefined) {
    params.body = body;
  }
  if (state !== undefined) {
    params.state = state;
  }
  if (labels !== undefined) {
    params.labels = labels;
  }
  if (assignees !== undefined) {
    params.assignees = assignees;
  }

  await octokit.rest.issues.update(params as any);
}

/**
 * Close an issue with optional comment
 */
export async function closeIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  comment?: string
): Promise<void> {
  // Add comment if provided
  if (comment) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment,
    });
  }

  // Close the issue
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    state: 'closed',
  });
}

/**
 * Reopen an issue
 */
export async function reopenIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<void> {
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number: issueNumber,
    state: 'open',
  });
}

/**
 * Get issue details
 */
export async function getIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<{
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  assignees: string[];
  htmlUrl: string;
}> {
  const response = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    number: response.data.number,
    title: response.data.title,
    body: response.data.body || '',
    state: response.data.state,
    labels: response.data.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
    assignees: response.data.assignees?.map((a) => a.login) ?? [],
    htmlUrl: response.data.html_url,
  };
}

/**
 * List issues with optional filters
 */
export async function listIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  filters?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string[];
    assignee?: string;
  }
): Promise<Array<{ number: number; title: string; state: string; htmlUrl: string }>> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    state: filters?.state || 'open',
  };
  if (filters?.labels !== undefined && filters.labels.length > 0) {
    params.labels = filters.labels.join(',');
  }
  if (filters?.assignee !== undefined) {
    params.assignee = filters.assignee;
  }

  const response = await octokit.rest.issues.listForRepo(params as any);

  return response.data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    htmlUrl: issue.html_url,
  }));
}
