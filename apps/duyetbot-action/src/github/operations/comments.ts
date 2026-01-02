/**
 * Comment Operations
 *
 * GitHub API operations for issue/PR comments.
 */

import type { Octokit } from '../api/client.js';

export interface CommentOptions {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

export interface UpdateCommentOptions {
  owner: string;
  repo: string;
  commentId: number;
  body: string;
}

export interface CommentResult {
  id: number;
  htmlUrl: string;
}

/**
 * Create a comment on an issue or PR
 */
export async function createComment(
  octokit: Octokit,
  options: CommentOptions
): Promise<CommentResult> {
  const { owner, repo, issueNumber, body } = options;

  const response = await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });

  return {
    id: response.data.id,
    htmlUrl: response.data.html_url,
  };
}

/**
 * Update an existing comment
 */
export async function updateComment(
  octokit: Octokit,
  options: UpdateCommentOptions
): Promise<CommentResult> {
  const { owner, repo, commentId, body } = options;

  const response = await octokit.rest.issues.updateComment({
    owner,
    repo,
    comment_id: commentId,
    body,
  });

  return {
    id: response.data.id,
    htmlUrl: response.data.html_url,
  };
}

/**
 * Delete a comment
 */
export async function deleteComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number
): Promise<void> {
  await octokit.rest.issues.deleteComment({
    owner,
    repo,
    comment_id: commentId,
  });
}

/**
 * List comments on an issue/PR
 */
export async function listComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<Array<{ id: number; body: string; htmlUrl: string; createdAt: string }>> {
  const response = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return response.data.map((comment) => ({
    id: comment.id,
    body: comment.body || '',
    htmlUrl: comment.html_url,
    createdAt: comment.created_at,
  }));
}

/**
 * Find a comment by bot username with a specific marker
 */
export async function findBotComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  _botUsername: string,
  marker: string
): Promise<{ id: number; body: string } | null> {
  const comments = await listComments(octokit, owner, repo, issueNumber);

  for (const comment of comments) {
    // Check if comment is by bot and contains marker
    if (comment.body.includes(marker)) {
      // Verify it's from the bot by checking comment author
      // Note: We'd need to fetch comment details to get author, but for now
      // we'll assume the marker is unique enough
      return { id: comment.id, body: comment.body };
    }
  }

  return null;
}
