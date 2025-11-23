/**
 * Issue Event Handler
 *
 * Handles GitHub issue events (opened, edited, closed, reopened, labeled, etc.)
 */

import { Octokit } from '@octokit/rest';
import { logger } from '../logger.js';
import type { GitHubIssue, GitHubRepository, GitHubUser, MentionContext } from '../types.js';

export interface IssueEvent {
  action:
    | 'opened'
    | 'edited'
    | 'closed'
    | 'reopened'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'locked'
    | 'unlocked'
    | 'transferred'
    | 'milestoned'
    | 'demilestoned';
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: GitHubUser;
  label?: { id: number; name: string; color: string };
  assignee?: GitHubUser;
  changes?: {
    title?: { from: string };
    body?: { from: string };
  };
}

export interface IssueHandlerConfig {
  /** Actions to respond to automatically */
  autoRespondActions?: Array<'opened' | 'reopened'>;
  /** Labels that trigger automatic analysis */
  triggerLabels?: string[];
  /** System prompt template for issue analysis */
  analysisPromptTemplate?: string;
}

/**
 * Handle issue event
 */
export async function handleIssueEvent(
  event: IssueEvent,
  octokit: Octokit,
  botUsername: string,
  onMention: (context: MentionContext) => Promise<string>,
  config?: IssueHandlerConfig
): Promise<void> {
  const autoRespondActions = config?.autoRespondActions || [];
  const triggerLabels = config?.triggerLabels || [];

  // Don't respond to our own actions
  if (event.sender.login === botUsername) {
    return;
  }

  // Check if this action should trigger auto-response
  const shouldRespond =
    // Auto-respond to configured actions
    autoRespondActions.includes(event.action as 'opened' | 'reopened') ||
    // Or when a trigger label is added
    (event.action === 'labeled' && event.label && triggerLabels.includes(event.label.name));

  if (!shouldRespond) {
    return;
  }

  logger.info('Issue event received', {
    action: event.action,
    repository: `${event.repository.owner.login}/${event.repository.name}`,
    issueNumber: event.issue.number,
    sender: event.sender.login,
  });

  // Build context
  const context: MentionContext = {
    task: buildTaskForIssueEvent(event, config),
    repository: event.repository,
    issue: event.issue,
    mentionedBy: event.sender,
  };

  const startTime = Date.now();
  try {
    // Execute agent and get response
    const response = await onMention(context);
    const durationMs = Date.now() - startTime;

    // Post response as comment
    await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.issue.number,
      body: response,
    });

    logger.info('Issue event handled', {
      action: event.action,
      repository: `${event.repository.owner.login}/${event.repository.name}`,
      issueNumber: event.issue.number,
      durationMs,
      responseLength: response.length,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.error('Error handling issue event', {
      action: event.action,
      repository: `${event.repository.owner.login}/${event.repository.name}`,
      issueNumber: event.issue.number,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't post error for automatic responses to avoid noise
  }
}

/**
 * Build task description based on issue event
 */
function buildTaskForIssueEvent(event: IssueEvent, config?: IssueHandlerConfig): string {
  const customTemplate = config?.analysisPromptTemplate;

  switch (event.action) {
    case 'opened':
      if (customTemplate) {
        return customTemplate
          .replace('{action}', 'new')
          .replace('{issue_number}', String(event.issue.number));
      }
      return `Analyze this new issue and provide initial assessment:\n\nTitle: ${event.issue.title}\n\nBody:\n${event.issue.body || '(no description)'}`;

    case 'reopened':
      return `This issue was reopened. Review the history and provide updated analysis:\n\nTitle: ${event.issue.title}`;

    case 'labeled':
      if (event.label) {
        return `Label "${event.label.name}" was added to this issue. Provide analysis based on this categorization:\n\nTitle: ${event.issue.title}`;
      }
      return `Analyze this issue:\n\nTitle: ${event.issue.title}`;

    default:
      return `Analyze issue #${event.issue.number}: ${event.issue.title}`;
  }
}

/**
 * Create session ID for issue
 */
export function createIssueSessionId(repository: GitHubRepository, issueNumber: number): string {
  return `github:${repository.owner.login}/${repository.name}:issue:${issueNumber}`;
}
