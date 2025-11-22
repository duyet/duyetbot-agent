/**
 * Mention Handler
 *
 * Handles @duyetbot mentions in GitHub comments
 */

import { Octokit } from '@octokit/rest';
import { logger } from '../logger.js';
import { parseMention } from '../mention-parser.js';
import type {
  GitHubComment,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
  MentionContext,
} from '../types.js';

/**
 * Add a reaction to a comment to indicate processing status
 */
async function addReaction(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reaction: 'eyes' | 'rocket' | '+1' | '-1' | 'confused' | 'heart' | 'hooray' | 'laugh'
): Promise<number | null> {
  try {
    const { data } = await octokit.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
    return data.id;
  } catch {
    // Silently ignore reaction failures
    return null;
  }
}

/**
 * Remove a reaction from a comment
 */
async function removeReaction(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reactionId: number
): Promise<void> {
  try {
    await octokit.reactions.deleteForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      reaction_id: reactionId,
    });
  } catch {
    // Silently ignore removal failures
  }
}

export interface IssueCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  comment: GitHubComment;
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: { login: string };
}

export interface PRReviewCommentEvent {
  action: 'created' | 'edited' | 'deleted';
  comment: GitHubComment;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: { login: string };
}

/**
 * Handle issue comment event
 */
export async function handleIssueComment(
  event: IssueCommentEvent,
  octokit: Octokit,
  botUsername: string,
  onMention: (context: MentionContext) => Promise<string>
): Promise<void> {
  const repo = event.repository.full_name;
  const issueNumber = event.issue.number;

  // Only handle created comments
  if (event.action !== 'created') {
    logger.debug('Issue comment skipped', {
      reason: 'not_created',
      action: event.action,
      repository: repo,
      issue: issueNumber,
    });
    return;
  }

  // Don't respond to our own comments
  if (event.comment.user.login === botUsername) {
    logger.debug('Issue comment skipped', {
      reason: 'own_comment',
      repository: repo,
      issue: issueNumber,
    });
    return;
  }

  // Parse mention
  const mention = parseMention(event.comment.body, botUsername);
  if (!mention.found) {
    logger.debug('Issue comment skipped', {
      reason: 'no_mention',
      repository: repo,
      issue: issueNumber,
      sender: event.sender.login,
    });
    return;
  }

  logger.info('Mention found', {
    repository: repo,
    issue: issueNumber,
    sender: event.sender.login,
    task: mention.task.substring(0, 100),
    commentId: event.comment.id,
  });

  // Build context
  const context: MentionContext = {
    task: mention.task,
    repository: event.repository,
    issue: event.issue,
    comment: event.comment,
    mentionedBy: event.comment.user,
  };

  // Check if this is a PR (issues API is used for both)
  if ('pull_request' in event.issue) {
    logger.debug('Fetching PR details', {
      repository: repo,
      pullNumber: event.issue.number,
    });

    // Fetch full PR details
    const { data: pr } = await octokit.pulls.get({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.issue.number,
    });

    context.pullRequest = {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state as 'open' | 'closed' | 'merged',
      user: pr.user as { id: number; login: string },
      head: {
        ref: pr.head.ref,
        sha: pr.head.sha,
      },
      base: {
        ref: pr.base.ref,
        sha: pr.base.sha,
      },
      changed_files: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
    };

    logger.debug('PR details fetched', {
      repository: repo,
      pullNumber: pr.number,
      changedFiles: pr.changed_files,
      additions: pr.additions,
      deletions: pr.deletions,
    });
  }

  // Add eyes reaction to indicate processing
  const owner = event.repository.owner.login;
  const repoName = event.repository.name;

  logger.debug('Adding processing reaction', {
    repository: repo,
    issue: issueNumber,
    commentId: event.comment.id,
  });

  const reactionId = await addReaction(octokit, owner, repoName, event.comment.id, 'eyes');

  const startTime = Date.now();

  try {
    logger.info('Agent invocation started', {
      repository: repo,
      issue: issueNumber,
      commentId: event.comment.id,
    });

    // Execute agent and get response
    const response = await onMention(context);

    const durationMs = Date.now() - startTime;

    logger.info('Agent invocation completed', {
      repository: repo,
      issue: issueNumber,
      durationMs,
      responseLength: response.length,
    });

    // Remove eyes reaction and add rocket to indicate success
    if (reactionId) {
      await removeReaction(octokit, owner, repoName, event.comment.id, reactionId);
    }
    await addReaction(octokit, owner, repoName, event.comment.id, 'rocket');

    logger.debug('Posting response comment', {
      repository: repo,
      issue: issueNumber,
      responseLength: response.length,
    });

    // Post response as comment
    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: event.issue.number,
      body: response,
    });

    logger.info('Response posted', {
      repository: repo,
      issue: issueNumber,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Agent invocation error', {
      repository: repo,
      issue: issueNumber,
      error: errorMessage,
      durationMs,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Remove eyes reaction and add confused to indicate error
    if (reactionId) {
      await removeReaction(octokit, owner, repoName, event.comment.id, reactionId);
    }
    await addReaction(octokit, owner, repoName, event.comment.id, 'confused');

    // Post error message
    await octokit.issues.createComment({
      owner,
      repo: repoName,
      issue_number: event.issue.number,
      body: `Sorry, I encountered an error while processing your request:\n\n\`\`\`\n${errorMessage}\n\`\`\``,
    });
  }
}

/**
 * Handle PR review comment event
 */
export async function handlePRReviewComment(
  event: PRReviewCommentEvent,
  octokit: Octokit,
  botUsername: string,
  onMention: (context: MentionContext) => Promise<string>
): Promise<void> {
  // Only handle created comments
  if (event.action !== 'created') {
    return;
  }

  // Don't respond to our own comments
  if (event.comment.user.login === botUsername) {
    return;
  }

  // Parse mention
  const mention = parseMention(event.comment.body, botUsername);
  if (!mention.found) {
    return;
  }

  // Build context
  const context: MentionContext = {
    task: mention.task,
    repository: event.repository,
    pullRequest: {
      number: event.pull_request.number,
      title: event.pull_request.title,
      body: event.pull_request.body,
      state: event.pull_request.state,
      user: event.pull_request.user,
      head: event.pull_request.head,
      base: event.pull_request.base,
      changed_files: event.pull_request.changed_files,
      additions: event.pull_request.additions,
      deletions: event.pull_request.deletions,
    },
    comment: event.comment,
    mentionedBy: event.comment.user,
  };

  // Add eyes reaction to indicate processing
  const owner = event.repository.owner.login;
  const repo = event.repository.name;
  const reactionId = await addReaction(octokit, owner, repo, event.comment.id, 'eyes');

  try {
    // Execute agent and get response
    const response = await onMention(context);

    // Remove eyes reaction and add rocket to indicate success
    if (reactionId) {
      await removeReaction(octokit, owner, repo, event.comment.id, reactionId);
    }
    await addReaction(octokit, owner, repo, event.comment.id, 'rocket');

    // Post response as review comment reply
    await octokit.pulls.createReplyForReviewComment({
      owner,
      repo,
      pull_number: event.pull_request.number,
      comment_id: event.comment.id,
      body: response,
    });
  } catch (error) {
    // Remove eyes reaction and add confused to indicate error
    if (reactionId) {
      await removeReaction(octokit, owner, repo, event.comment.id, reactionId);
    }
    await addReaction(octokit, owner, repo, event.comment.id, 'confused');

    // Post error as regular comment
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: event.pull_request.number,
      body: `Sorry, I encountered an error while processing your request:\n\n\`\`\`\n${errorMessage}\n\`\`\``,
    });
  }
}
