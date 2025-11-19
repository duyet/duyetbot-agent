/**
 * GitHub Webhook Handler
 *
 * Handles GitHub webhook events for @duyetbot mentions
 */

import crypto from 'node:crypto';
import type { Context } from 'hono';
import { getLogger } from '../api/middleware/logger';
import type { AppEnv } from '../api/types';
import { parseIssueComment, parsePullRequestComment } from './parser';

/**
 * GitHub webhook event types
 */
export type GitHubEvent =
  | 'issues'
  | 'issue_comment'
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment';

/**
 * Webhook payload
 */
export interface WebhookPayload {
  action: string;
  repository: {
    full_name: string;
    html_url: string;
  };
  sender: {
    login: string;
    html_url: string;
  };
  issue?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: {
      login: string;
    };
  };
  comment?: {
    id: number;
    body: string;
    html_url: string;
    user: {
      login: string;
    };
  };
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    user: {
      login: string;
    };
  };
}

/**
 * Issue comment webhook payload
 */
export interface IssueCommentPayload extends WebhookPayload {
  issue: NonNullable<WebhookPayload['issue']>;
  comment: NonNullable<WebhookPayload['comment']>;
}

/**
 * Pull request review comment webhook payload
 */
export interface PullRequestReviewCommentPayload extends WebhookPayload {
  pull_request: NonNullable<WebhookPayload['pull_request']>;
  comment: NonNullable<WebhookPayload['comment']>;
}

/**
 * Verify GitHub webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Check if comment mentions @duyetbot
 */
export function mentionsDuyetbot(text: string): boolean {
  return /@duyetbot\b/i.test(text);
}

/**
 * Extract command from comment
 */
export function extractCommand(text: string): string {
  // Remove @duyetbot mention and trim
  return text.replace(/@duyetbot\b/i, '').trim();
}

/**
 * Handle GitHub webhook
 */
export async function handleGitHubWebhook(
  c: Context<AppEnv>,
  event: GitHubEvent,
  payload: WebhookPayload
): Promise<Response> {
  const logger = getLogger(c);

  logger.info('GitHub webhook received', {
    event,
    action: payload.action,
    repository: payload.repository.full_name,
    sender: payload.sender.login,
  });

  try {
    // Check if it's a relevant event
    if (event === 'issue_comment') {
      return await handleIssueComment(c, payload);
    }

    if (event === 'pull_request_review_comment') {
      return await handlePullRequestComment(c, payload);
    }

    if (event === 'issues' && payload.action === 'opened') {
      return await handleNewIssue(c, payload);
    }

    logger.info('Ignoring webhook event', { event, action: payload.action });

    return c.json({
      success: true,
      message: 'Event ignored',
    });
  } catch (error) {
    logger.error('Webhook handling failed', error instanceof Error ? error : undefined);

    return c.json(
      {
        success: false,
        error: 'Webhook processing failed',
      },
      500
    );
  }
}

/**
 * Handle issue comment
 */
async function handleIssueComment(c: Context<AppEnv>, payload: WebhookPayload): Promise<Response> {
  const logger = getLogger(c);

  // Check if comment exists and mentions @duyetbot
  if (!payload.comment || !mentionsDuyetbot(payload.comment.body)) {
    return c.json({
      success: true,
      message: 'No mention found',
    });
  }

  const parsed = parseIssueComment(payload);

  logger.info('Processing @duyetbot mention', {
    repository: parsed.repository,
    issue: parsed.issueNumber,
    command: parsed.command,
  });

  // TODO: Process command with agent
  // - Create or get session for this issue
  // - Run agent with command
  // - Post response as comment

  return c.json({
    success: true,
    message: 'Comment processed',
    data: parsed,
  });
}

/**
 * Handle pull request comment
 */
async function handlePullRequestComment(
  c: Context<AppEnv>,
  payload: WebhookPayload
): Promise<Response> {
  const logger = getLogger(c);

  // Check if comment exists and mentions @duyetbot
  if (!payload.comment || !mentionsDuyetbot(payload.comment.body)) {
    return c.json({
      success: true,
      message: 'No mention found',
    });
  }

  const parsed = parsePullRequestComment(payload);

  logger.info('Processing @duyetbot mention in PR', {
    repository: parsed.repository,
    pr: parsed.prNumber,
    command: parsed.command,
  });

  // TODO: Process command with agent
  // - Create or get session for this PR
  // - Run agent with command
  // - Post response as comment

  return c.json({
    success: true,
    message: 'PR comment processed',
    data: parsed,
  });
}

/**
 * Handle new issue
 */
async function handleNewIssue(c: Context<AppEnv>, payload: WebhookPayload): Promise<Response> {
  const logger = getLogger(c);

  // Check if issue body mentions @duyetbot
  if (!payload.issue || !mentionsDuyetbot(payload.issue.body || '')) {
    return c.json({
      success: true,
      message: 'No mention found',
    });
  }

  const parsed = parseIssueComment(payload);

  logger.info('Processing @duyetbot mention in new issue', {
    repository: parsed.repository,
    issue: parsed.issueNumber,
    command: parsed.command,
  });

  // TODO: Process command with agent
  // - Create session for this issue
  // - Run agent with command
  // - Post response as comment

  return c.json({
    success: true,
    message: 'New issue processed',
    data: parsed,
  });
}
