/**
 * GitHub Bot Entry Point
 *
 * Hono-based webhook server using Transport Layer pattern.
 * Simplified: Uses agent.handle() for clean separation of concerns.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createBaseApp } from '@duyetbot/hono-middleware';
import { getAgentByName } from 'agents';
import { type Env } from './agent.js';
import { logger } from './logger.js';
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

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Check if text contains bot mention
 */
function hasBotMention(text: string, botUsername: string): boolean {
  const mentionPattern = new RegExp(`@${botUsername}\\b`, 'i');
  return mentionPattern.test(text);
}

/**
 * Extract task from mention (text after @botname)
 */
function extractTask(text: string, botUsername: string): string {
  const mentionPattern = new RegExp(`@${botUsername}\\s*`, 'i');
  return text.replace(mentionPattern, '').trim();
}

// Create base app
const app = createBaseApp<Env>({
  name: 'github-bot',
  version: '2.0.0',
  logger: true,
  health: true,
  ignorePaths: ['/cdn-cgi/'],
});

// Webhook endpoint with Transport Layer pattern
app.post('/webhook', async (c) => {
  const env = c.env;
  const startTime = Date.now();
  const body = await c.req.text();

  // Generate request ID for trace correlation
  const requestId = crypto.randomUUID().slice(0, 8);

  // Verify signature
  const signature = c.req.header('x-hub-signature-256');
  if (signature && env.GITHUB_WEBHOOK_SECRET) {
    if (!verifySignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
      logger.warn(`[${requestId}] [WEBHOOK] Invalid signature`, {
        requestId,
        hasSignature: !!signature,
      });
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  // Parse event
  const event = c.req.header('x-github-event');
  const deliveryId = c.req.header('x-github-delivery');
  const payload = JSON.parse(body);
  const botUsername = env.BOT_USERNAME || 'duyetbot';

  const repo = payload.repository?.full_name || 'unknown';
  const action = payload.action || 'unknown';

  logger.info(`[${requestId}] [WEBHOOK] Received`, {
    requestId,
    deliveryId,
    event,
    action,
    repository: repo,
    sender: payload.sender?.login,
    issueNumber: payload.issue?.number || payload.pull_request?.number,
    commentId: payload.comment?.id,
  });

  try {
    // Handle issue_comment events with Transport Layer
    if (event === 'issue_comment' && action === 'created') {
      const comment = payload.comment;
      const issue = payload.issue;

      // Check for bot mention
      if (!hasBotMention(comment.body, botUsername)) {
        logger.debug(`[${requestId}] [WEBHOOK] No bot mention, skipping`, {
          requestId,
          repository: repo,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      // Extract task from mention
      const task = extractTask(comment.body, botUsername);
      if (!task) {
        logger.debug(`[${requestId}] [WEBHOOK] Empty task, skipping`, {
          requestId,
          repository: repo,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'empty_task' });
      }

      logger.info(`[${requestId}] [WEBHOOK] Processing issue_comment`, {
        requestId,
        repository: repo,
        issueNumber: issue.number,
        isPullRequest: !!issue.pull_request,
        task: task.substring(0, 100),
        sender: payload.sender?.login,
      });

      // Create transport context (serializable for DO RPC)
      const isPullRequest = !!issue.pull_request;
      const ctx = createGitHubContext({
        githubToken: env.GITHUB_TOKEN,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: issue.number,
        body: task,
        sender: payload.sender,
        commentId: comment.id,
        url: issue.html_url,
        title: issue.title,
        isPullRequest,
        state: issue.state,
        labels: (issue.labels || []).map((l: { name: string }) => l.name),
        description: issue.body,
      });

      // Get agent by name (issue-based session)
      const agentId = `github:${payload.repository.owner.login}/${payload.repository.name}#${issue.number}`;
      logger.info(`[${requestId}] [WEBHOOK] Creating agent`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      const agent = await getAgentByName(env.GitHubAgent, agentId);

      logger.info(`[${requestId}] [WEBHOOK] Triggering DO`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      // Fire-and-forget: DO runs independently
      // Don't await - return immediately to prevent GitHub webhook timeout
      agent.handle(ctx).catch((error: unknown) => {
        logger.error(`[${requestId}] [WEBHOOK] DO invocation failed`, {
          requestId,
          agentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      logger.info(`[${requestId}] [WEBHOOK] Returning OK`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });
      return c.json({ ok: true });
    }

    // Handle pull_request_review_comment events
    if (event === 'pull_request_review_comment' && action === 'created') {
      const comment = payload.comment;
      const pr = payload.pull_request;

      if (!hasBotMention(comment.body, botUsername)) {
        logger.debug(`[${requestId}] [WEBHOOK] No bot mention in PR review, skipping`, {
          requestId,
          repository: repo,
          prNumber: pr.number,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      const task = extractTask(comment.body, botUsername);
      if (!task) {
        logger.debug(`[${requestId}] [WEBHOOK] Empty task in PR review, skipping`, {
          requestId,
          repository: repo,
          prNumber: pr.number,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'empty_task' });
      }

      logger.info(`[${requestId}] [WEBHOOK] Processing PR review comment`, {
        requestId,
        repository: repo,
        prNumber: pr.number,
        task: task.substring(0, 100),
        sender: payload.sender?.login,
      });

      const ctx = createGitHubContext({
        githubToken: env.GITHUB_TOKEN,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: pr.number,
        body: task,
        sender: payload.sender,
        commentId: comment.id,
        url: pr.html_url,
        title: pr.title,
        isPullRequest: true,
        state: pr.state,
        labels: (pr.labels || []).map((l: { name: string }) => l.name),
        description: pr.body,
      });

      const agentId = `github:${payload.repository.owner.login}/${payload.repository.name}#${pr.number}`;
      logger.info(`[${requestId}] [WEBHOOK] Creating agent for PR review`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      const agent = await getAgentByName(env.GitHubAgent, agentId);

      logger.info(`[${requestId}] [WEBHOOK] Triggering DO for PR review`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      // Fire-and-forget: DO runs independently
      agent.handle(ctx).catch((error: unknown) => {
        logger.error(`[${requestId}] [WEBHOOK] DO invocation failed`, {
          requestId,
          agentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      logger.info(`[${requestId}] [WEBHOOK] Returning OK for PR review`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });
      return c.json({ ok: true });
    }

    // Handle issues with bot mention in body
    if (event === 'issues' && (action === 'opened' || action === 'edited')) {
      const issue = payload.issue;

      if (!hasBotMention(issue.body || '', botUsername)) {
        logger.debug(`[${requestId}] [WEBHOOK] No bot mention in issue body, skipping`, {
          requestId,
          repository: repo,
          issueNumber: issue.number,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      const task = extractTask(issue.body || '', botUsername);
      if (!task) {
        logger.debug(`[${requestId}] [WEBHOOK] Empty task in issue body, skipping`, {
          requestId,
          repository: repo,
          issueNumber: issue.number,
          durationMs: Date.now() - startTime,
        });
        return c.json({ ok: true, skipped: 'empty_task' });
      }

      logger.info(`[${requestId}] [WEBHOOK] Processing issue body mention`, {
        requestId,
        repository: repo,
        issueNumber: issue.number,
        task: task.substring(0, 100),
        sender: payload.sender?.login,
        action,
      });

      const ctx = createGitHubContext({
        githubToken: env.GITHUB_TOKEN,
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issueNumber: issue.number,
        body: task,
        sender: payload.sender,
        url: issue.html_url,
        title: issue.title,
        isPullRequest: false,
        state: issue.state,
        labels: (issue.labels || []).map((l: { name: string }) => l.name),
        description: issue.body,
      });

      const agentId = `github:${payload.repository.owner.login}/${payload.repository.name}#${issue.number}`;
      logger.info(`[${requestId}] [WEBHOOK] Creating agent for issue`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      const agent = await getAgentByName(env.GitHubAgent, agentId);

      logger.info(`[${requestId}] [WEBHOOK] Triggering DO for issue`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

      // Fire-and-forget: DO runs independently
      agent.handle(ctx).catch((error: unknown) => {
        logger.error(`[${requestId}] [WEBHOOK] DO invocation failed`, {
          requestId,
          agentId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });

      logger.info(`[${requestId}] [WEBHOOK] Returning OK for issue`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });
      return c.json({ ok: true });
    }

    // Handle ping
    if (event === 'ping') {
      logger.info(`[${requestId}] [WEBHOOK] Ping received`, {
        requestId,
        repository: repo,
        durationMs: Date.now() - startTime,
      });
      return c.json({ ok: true, event: 'ping' });
    }

    // Other events - log and skip
    logger.debug(`[${requestId}] [WEBHOOK] Unhandled event`, {
      requestId,
      event,
      action,
      repository: repo,
      durationMs: Date.now() - startTime,
    });
    return c.json({ ok: true, skipped: 'unhandled_event' });
  } catch (error) {
    logger.error(`[${requestId}] [WEBHOOK] Error`, {
      requestId,
      event,
      repository: repo,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      durationMs: Date.now() - startTime,
    });
    return c.json({ error: 'Internal error' }, 500);
  }
});

// Cloudflare Workers export - uses Transport Layer pattern
export default app;
