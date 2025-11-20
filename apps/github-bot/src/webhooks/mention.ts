/**
 * Mention Handler
 *
 * Handles @duyetbot mentions in GitHub comments
 */

import { Octokit } from '@octokit/rest';
import type { MentionContext, GitHubRepository, GitHubComment, GitHubIssue, GitHubPullRequest } from '../types.js';
import { parseMention } from '../mention-parser.js';

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
    issue: event.issue,
    comment: event.comment,
    mentionedBy: event.comment.user,
  };

  // Check if this is a PR (issues API is used for both)
  if ('pull_request' in event.issue) {
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
  }

  try {
    // Execute agent and get response
    const response = await onMention(context);

    // Post response as comment
    await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.issue.number,
      body: response,
    });
  } catch (error) {
    // Post error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
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

  try {
    // Execute agent and get response
    const response = await onMention(context);

    // Post response as review comment reply
    await octokit.pulls.createReplyForReviewComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pull_number: event.pull_request.number,
      comment_id: event.comment.id,
      body: response,
    });
  } catch (error) {
    // Post error as regular comment
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: `Sorry, I encountered an error while processing your request:\n\n\`\`\`\n${errorMessage}\n\`\`\``,
    });
  }
}
