/**
 * GitHub Bot Entry Point
 *
 * Hono-based webhook server for @duyetbot
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { handleMention } from './agent-handler.js';
import type { Env } from './agent.js';
import { logger } from './logger.js';
import type { BotConfig, MentionContext } from './types.js';
import { handleIssueEvent } from './webhooks/issues.js';
import type { IssueEvent, IssueHandlerConfig } from './webhooks/issues.js';
import { handleIssueComment, handlePRReviewComment } from './webhooks/mention.js';
import type { IssueCommentEvent, PRReviewCommentEvent } from './webhooks/mention.js';
import { handlePullRequestEvent } from './webhooks/pull-request.js';
import type { PullRequestEvent, PullRequestHandlerConfig } from './webhooks/pull-request.js';

export {
  parseMention,
  hasMention,
  extractAllMentions,
  isCommand,
  parseCommand,
} from './mention-parser.js';
export {
  handleIssueComment,
  handlePRReviewComment,
} from './webhooks/mention.js';
export { handleIssueEvent } from './webhooks/issues.js';
export type { IssueEvent, IssueHandlerConfig } from './webhooks/issues.js';
export { handlePullRequestEvent } from './webhooks/pull-request.js';
export type {
  PullRequestEvent,
  PullRequestHandlerConfig,
} from './webhooks/pull-request.js';
export { buildSystemPrompt, handleMention } from './agent-handler.js';
export {
  loadTemplate,
  renderTemplate,
  loadAndRenderTemplate,
} from './template-loader.js';
export {
  GitHubSessionManager,
  createMCPClient,
  createIssueSessionId,
  createPRSessionId,
  createDiscussionSessionId,
  parseSessionId,
} from './session-manager.js';
export type {
  GitHubSessionType,
  GitHubSessionMetadata,
  MCPMemoryClient,
} from './session-manager.js';
export type {
  BotConfig,
  MentionContext,
  GitHubRepository,
  GitHubIssue,
  GitHubPullRequest,
  GitHubComment,
  GitHubUser,
} from './types.js';

// Cloudflare Durable Object exports
export { GitHubAgent } from './agent.js';
export type { Env, GitHubAgentInstance } from './agent.js';

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Create GitHub bot server
 */
export function createGitHubBot(config: BotConfig) {
  const app = new Hono();
  const octokit = new Octokit({ auth: config.githubToken });

  // Add Hono logger middleware
  app.use('*', honoLogger());

  // Health check
  app.get('/health', (c) => {
    return c.json({ status: 'ok', bot: config.botUsername });
  });

  // Webhook endpoint
  app.post('/webhook', async (c) => {
    const body = await c.req.text();

    // Verify signature
    const signature = c.req.header('x-hub-signature-256');
    if (signature && config.webhookSecret) {
      if (!verifySignature(body, signature, config.webhookSecret)) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    // Parse event
    const event = c.req.header('x-github-event');
    const payload = JSON.parse(body);

    // Handler function for mentions
    const onMention = async (context: MentionContext): Promise<string> => {
      return handleMention(context, config);
    };

    const repo = payload.repository?.full_name || 'unknown';
    const action = payload.action || 'unknown';

    logger.info('Webhook received', {
      event,
      action,
      repository: repo,
      sender: payload.sender?.login,
    });

    try {
      switch (event) {
        case 'issue_comment':
          await handleIssueComment(
            payload as IssueCommentEvent,
            octokit,
            config.botUsername,
            onMention
          );
          break;

        case 'pull_request_review_comment':
          await handlePRReviewComment(
            payload as PRReviewCommentEvent,
            octokit,
            config.botUsername,
            onMention
          );
          break;

        case 'issues':
          await handleIssueEvent(
            payload as IssueEvent,
            octokit,
            config.botUsername,
            onMention,
            config.issueHandlerConfig
          );
          break;

        case 'pull_request':
          await handlePullRequestEvent(
            payload as PullRequestEvent,
            octokit,
            config.botUsername,
            onMention,
            config.pullRequestHandlerConfig
          );
          break;

        case 'ping':
          logger.info('Ping received', { repository: repo });
          break;

        default:
          logger.warn('Unhandled event', { event, repository: repo });
      }

      logger.info('Webhook processed', { event, repository: repo });
      return c.json({ ok: true });
    } catch (error) {
      logger.error('Webhook error', {
        event,
        repository: repo,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  return app;
}

/**
 * Start the bot server
 */
export async function startBot(config: BotConfig, port = 3001): Promise<void> {
  const _app = createGitHubBot(config);

  console.log(`Starting @${config.botUsername} bot on port ${port}`);

  // Note: Actual server start depends on runtime (Node.js vs Bun)
  // This is just the app configuration
  return new Promise(() => {
    // Keep running
  });
}

// Cloudflare Workers export
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const config: BotConfig = {
      botUsername: env.BOT_USERNAME || 'duyetbot',
      githubToken: env.GITHUB_TOKEN,
      webhookSecret: env.GITHUB_WEBHOOK_SECRET || '',
      // Pass full env for AI Gateway
      AI: env.AI,
      AI_GATEWAY_NAME: env.AI_GATEWAY_NAME,
      AI_GATEWAY_PROVIDER: env.AI_GATEWAY_PROVIDER,
      AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
      model: env.MODEL,
    };

    const app = createGitHubBot(config);
    return app.fetch(request, env);
  },
};
