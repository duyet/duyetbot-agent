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
  const body = await c.req.text();

  // Verify signature
  const signature = c.req.header('x-hub-signature-256');
  if (signature && env.GITHUB_WEBHOOK_SECRET) {
    if (!verifySignature(body, signature, env.GITHUB_WEBHOOK_SECRET)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
  }

  // Parse event
  const event = c.req.header('x-github-event');
  const payload = JSON.parse(body);
  const botUsername = env.BOT_USERNAME || 'duyetbot';

  const repo = payload.repository?.full_name || 'unknown';
  const action = payload.action || 'unknown';

  logger.info('[WEBHOOK] Received', {
    event,
    action,
    repository: repo,
    sender: payload.sender?.login,
  });

  try {
    // Handle issue_comment events with Transport Layer
    if (event === 'issue_comment' && action === 'created') {
      const comment = payload.comment;
      const issue = payload.issue;

      // Check for bot mention
      if (!hasBotMention(comment.body, botUsername)) {
        logger.debug('[WEBHOOK] No bot mention, skipping', {
          repository: repo,
        });
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      // Extract task from mention
      const task = extractTask(comment.body, botUsername);
      if (!task) {
        logger.debug('[WEBHOOK] Empty task, skipping', { repository: repo });
        return c.json({ ok: true, skipped: 'empty_task' });
      }

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
      logger.info('[WEBHOOK] Getting agent', { agentId });

      const agent = await getAgentByName(env.GitHubAgent, agentId);

      // Agent handles everything: parsing, LLM call, sending response
      await agent.handle(ctx);

      logger.info('[WEBHOOK] Processed', { event, repository: repo, agentId });
      return c.json({ ok: true });
    }

    // Handle pull_request_review_comment events
    if (event === 'pull_request_review_comment' && action === 'created') {
      const comment = payload.comment;
      const pr = payload.pull_request;

      if (!hasBotMention(comment.body, botUsername)) {
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      const task = extractTask(comment.body, botUsername);
      if (!task) {
        return c.json({ ok: true, skipped: 'empty_task' });
      }

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
      const agent = await getAgentByName(env.GitHubAgent, agentId);
      await agent.handle(ctx);

      return c.json({ ok: true });
    }

    // Handle issues with bot mention in body
    if (event === 'issues' && (action === 'opened' || action === 'edited')) {
      const issue = payload.issue;

      if (!hasBotMention(issue.body || '', botUsername)) {
        return c.json({ ok: true, skipped: 'no_mention' });
      }

      const task = extractTask(issue.body || '', botUsername);
      if (!task) {
        return c.json({ ok: true, skipped: 'empty_task' });
      }

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
      const agent = await getAgentByName(env.GitHubAgent, agentId);
      await agent.handle(ctx);

      return c.json({ ok: true });
    }

    // Handle ping
    if (event === 'ping') {
      logger.info('[WEBHOOK] Ping received', { repository: repo });
      return c.json({ ok: true, event: 'ping' });
    }

    // Other events - log and skip
    logger.debug('[WEBHOOK] Unhandled event', {
      event,
      action,
      repository: repo,
    });
    return c.json({ ok: true, skipped: 'unhandled_event' });
  } catch (error) {
    logger.error('[WEBHOOK] Error', {
      event,
      repository: repo,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return c.json({ error: 'Internal error' }, 500);
  }
});

// Cloudflare Workers export - uses Transport Layer pattern
export default app;
