/**
 * Pull Request Event Handler
 *
 * Handles GitHub pull request events (opened, edited, closed, merged, etc.)
 */

import { Octokit } from '@octokit/rest';
import type { GitHubPullRequest, GitHubRepository, GitHubUser, MentionContext } from '../types.js';

export interface PullRequestEvent {
  action:
    | 'opened'
    | 'edited'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'review_requested'
    | 'review_request_removed'
    | 'synchronize'
    | 'converted_to_draft'
    | 'ready_for_review';
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
  label?: { id: number; name: string; color: string };
  requested_reviewer?: GitHubUser;
  changes?: {
    title?: { from: string };
    body?: { from: string };
  };
}

export interface PullRequestHandlerConfig {
  /** Actions to respond to automatically */
  autoRespondActions?: Array<'opened' | 'ready_for_review' | 'synchronize'>;
  /** Labels that trigger automatic review */
  triggerLabels?: string[];
  /** Whether to auto-review when ready for review */
  autoReviewOnReady?: boolean;
  /** Custom prompt for PR analysis */
  analysisPromptTemplate?: string;
}

/**
 * Handle pull request event
 */
export async function handlePullRequestEvent(
  event: PullRequestEvent,
  octokit: Octokit,
  botUsername: string,
  onMention: (context: MentionContext) => Promise<string>,
  config?: PullRequestHandlerConfig
): Promise<void> {
  const autoRespondActions = config?.autoRespondActions || [];
  const triggerLabels = config?.triggerLabels || [];
  const autoReviewOnReady = config?.autoReviewOnReady ?? false;

  // Don't respond to our own actions
  if (event.sender.login === botUsername) {
    return;
  }

  // Check if this action should trigger auto-response
  const shouldRespond =
    // Auto-respond to configured actions
    autoRespondActions.includes(event.action as 'opened' | 'ready_for_review' | 'synchronize') ||
    // Or when a trigger label is added
    (event.action === 'labeled' && event.label && triggerLabels.includes(event.label.name)) ||
    // Or when PR is marked ready for review (if enabled)
    (event.action === 'ready_for_review' && autoReviewOnReady);

  if (!shouldRespond) {
    return;
  }

  // Build context
  const context: MentionContext = {
    task: buildTaskForPREvent(event, config),
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
    mentionedBy: event.sender,
  };

  try {
    // Execute agent and get response
    const response = await onMention(context);

    // Post response as comment
    await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: response,
    });
  } catch (error) {
    console.error('Error handling pull request event:', error);
    // Don't post error for automatic responses to avoid noise
  }
}

/**
 * Build task description based on PR event
 */
function buildTaskForPREvent(event: PullRequestEvent, config?: PullRequestHandlerConfig): string {
  const customTemplate = config?.analysisPromptTemplate;
  const pr = event.pull_request;

  switch (event.action) {
    case 'opened':
      if (customTemplate) {
        return customTemplate.replace('{action}', 'new').replace('{pr_number}', String(pr.number));
      }
      return `Review this new pull request and provide feedback:\n\nTitle: ${pr.title}\n\nDescription:\n${pr.body || '(no description)'}\n\nChanges: ${pr.changed_files} files (+${pr.additions} -${pr.deletions})`;

    case 'ready_for_review':
      return `This PR is ready for review. Please provide a code review:\n\nTitle: ${pr.title}\n\nChanges: ${pr.changed_files} files (+${pr.additions} -${pr.deletions})`;

    case 'synchronize':
      return `New commits pushed to this PR. Review the latest changes:\n\nTitle: ${pr.title}\n\nBranch: ${pr.head.ref}`;

    case 'labeled':
      if (event.label) {
        return `Label "${event.label.name}" was added. Analyze this PR:\n\nTitle: ${pr.title}`;
      }
      return `Analyze PR #${pr.number}: ${pr.title}`;

    default:
      return `Analyze PR #${pr.number}: ${pr.title}`;
  }
}

/**
 * Create session ID for pull request
 */
export function createPRSessionId(repository: GitHubRepository, prNumber: number): string {
  return `github:${repository.owner.login}/${repository.name}:pr:${prNumber}`;
}
