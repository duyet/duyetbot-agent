/**
 * GitHub Transport Layer
 *
 * Implements the Transport interface for GitHub Issues/PRs API.
 */

import type { MessageRef, ParsedInput, Transport } from '@duyetbot/chat-agent';
import { Octokit } from '@octokit/rest';
import { logger } from './logger.js';

/**
 * GitHub-specific context for transport operations
 *
 * Note: This context must be serializable for Cloudflare Durable Object RPC.
 * We pass the GitHub token instead of an Octokit instance, and create
 * Octokit lazily in transport methods.
 */
export interface GitHubContext {
  /** GitHub token for API calls (serializable) */
  githubToken: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue or PR number */
  issueNumber: number;
  /** Comment ID if this is a comment reply */
  commentId?: number;
  /** Message body (task/question) */
  body: string;
  /** User who triggered the action */
  sender: {
    id: number;
    login: string;
  };
  /** Start time for duration tracking */
  startTime: number;
  /** Full URL to the issue or PR */
  url: string;
  /** Issue or PR title */
  title: string;
  /** Whether this is a pull request (true) or issue (false) */
  isPullRequest: boolean;
  /** Issue or PR state (open, closed) */
  state: string;
  /** Labels on the issue or PR */
  labels: string[];
  /** Issue or PR description/body */
  description?: string;
}

/**
 * GitHub transport implementation
 *
 * @example
 * ```typescript
 * const GitHubAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createOpenRouterProvider(env),
 *   systemPrompt: GITHUB_SYSTEM_PROMPT,
 *   transport: githubTransport,
 * });
 * ```
 */
export const githubTransport: Transport<GitHubContext> = {
  send: async (ctx, text) => {
    logger.debug('[TRANSPORT] Creating comment', {
      owner: ctx.owner,
      repo: ctx.repo,
      issueNumber: ctx.issueNumber,
      textLength: text.length,
    });

    const octokit = new Octokit({ auth: ctx.githubToken });
    const result = await octokit.issues.createComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: ctx.issueNumber,
      body: text,
    });

    logger.debug('[TRANSPORT] Comment created', {
      owner: ctx.owner,
      repo: ctx.repo,
      issueNumber: ctx.issueNumber,
      commentId: result.data.id,
    });

    return result.data.id;
  },

  edit: async (ctx, ref, text) => {
    logger.debug('[TRANSPORT] Editing comment', {
      owner: ctx.owner,
      repo: ctx.repo,
      commentId: ref,
      textLength: text.length,
    });

    const octokit = new Octokit({ auth: ctx.githubToken });
    await octokit.issues.updateComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: ref as number,
      body: text,
    });

    logger.debug('[TRANSPORT] Comment edited', {
      owner: ctx.owner,
      repo: ctx.repo,
      commentId: ref,
    });
  },

  react: async (ctx, ref, emoji) => {
    logger.debug('[TRANSPORT] Adding reaction', {
      owner: ctx.owner,
      repo: ctx.repo,
      commentId: ref,
      emoji,
    });

    const octokit = new Octokit({ auth: ctx.githubToken });
    await octokit.reactions.createForIssueComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: ref as number,
      content: emoji as '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
    });
  },

  parseContext: (ctx) => {
    // Build context block to prepend to user message
    const contextType = ctx.isPullRequest ? 'PR' : 'Issue';
    const labelStr = ctx.labels.length > 0 ? `**Labels**: ${ctx.labels.join(', ')}\n` : '';

    const contextBlock = `**Context**: ${contextType} #${ctx.issueNumber} "${ctx.title}"
**URL**: ${ctx.url}
**State**: ${ctx.state}
${labelStr}
---

`;

    const result: ParsedInput = {
      text: contextBlock + ctx.body,
      userId: ctx.sender.id,
      chatId: `${ctx.owner}/${ctx.repo}#${ctx.issueNumber}`,
      metadata: {
        owner: ctx.owner,
        repo: ctx.repo,
        issueNumber: ctx.issueNumber,
        senderLogin: ctx.sender.login,
        startTime: ctx.startTime,
        url: ctx.url,
        title: ctx.title,
        isPullRequest: ctx.isPullRequest,
        state: ctx.state,
        labels: ctx.labels,
      },
    };
    // Only set messageRef if commentId exists
    if (ctx.commentId !== undefined) {
      result.messageRef = ctx.commentId;
    }
    return result;
  },
};

/**
 * Options for creating GitHubContext
 */
export interface CreateGitHubContextOptions {
  /** GitHub token for API calls */
  githubToken: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Issue or PR number */
  issueNumber: number;
  /** Message body (task/question) */
  body: string;
  /** User who triggered the action */
  sender: { id: number; login: string };
  /** Comment ID if replying to a comment */
  commentId?: number;
  /** Full URL to the issue or PR */
  url: string;
  /** Issue or PR title */
  title: string;
  /** Whether this is a pull request */
  isPullRequest: boolean;
  /** Issue or PR state */
  state: string;
  /** Labels on the issue or PR */
  labels: string[];
  /** Issue or PR description */
  description?: string;
}

/**
 * Create GitHubContext from webhook payload
 *
 * @param options - Context creation options
 */
export function createGitHubContext(options: CreateGitHubContextOptions): GitHubContext {
  const ctx: GitHubContext = {
    githubToken: options.githubToken,
    owner: options.owner,
    repo: options.repo,
    issueNumber: options.issueNumber,
    body: options.body,
    sender: options.sender,
    startTime: Date.now(),
    url: options.url,
    title: options.title,
    isPullRequest: options.isPullRequest,
    state: options.state,
    labels: options.labels,
  };
  // Only set optional properties if defined (exactOptionalPropertyTypes)
  if (options.commentId !== undefined) {
    ctx.commentId = options.commentId;
  }
  if (options.description !== undefined) {
    ctx.description = options.description;
  }
  return ctx;
}
