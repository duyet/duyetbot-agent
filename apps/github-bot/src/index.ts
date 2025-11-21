/**
 * GitHub Bot Entry Point
 *
 * Hono-based webhook server for @duyetbot
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { Octokit } from '@octokit/rest';
import { Hono } from 'hono';
import { handleMention } from './agent-handler.js';
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
export { handleIssueComment, handlePRReviewComment } from './webhooks/mention.js';
export { handleIssueEvent } from './webhooks/issues.js';
export type { IssueEvent, IssueHandlerConfig } from './webhooks/issues.js';
export { handlePullRequestEvent } from './webhooks/pull-request.js';
export type { PullRequestEvent, PullRequestHandlerConfig } from './webhooks/pull-request.js';
export { buildSystemPrompt, createGitHubTool, handleMention } from './agent-handler.js';
export { loadTemplate, renderTemplate, loadAndRenderTemplate } from './template-loader.js';
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
          console.log('Received ping from GitHub');
          break;

        default:
          console.log(`Unhandled event: ${event}`);
      }

      return c.json({ ok: true });
    } catch (error) {
      console.error('Error handling webhook:', error);
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

// Export for direct Node.js usage
export default createGitHubBot;
