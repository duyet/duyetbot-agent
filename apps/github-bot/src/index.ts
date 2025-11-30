/**
 * GitHub Bot Entry Point
 *
 * Hono-based webhook server using Transport Layer pattern.
 * Uses middleware chain for signature verification, parsing, and mention detection.
 * Uses alarm-based batch processing for reliable message handling.
 */

import { getChatAgent } from '@duyetbot/chat-agent';
import { createBaseApp } from '@duyetbot/hono-middleware';

import { type Env } from './agent.js';
import { logger } from './logger.js';
import {
  createGitHubMentionMiddleware,
  createGitHubParserMiddleware,
  createGitHubSignatureMiddleware,
} from './middlewares/index.js';
import { createGitHubContext } from './transport.js';

export type { Env, GitHubAgentInstance } from './agent.js';
// Local Durable Object export
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-agents via script_name
export { GitHubAgent } from './agent.js';
// Utility exports
export {
  extractAllMentions,
  hasMention,
  isCommand,
  parseCommand,
  parseMention,
} from './mention-parser.js';
// Type exports
export type {
  GitHubComment,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
  GitHubUser,
} from './types.js';

// Create base app
const app = createBaseApp<Env>({
  name: 'github-bot',
  version: '2.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

/**
 * Webhook endpoint with middleware chain and Transport Layer pattern
 *
 * Middleware chain:
 * 1. Signature middleware - verifies HMAC-SHA256 signature
 * 2. Parser middleware - parses payload and extracts context
 * 3. Mention middleware - detects @bot mentions and extracts task
 */
app.post(
  '/webhook',
  createGitHubSignatureMiddleware(),
  createGitHubParserMiddleware(),
  createGitHubMentionMiddleware(),
  async (c) => {
    const startTime = Date.now();

    // Check if processing should be skipped (no mention, unhandled event, etc.)
    if (c.get('skipProcessing')) {
      const ctx = c.get('webhookContext');

      // Handle ping event specially
      if (ctx?.event === 'ping') {
        return c.json({ ok: true, event: 'ping' });
      }

      return c.json({ ok: true, skipped: true });
    }

    // Get context, payload, and task from middleware
    const webhookCtx = c.get('webhookContext')!;
    const payload = c.get('payload')!;
    const task = c.get('task')!;
    const env = c.env;

    const { requestId, event, action, owner, repo, sender, issue, comment, isPullRequest } =
      webhookCtx;

    logger.info(`[${requestId}] [WEBHOOK] Processing`, {
      requestId,
      event,
      action,
      repository: `${owner}/${repo}`,
      sender: sender.login,
      issueNumber: issue?.number,
      taskLength: task.length,
      taskPreview: task.substring(0, 100),
    });

    try {
      // Get full issue/PR from payload for additional data (url, labels)
      const payloadIssue = payload.issue;
      const payloadPr = payload.pull_request;
      const fullIssueOrPr = payloadIssue || payloadPr;

      if (!issue || !fullIssueOrPr) {
        logger.warn(`[${requestId}] [WEBHOOK] No issue or PR in context`, {
          requestId,
          event,
          action,
        });
        return c.json({ ok: true, skipped: 'no_issue_or_pr' });
      }

      // Create transport context options
      const contextOptions: Parameters<typeof createGitHubContext>[0] = {
        githubToken: env.GITHUB_TOKEN,
        owner,
        repo,
        issueNumber: issue.number,
        body: task,
        sender: {
          id: sender.id,
          login: sender.login,
        },
        url: fullIssueOrPr.html_url,
        title: issue.title,
        isPullRequest,
        state: issue.state,
        labels: (fullIssueOrPr.labels || []).map((l: { name: string }) => l.name),
      };

      // Only set optional properties if defined (exactOptionalPropertyTypes)
      if (comment?.id !== undefined) {
        contextOptions.commentId = comment.id;
      }
      if (issue.body) {
        contextOptions.description = issue.body;
      }
      if (requestId !== undefined) {
        contextOptions.requestId = requestId;
      }
      if (env.GITHUB_ADMIN) {
        contextOptions.adminUsername = env.GITHUB_ADMIN;
      }

      const ctx = createGitHubContext(contextOptions);

      // Get agent by name (issue-based session)
      const agentId = `github:${owner}/${repo}#${issue.number}`;
      logger.info(`[${requestId}] [WEBHOOK] Creating agent`, {
        requestId,
        agentId,
        isPullRequest,
        durationMs: Date.now() - startTime,
      });

      const agent = getChatAgent(env.GitHubAgent, agentId);

      logger.info(`[${requestId}] [WEBHOOK] Queueing message for batch processing`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      // Queue message - alarm will fire after batch window (200ms by default for GitHub)
      try {
        const { queued, batchId } = await agent.queueMessage(ctx);
        logger.info(`[${requestId}] [WEBHOOK] Message queued`, {
          requestId,
          agentId,
          queued,
          batchId,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        logger.error(`[${requestId}] [WEBHOOK] Failed to queue message`, {
          requestId,
          agentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          durationMs: Date.now() - startTime,
        });
      }

      return c.json({ ok: true });
    } catch (error) {
      logger.error(`[${requestId}] [WEBHOOK] Error`, {
        requestId,
        event,
        repository: `${owner}/${repo}`,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
      return c.json({ error: 'Internal error' }, 500);
    }
  }
);

// Cloudflare Workers export - uses Transport Layer pattern
export default app;
