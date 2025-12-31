/**
 * Merge Conflict Detection for GitHub PRs
 *
 * Provides automatic merge conflict detection and reporting for pull requests.
 * When conflicts are detected, posts a comment with conflict status and resolution suggestions.
 */

import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

/**
 * Merge conflict status
 */
export type MergeConflictStatus = 'clean' | 'conflicting' | 'unknown';

/**
 * Result of merge conflict check
 */
export interface MergeConflictResult {
  /** Whether the PR can be merged */
  mergeable: boolean | null;
  /** Merge commit SHA if available */
  mergeCommitSha?: string | null;
  /** Conflict status */
  status: MergeConflictStatus;
  /** Human-readable message */
  message: string;
}

/**
 * Check if a PR has merge conflicts
 *
 * Uses GitHub's mergeable status to detect conflicts:
 * - true: PR can be merged cleanly
 * - false: PR has merge conflicts
 * - null: GitHub is still checking mergeability
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pullNumber - Pull request number
 * @returns Merge conflict result
 */
export async function checkMergeConflicts(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<MergeConflictResult> {
  try {
    const response = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
    });

    const { mergeable, merge_commit_sha } = response.data;

    // Determine conflict status
    let status: MergeConflictStatus;
    let message: string;

    if (mergeable === true) {
      status = 'clean';
      message = 'This PR can be merged cleanly.';
    } else if (mergeable === false) {
      status = 'conflicting';
      message = 'This PR has merge conflicts that need to be resolved.';
    } else {
      status = 'unknown';
      message = 'GitHub is still checking mergeability. Please wait a moment.';
    }

    logger.debug('[MERGE_CONFLICT] Conflict check complete', {
      repository: `${owner}/${repo}`,
      pullNumber,
      mergeable,
      status,
    });

    return {
      mergeable,
      mergeCommitSha: merge_commit_sha,
      status,
      message,
    };
  } catch (error) {
    logger.error('[MERGE_CONFLICT] Failed to check conflicts', {
      repository: `${owner}/${repo}`,
      pullNumber,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      mergeable: null,
      status: 'unknown',
      message: 'Unable to check merge status due to an error.',
    };
  }
}

/**
 * Format a conflict comment message
 *
 * @param result - Merge conflict result
 * @param pullNumber - Pull request number
 * @param headRef - Branch name with changes
 * @param baseRef - Target branch name
 * @returns Formatted comment message
 */
export function formatConflictComment(
  result: MergeConflictResult,
  pullNumber: number,
  headRef: string,
  baseRef: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('## Merge Status Check');
  lines.push('');

  // Status emoji and message (add emoji based on status)
  const statusEmoji =
    result.status === 'clean' ? '✅' : result.status === 'conflicting' ? '⚠️' : '⏳';
  lines.push(`${statusEmoji} ${result.message}`);
  lines.push('');

  // Branch info
  lines.push(`**Pull Request:** #${pullNumber}`);
  lines.push(`**Branch:** \`${headRef}\` → \`${baseRef}\``);
  lines.push('');

  // Resolution suggestions based on status
  if (result.status === 'conflicting') {
    lines.push('### Resolution Steps');
    lines.push('');
    lines.push('1. Update your local branch:');
    lines.push('   ```bash');
    lines.push(`   git fetch origin ${baseRef}`);
    lines.push(`   git checkout ${headRef}`);
    lines.push(`   git merge origin/${baseRef}`);
    lines.push('   ```');
    lines.push('');
    lines.push('2. Resolve conflicts in your editor');
    lines.push('');
    lines.push('3. Commit the resolution:');
    lines.push('   ```bash');
    lines.push('   git add .');
    lines.push('   git commit -m "Resolve merge conflicts"');
    lines.push(`   git push origin ${headRef}`);
    lines.push('   ```');
    lines.push('');
    lines.push('4. The merge status will update automatically after pushing.');
    lines.push('');
  } else if (result.status === 'clean') {
    lines.push('### Next Steps');
    lines.push('');
    lines.push('This PR is ready to merge! 🎉');
    lines.push('');
  } else if (result.status === 'unknown') {
    lines.push('### Note');
    lines.push('');
    lines.push(
      'GitHub is calculating mergeability. This comment will update once the check completes.'
    );
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Checked by ${process.env.CF_PAGES || 'duyetbot'}*`);

  return lines.join('\n');
}

/**
 * Post a comment on a PR
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue or PR number
 * @param body - Comment body
 * @returns True if comment was posted successfully
 */
export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<boolean> {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });

    logger.info('[MERGE_CONFLICT] Comment posted', {
      repository: `${owner}/${repo}`,
      issueNumber,
    });

    return true;
  } catch (error) {
    logger.error('[MERGE_CONFLICT] Failed to post comment', {
      repository: `${owner}/${repo}`,
      issueNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Find existing bot comment on an issue/PR
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue or PR number
 * @param botUsername - Username of the bot to search for
 * @returns Comment ID if found, null otherwise
 */
export async function findBotComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  botUsername: string
): Promise<number | null> {
  try {
    const response = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    // Find most recent comment from bot that starts with our header
    const botComment = response.data
      .reverse()
      .find(
        (comment) =>
          comment.user?.login === botUsername && comment.body?.includes('## Merge Status Check')
      );

    return botComment?.id ?? null;
  } catch (error) {
    logger.error('[MERGE_CONFLICT] Failed to find bot comment', {
      repository: `${owner}/${repo}`,
      issueNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Update an existing comment
 *
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID to update
 * @param body - New comment body
 * @returns True if comment was updated successfully
 */
export async function updateComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  body: string
): Promise<boolean> {
  try {
    await octokit.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    });

    logger.info('[MERGE_CONFLICT] Comment updated', {
      repository: `${owner}/${repo}`,
      commentId,
    });

    return true;
  } catch (error) {
    logger.error('[MERGE_CONFLICT] Failed to update comment', {
      repository: `${owner}/${repo}`,
      commentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Detect and report merge conflicts for a PR
 *
 * Checks mergeability, finds or creates a bot comment, and updates it with
 * the current merge status.
 *
 * @param githubToken - GitHub authentication token
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pullNumber - Pull request number
 * @param headRef - Branch name with changes
 * @param baseRef - Target branch name
 * @param botUsername - Bot username (for finding existing comments)
 * @returns True if operation was successful
 */
export async function detectAndReportConflicts(
  githubToken: string,
  owner: string,
  repo: string,
  pullNumber: number,
  headRef: string,
  baseRef: string,
  botUsername: string
): Promise<boolean> {
  const octokit = new Octokit({ auth: githubToken });

  // Check merge conflicts
  const result = await checkMergeConflicts(octokit, owner, repo, pullNumber);

  // Skip posting if status is unknown (still checking)
  if (result.status === 'unknown') {
    logger.debug('[MERGE_CONFLICT] Skipping comment, status unknown', {
      repository: `${owner}/${repo}`,
      pullNumber,
    });
    return false;
  }

  // Format comment
  const commentBody = formatConflictComment(result, pullNumber, headRef, baseRef);

  // Find existing bot comment
  const existingCommentId = await findBotComment(octokit, owner, repo, pullNumber, botUsername);

  if (existingCommentId) {
    // Update existing comment
    return await updateComment(octokit, owner, repo, existingCommentId, commentBody);
  } else {
    // Create new comment
    return await postComment(octokit, owner, repo, pullNumber, commentBody);
  }
}
