/**
 * Shared types for GitHub webhook middlewares
 *
 * These types define the structure of GitHub webhook payloads, context,
 * environment bindings, and middleware variables used across the signature,
 * parser, and mention middlewares.
 */

import type { CloudflareChatAgentNamespace } from '@duyetbot/cloudflare-agent';
import type { GitHubContext } from '../transport.js';

/**
 * GitHub user structure from webhook payload
 */
export interface GitHubUser {
  /** GitHub user login/username */
  login: string;
  /** Numeric user ID */
  id: number;
  /** User type (User, Bot, Organization) */
  type?: string;
}

/**
 * GitHub comment structure from webhook payload
 */
export interface GitHubComment {
  /** Comment ID */
  id: number;
  /** Comment body text */
  body: string;
  /** Comment author */
  user: GitHubUser;
  /** HTML URL to the comment */
  html_url: string;
  /** Creation timestamp */
  created_at: string;
}

/**
 * GitHub issue structure from webhook payload
 */
export interface GitHubIssue {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body text */
  body: string | null;
  /** Issue state (open, closed) */
  state: string;
  /** Issue labels */
  labels: Array<{ name: string }>;
  /** HTML URL to the issue */
  html_url: string;
  /** Pull request info if this is a PR */
  pull_request?: {
    url: string;
  };
}

/**
 * GitHub pull request structure from webhook payload
 */
export interface GitHubPullRequest {
  /** PR number */
  number: number;
  /** PR title */
  title: string;
  /** PR body text */
  body: string | null;
  /** PR state (open, closed, merged) */
  state: string;
  /** PR labels */
  labels: Array<{ name: string }>;
  /** HTML URL to the PR */
  html_url: string;
  /** Lines added in the PR */
  additions?: number;
  /** Lines deleted in the PR */
  deletions?: number;
  /** Number of commits in the PR */
  commits?: number;
  /** Number of changed files */
  changed_files?: number;
  /** Source branch reference */
  head?: {
    ref: string;
    sha: string;
  };
  /** Target branch reference */
  base?: {
    ref: string;
  };
  /** URL to fetch the diff */
  diff_url?: string;
}

/**
 * GitHub repository structure from webhook payload
 */
export interface GitHubRepository {
  /** Repository name */
  name: string;
  /** Full repository name (owner/repo) */
  full_name: string;
  /** Repository owner */
  owner: GitHubUser;
}

/**
 * Simplified issue context for downstream handlers
 *
 * Contains only the essential issue fields needed for processing.
 * The body is normalized to string (empty string if null in payload).
 */
export interface IssueContext {
  /** Issue number */
  number: number;
  /** Issue title */
  title: string;
  /** Issue body text (empty string if null) */
  body: string;
  /** Issue state (open, closed) */
  state: string;
}

/**
 * Simplified comment context for downstream handlers
 *
 * Contains only the essential comment fields needed for processing.
 */
export interface CommentContext {
  /** Comment ID */
  id: number;
  /** Comment body text */
  body: string;
}

/**
 * Parsed webhook context available to downstream handlers
 *
 * Contains extracted and validated data from the GitHub webhook,
 * ready for use by handlers and agents.
 */
export interface WebhookContext {
  /** Repository owner (user or organization login) */
  owner: string;
  /** Repository name */
  repo: string;
  /** GitHub webhook event type */
  event: string;
  /** Webhook action (created, opened, edited, etc.) */
  action: string;
  /** GitHub delivery ID for tracing */
  deliveryId: string;
  /** Internal request ID for correlation */
  requestId: string;
  /** Event sender */
  sender: GitHubUser;
  /** Simplified issue information (for issue/issue_comment events) */
  issue?: IssueContext | undefined;
  /** Simplified comment information (for comment events) */
  comment?: CommentContext | undefined;
  /** Whether this event is from a pull request (vs issue) */
  isPullRequest: boolean;
  // PR-specific metadata (only present for pull requests)
  /** Lines added in the PR */
  additions?: number;
  /** Lines deleted in the PR */
  deletions?: number;
  /** Number of commits in the PR */
  commits?: number;
  /** Number of changed files */
  changedFiles?: number;
  /** Source branch name */
  headRef?: string;
  /** Target branch name */
  baseRef?: string;
  // Review request metadata
  /** Whether this is a review request event (pull_request:review_requested) */
  isReviewRequest?: boolean;
  /** Username of the requested reviewer (for review_requested events) */
  requestedReviewer?: string;
}

/**
 * Environment bindings for GitHub bot worker
 *
 * Defines the required and optional environment variables
 * available in the Cloudflare Worker context.
 */
export interface Env {
  /** GitHub API token for authentication */
  GITHUB_TOKEN: string;
  /** Webhook secret for signature verification */
  GITHUB_WEBHOOK_SECRET?: string;
  /** Bot username for mention detection (default: 'duyetbot') */
  BOT_USERNAME?: string;
  /** OpenRouter API key */
  OPENROUTER_API_KEY?: string;
  /** Enable router debug logging */
  ROUTER_DEBUG?: string;
  /** GitHub Agent Durable Object binding */
  GitHubAgent: CloudflareChatAgentNamespace<Env, GitHubContext>;
}

/**
 * Variables set by the signature middleware
 *
 * These variables indicate whether signature verification passed.
 */
export type SignatureVariables = {
  /** Whether to skip further processing (signature invalid) */
  skipProcessing: boolean;
  /** Raw request body for downstream use */
  rawBody: string;
};

/**
 * GitHub webhook payload structure
 *
 * Represents the incoming webhook payload from GitHub.
 * This is a union of common fields across different event types.
 *
 * @see https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
export interface GitHubWebhookPayload {
  /** Action that triggered the webhook (created, opened, edited, etc.) */
  action: string;
  /** User who triggered the event */
  sender: GitHubUser;
  /** Repository where the event occurred */
  repository: GitHubRepository;
  /** Issue information (for issue-related events) */
  issue?: GitHubIssue;
  /** Pull request information (for PR-related events) */
  pull_request?: GitHubPullRequest;
  /** Comment information (for comment-related events) */
  comment?: GitHubComment;
  /** Hook ID (for ping events) */
  hook_id?: number;
  /** Requested reviewer (for pull_request review_requested events) */
  requested_reviewer?: GitHubUser;
}

/**
 * Variables set by the parser middleware
 *
 * These variables are available to downstream middlewares and handlers
 * after the parser middleware has processed the request.
 */
export type ParserVariables = SignatureVariables & {
  /** Parsed webhook context, undefined if parsing failed */
  webhookContext: WebhookContext | undefined;
  /** Parsed webhook payload, undefined if parsing failed */
  payload: GitHubWebhookPayload | undefined;
};

/**
 * Variables set by the mention middleware
 *
 * Extends ParserVariables with mention detection results.
 * These variables are available after signature, parser, and mention middlewares.
 */
export type MentionVariables = ParserVariables & {
  /** Whether the bot was mentioned in the message */
  hasMention: boolean;
  /** Extracted task text after the mention, undefined if no mention */
  task: string | undefined;
};
