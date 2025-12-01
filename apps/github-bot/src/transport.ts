/**
 * GitHub Transport Layer
 *
 * Implements the Transport interface for GitHub Issues/PRs API.
 */

import type { DebugContext, ParsedInput, Transport } from '@duyetbot/chat-agent';
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
  /** Request ID for trace correlation and deduplication */
  requestId?: string;
  /** Admin username for debug footer visibility */
  adminUsername?: string;
  /** Whether current user is admin (computed from sender.login === adminUsername) */
  isAdmin?: boolean;
  /** Debug context for admin users (routing flow, timing, classification) */
  debugContext?: DebugContext;
  // PR-specific metadata
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
  // Context enrichment (fetched from API)
  /** Formatted previous comments thread */
  commentsThread?: string;
  /** Relevant diff snippets for PRs */
  diffSnippets?: string;
}

/**
 * GitHub transport implementation
 *
 * @example
 * ```typescript
 * const GitHubAgent = createCloudflareChatAgent({
 *   createProvider: (env) => createOpenRouterProvider(env),
 *   systemPrompt: getGitHubBotPrompt(),
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
    const contextType = ctx.isPullRequest ? 'PR' : 'Issue';

    // Build XML-structured context block (following Claude on GitHub pattern)
    const formattedContextLines = [
      '<formatted_context>',
      `${contextType} Title: ${ctx.title}`,
      `${contextType} Author: ${ctx.sender.login}`,
    ];

    // Add PR-specific metadata
    if (ctx.isPullRequest) {
      if (ctx.headRef && ctx.baseRef) {
        formattedContextLines.push(`PR Branch: ${ctx.headRef} -> ${ctx.baseRef}`);
      }
    }

    formattedContextLines.push(`${contextType} State: ${ctx.state.toUpperCase()}`);

    if (ctx.isPullRequest) {
      if (ctx.additions !== undefined) {
        formattedContextLines.push(`PR Additions: ${ctx.additions}`);
      }
      if (ctx.deletions !== undefined) {
        formattedContextLines.push(`PR Deletions: ${ctx.deletions}`);
      }
      if (ctx.commits !== undefined) {
        formattedContextLines.push(`Total Commits: ${ctx.commits}`);
      }
      if (ctx.changedFiles !== undefined) {
        formattedContextLines.push(`Changed Files: ${ctx.changedFiles} files`);
      }
    }

    if (ctx.labels.length > 0) {
      formattedContextLines.push(`Labels: ${ctx.labels.join(', ')}`);
    }

    formattedContextLines.push('</formatted_context>');

    const formattedContext = formattedContextLines.join('\n');

    // PR/Issue body section
    const bodySection = `<pr_or_issue_body>
${ctx.description || 'No description provided.'}
</pr_or_issue_body>`;

    // Comments thread section
    const commentsSection = `<comments>
${ctx.commentsThread || 'No previous comments.'}
</comments>`;

    // Diff snippets section (only for PRs with diff data)
    const diffSection =
      ctx.isPullRequest && ctx.diffSnippets
        ? `<diff_snippets>
${ctx.diffSnippets}
</diff_snippets>`
        : '';

    // Combine all sections
    const contextBlockParts = [formattedContext, bodySection, commentsSection];
    if (diffSection) {
      contextBlockParts.push(diffSection);
    }
    const contextBlock = contextBlockParts.join('\n\n');

    // Strip bot mention from body to avoid misclassification
    const cleanedBody = stripBotMention(ctx.body);

    const result: ParsedInput = {
      text: `${contextBlock}\n\n---\n\n${cleanedBody}`,
      userId: ctx.sender.id,
      chatId: `${ctx.owner}/${ctx.repo}#${ctx.issueNumber}`,
      username: ctx.sender.login,
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
        requestId: ctx.requestId,
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
  /** Request ID for trace correlation */
  requestId?: string;
  /** Admin username for debug footer visibility */
  adminUsername?: string;
  // PR-specific metadata
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
  // Context enrichment (fetched from API)
  /** Formatted previous comments thread */
  commentsThread?: string;
  /** Relevant diff snippets for PRs */
  diffSnippets?: string;
}

/**
 * Normalize username by removing leading @ if present
 */
function normalizeUsername(username: string): string {
  return username.startsWith('@') ? username.slice(1) : username;
}

/**
 * Strip bot mention from message body
 *
 * This prevents the bot name (e.g., "@duyetbot") from interfering with
 * query classification. For example, "@duyetbot Latest AI News?" should
 * be classified as "research" not "duyet" since "duyet" in "@duyetbot"
 * is just the bot mention, not a query about Duyet the person.
 *
 * Handles variations:
 * - @duyetbot (standard)
 * - @duyetbot[bot] (GitHub Apps format)
 * - Multiple mentions
 */
function stripBotMention(body: string): string {
  // Remove @duyetbot or @duyetbot[bot] mentions with optional trailing whitespace
  return body.replace(/@duyetbot(\[bot\])?\s*/gi, '').trim();
}

/**
 * Create GitHubContext from webhook payload
 *
 * @param options - Context creation options
 */
export function createGitHubContext(options: CreateGitHubContextOptions): GitHubContext {
  // Compute isAdmin from sender.login and adminUsername
  const isAdmin =
    options.adminUsername !== undefined &&
    normalizeUsername(options.sender.login) === normalizeUsername(options.adminUsername);

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
    isAdmin,
  };
  // Only set optional properties if defined (exactOptionalPropertyTypes)
  if (options.commentId !== undefined) {
    ctx.commentId = options.commentId;
  }
  if (options.description !== undefined) {
    ctx.description = options.description;
  }
  if (options.requestId !== undefined) {
    ctx.requestId = options.requestId;
  }
  if (options.adminUsername !== undefined) {
    ctx.adminUsername = options.adminUsername;
  }
  // PR-specific metadata
  if (options.additions !== undefined) {
    ctx.additions = options.additions;
  }
  if (options.deletions !== undefined) {
    ctx.deletions = options.deletions;
  }
  if (options.commits !== undefined) {
    ctx.commits = options.commits;
  }
  if (options.changedFiles !== undefined) {
    ctx.changedFiles = options.changedFiles;
  }
  if (options.headRef !== undefined) {
    ctx.headRef = options.headRef;
  }
  if (options.baseRef !== undefined) {
    ctx.baseRef = options.baseRef;
  }
  // Context enrichment
  if (options.commentsThread !== undefined) {
    ctx.commentsThread = options.commentsThread;
  }
  if (options.diffSnippets !== undefined) {
    ctx.diffSnippets = options.diffSnippets;
  }
  return ctx;
}
