/**
 * Pull Request Operations
 *
 * GitHub API operations for pull requests.
 */

import type { Octokit } from '../api/client.js';

export interface CreatePROptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

export interface UpdatePROptions {
  owner: string;
  repo: string;
  pullNumber: number;
  title?: string | undefined;
  body?: string | undefined;
  state?: 'open' | 'closed' | undefined;
  base?: string | undefined;
}

export interface MergePROptions {
  owner: string;
  repo: string;
  pullNumber: number;
  commitTitle?: string | undefined;
  commitMessage?: string | undefined;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
  deleteBranch?: boolean;
}

export interface PRResult {
  number: number;
  htmlUrl: string;
  state: string;
  mergeable: boolean | null;
  headSha: string;
}

/**
 * Create a new pull request
 */
export async function createPR(octokit: Octokit, options: CreatePROptions): Promise<PRResult> {
  const { owner, repo, title, body, head, base, draft } = options;

  const params: Record<string, unknown> = {
    owner,
    repo,
    title,
    body,
    head,
    base,
  };
  if (draft !== undefined) params.draft = draft;

  const response = await octokit.rest.pulls.create(params as any);

  return {
    number: response.data.number,
    htmlUrl: response.data.html_url,
    state: response.data.state,
    mergeable: response.data.mergeable,
    headSha: response.data.head.sha,
  };
}

/**
 * Update an existing pull request
 */
export async function updatePR(octokit: Octokit, options: UpdatePROptions): Promise<void> {
  const { owner, repo, pullNumber, title, body, state, base } = options;

  const params: Record<string, unknown> = {
    owner,
    repo,
    pull_number: pullNumber,
  };
  if (title !== undefined) params.title = title;
  if (body !== undefined) params.body = body;
  if (state !== undefined) params.state = state;
  if (base !== undefined) params.base = base;

  await octokit.rest.pulls.update(params as any);
}

/**
 * Merge a pull request
 */
export async function mergePR(
  octokit: Octokit,
  options: MergePROptions
): Promise<{ merged: boolean; sha: string }> {
  const { owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod, deleteBranch } =
    options;

  try {
    const params: Record<string, unknown> = {
      owner,
      repo,
      pull_number: pullNumber,
      merge_method: mergeMethod || 'merge',
    };
    if (commitTitle !== undefined) params.commit_title = commitTitle;
    if (commitMessage !== undefined) params.commit_message = commitMessage;

    const response = await octokit.rest.pulls.merge(params as any);

    // Delete branch if requested
    if (deleteBranch) {
      const pr = await getPR(octokit, owner, repo, pullNumber);
      await deleteBranchFn(octokit, owner, repo, pr.headRef);
    }

    return {
      merged: response.data.merged as boolean,
      sha: response.data.sha as string,
    };
  } catch (error) {
    // Handle common merge errors
    if (error instanceof Error) {
      if (error.message.includes('Merge conflict')) {
        throw new Error('Cannot merge PR due to merge conflicts');
      }
      if (error.message.includes('Required status check')) {
        throw new Error('Cannot merge PR: required status checks are pending');
      }
    }
    throw error;
  }
}

/**
 * Get pull request details
 */
export async function getPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<
  PRResult & {
    title: string;
    body: string;
    headRef: string;
    baseRef: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  }
> {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    number: response.data.number,
    htmlUrl: response.data.html_url,
    state: response.data.state,
    mergeable: response.data.mergeable,
    headSha: response.data.head.sha,
    title: response.data.title,
    body: response.data.body || '',
    headRef: response.data.head.ref,
    baseRef: response.data.base.ref,
    additions: response.data.additions,
    deletions: response.data.deletions,
    changedFiles: response.data.changed_files,
  };
}

/**
 * List pull requests
 */
export async function listPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  filters?: {
    state?: 'open' | 'closed' | 'all';
    head?: string | undefined;
    base?: string | undefined;
  }
): Promise<Array<{ number: number; title: string; state: string; htmlUrl: string }>> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    state: filters?.state || 'open',
  };
  if (filters?.head !== undefined) params.head = filters.head;
  if (filters?.base !== undefined) params.base = filters.base;

  const response = await octokit.rest.pulls.list(params as any);

  return response.data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    htmlUrl: pr.html_url,
  }));
}

/**
 * Request review from users or teams
 */
export async function requestReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  reviewers: string[],
  teamReviewers?: string[]
): Promise<void> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    pull_number: pullNumber,
    reviewers,
  };
  if (teamReviewers !== undefined) params.team_reviewers = teamReviewers;

  await octokit.rest.pulls.requestReviewers(params as any);
}

/**
 * Create a review on a PR
 */
export async function createReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  options: {
    body?: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{ path: string; position: number; body: string }>;
  }
): Promise<{ id: number; htmlUrl: string }> {
  const response = await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    ...options,
  });

  return {
    id: response.data.id,
    htmlUrl: response.data.html_url,
  };
}

/**
 * List reviews on a PR
 */
export async function listReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<
  Array<{
    id: number;
    user: string;
    state: string;
    body: string;
    submittedAt: string;
  }>
> {
  const response = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return response.data.map((review) => ({
    id: review.id,
    user: review.user?.login || '',
    state: review.state,
    body: review.body || '',
    submittedAt: review.submitted_at || '',
  }));
}

// Import deleteBranch for internal use
import { deleteBranch as deleteBranchFn } from './branches.js';
