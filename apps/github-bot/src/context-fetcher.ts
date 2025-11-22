/**
 * Context Fetcher
 *
 * Fetches enhanced context from GitHub API for richer LLM responses
 */

import type { Octokit } from '@octokit/rest';
import type { GitHubRepository } from './types.js';

export interface EnhancedIssueContext {
  body: string | null | undefined;
  comments: Array<{
    id: number;
    user: string;
    body: string;
    created_at: string;
  }>;
  labels: string[];
  assignees: string[];
  created_at: string;
  updated_at: string;
}

export interface EnhancedPRContext {
  body: string | null;
  diff: string;
  files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string | undefined;
  }>;
  commits: Array<{
    sha: string;
    message: string;
    author: string;
  }>;
  reviews: Array<{
    id: number;
    user: string;
    state: string;
    body: string | null;
  }>;
  comments: Array<{
    id: number;
    user: string;
    body: string;
    path?: string | undefined;
    line?: number | undefined;
  }>;
}

export interface EnhancedContext {
  issue?: EnhancedIssueContext;
  pullRequest?: EnhancedPRContext;
}

/**
 * Fetch enhanced issue context including comments
 */
export async function fetchIssueContext(
  octokit: Octokit,
  repository: GitHubRepository,
  issueNumber: number
): Promise<EnhancedIssueContext> {
  const [issueResponse, commentsResponse] = await Promise.all([
    octokit.issues.get({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: issueNumber,
    }),
    octokit.issues.listComments({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: issueNumber,
      per_page: 100,
    }),
  ]);

  const issue = issueResponse.data;
  const comments = commentsResponse.data;

  return {
    body: issue.body,
    comments: comments.map((c) => ({
      id: c.id,
      user: c.user?.login || 'unknown',
      body: c.body || '',
      created_at: c.created_at,
    })),
    labels: issue.labels.map((l) => (typeof l === 'string' ? l : l.name || '')),
    assignees: issue.assignees?.map((a) => a.login) || [],
    created_at: issue.created_at,
    updated_at: issue.updated_at,
  };
}

/**
 * Fetch enhanced PR context including diff, files, commits, and reviews
 */
export async function fetchPRContext(
  octokit: Octokit,
  repository: GitHubRepository,
  prNumber: number
): Promise<EnhancedPRContext> {
  const [prResponse, filesResponse, commitsResponse, reviewsResponse, commentsResponse] =
    await Promise.all([
      octokit.pulls.get({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber,
      }),
      octokit.pulls.listFiles({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber,
        per_page: 100,
      }),
      octokit.pulls.listCommits({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber,
        per_page: 100,
      }),
      octokit.pulls.listReviews({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber,
        per_page: 100,
      }),
      octokit.pulls.listReviewComments({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber,
        per_page: 100,
      }),
    ]);

  const pr = prResponse.data;
  const files = filesResponse.data;
  const commits = commitsResponse.data;
  const reviews = reviewsResponse.data;
  const comments = commentsResponse.data;

  // Build diff from patches
  const diff = files
    .filter((f) => f.patch)
    .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`)
    .join('\n\n');

  return {
    body: pr.body,
    diff,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
    commits: commits.map((c) => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name || c.author?.login || 'unknown',
    })),
    reviews: reviews.map((r) => ({
      id: r.id,
      user: r.user?.login || 'unknown',
      state: r.state,
      body: r.body,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      user: c.user?.login || 'unknown',
      body: c.body,
      path: c.path,
      line: c.line || c.original_line,
    })),
  };
}

/**
 * Fetch enhanced context based on mention context
 */
export async function fetchEnhancedContext(
  octokit: Octokit,
  repository: GitHubRepository,
  issueNumber?: number,
  prNumber?: number
): Promise<EnhancedContext> {
  const result: EnhancedContext = {};

  if (prNumber) {
    result.pullRequest = await fetchPRContext(octokit, repository, prNumber);
  }

  if (issueNumber && !prNumber) {
    result.issue = await fetchIssueContext(octokit, repository, issueNumber);
  }

  return result;
}

/**
 * Format enhanced context for LLM prompt
 */
export function formatEnhancedContext(context: EnhancedContext): string {
  const sections: string[] = [];

  if (context.issue) {
    const issue = context.issue;
    sections.push('## Issue Details\n');

    if (issue.body) {
      sections.push(`**Description:**\n${issue.body}\n`);
    }

    if (issue.labels.length > 0) {
      sections.push(`**Labels:** ${issue.labels.join(', ')}\n`);
    }

    if (issue.assignees.length > 0) {
      sections.push(`**Assignees:** ${issue.assignees.join(', ')}\n`);
    }

    if (issue.comments.length > 0) {
      sections.push('\n### Comments\n');
      for (const comment of issue.comments.slice(-10)) {
        sections.push(`**@${comment.user}** (${comment.created_at}):\n${comment.body}\n\n`);
      }
    }
  }

  if (context.pullRequest) {
    const pr = context.pullRequest;
    sections.push('## Pull Request Details\n');

    if (pr.body) {
      sections.push(`**Description:**\n${pr.body}\n`);
    }

    if (pr.commits.length > 0) {
      sections.push('\n### Commits\n');
      for (const commit of pr.commits) {
        sections.push(`- \`${commit.sha}\` ${commit.message} (${commit.author})\n`);
      }
    }

    if (pr.files.length > 0) {
      sections.push('\n### Changed Files\n');
      for (const file of pr.files) {
        sections.push(
          `- \`${file.filename}\` (${file.status}) +${file.additions}/-${file.deletions}\n`
        );
      }
    }

    if (pr.reviews.length > 0) {
      sections.push('\n### Reviews\n');
      for (const review of pr.reviews) {
        sections.push(
          `**@${review.user}** (${review.state})${review.body ? `: ${review.body}` : ''}\n`
        );
      }
    }

    if (pr.diff) {
      // Truncate diff if too long
      const maxDiffLength = 10000;
      const truncatedDiff =
        pr.diff.length > maxDiffLength
          ? `${pr.diff.substring(0, maxDiffLength)}\n\n... (diff truncated)`
          : pr.diff;
      sections.push(`\n### Diff\n\`\`\`diff\n${truncatedDiff}\n\`\`\`\n`);
    }
  }

  return sections.join('');
}
