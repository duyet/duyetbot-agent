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
    const result: ParsedInput = {
      text: ctx.body,
      userId: ctx.sender.id,
      chatId: `${ctx.owner}/${ctx.repo}#${ctx.issueNumber}`,
      metadata: {
        owner: ctx.owner,
        repo: ctx.repo,
        issueNumber: ctx.issueNumber,
        senderLogin: ctx.sender.login,
        startTime: ctx.startTime,
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
 * Create GitHubContext from webhook payload
 *
 * @param githubToken - GitHub token for API calls
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param issueNumber - Issue or PR number
 * @param body - Message body
 * @param sender - User who triggered the action
 * @param commentId - Comment ID if replying to a comment
 */
export function createGitHubContext(
  githubToken: string,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
  sender: { id: number; login: string },
  commentId?: number
): GitHubContext {
  const ctx: GitHubContext = {
    githubToken,
    owner,
    repo,
    issueNumber,
    body,
    sender,
    startTime: Date.now(),
  };
  // Only set commentId if it's defined
  if (commentId !== undefined) {
    ctx.commentId = commentId;
  }
  return ctx;
}
