/**
 * GitHub Bot Entry Point
 *
 * Hono-based webhook server using Transport Layer pattern.
 * Uses middleware chain for signature verification, parsing, and mention detection.
 * Uses fire-and-forget pattern with ChatAgent for async message processing.
 */

import { createBaseApp } from '@duyetbot/hono-middleware';
import {
  EventCollector,
  type ObservabilityEnv,
  ObservabilityStorage,
} from '@duyetbot/observability';
import { Octokit } from '@octokit/rest';

import { type Env } from './agent.js';
import { fetchIssueContext, fetchPRContext } from './github-api.js';
import { logger } from './logger.js';
import {
  createGitHubMentionMiddleware,
  createGitHubParserMiddleware,
  createGitHubSignatureMiddleware,
} from './middlewares/index.js';
import { createGitHubContext, githubTransport } from './transport.js';

export type { Env, GitHubAgentInstance } from './agent.js';
// Local Durable Object export
// Shared DOs (RouterAgent, SimpleAgent, etc.) are referenced from duyetbot-shared-agents via script_name
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

// Extend Env to include observability bindings
type EnvWithObservability = Env & ObservabilityEnv;

// Create base app
const app = createBaseApp<EnvWithObservability>({
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
    const env = c.env;

    // Generate request ID for trace correlation
    const requestId = crypto.randomUUID().slice(0, 8);

    // Initialize observability collector
    let collector: EventCollector | null = null;
    let storage: ObservabilityStorage | null = null;

    if (env.OBSERVABILITY_DB) {
      storage = new ObservabilityStorage(env.OBSERVABILITY_DB);
      collector = new EventCollector({
        eventId: crypto.randomUUID(),
        appSource: 'github-webhook',
        eventType: 'mention',
        triggeredAt: startTime,
        requestId,
      });
      collector.markProcessing();
    }

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

    const { event, action, owner, repo, sender, issue, comment, isPullRequest } = webhookCtx;

    // Set observability context
    if (collector) {
      collector.setContext({
        userId: String(sender.id),
        username: sender.login,
        chatId: `${owner}/${repo}#${issue?.number ?? 'unknown'}`,
      });
      collector.setInput(task);
    }

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

      // Add PR-specific metadata from webhook context
      if (webhookCtx.additions !== undefined) {
        contextOptions.additions = webhookCtx.additions;
      }
      if (webhookCtx.deletions !== undefined) {
        contextOptions.deletions = webhookCtx.deletions;
      }
      if (webhookCtx.commits !== undefined) {
        contextOptions.commits = webhookCtx.commits;
      }
      if (webhookCtx.changedFiles !== undefined) {
        contextOptions.changedFiles = webhookCtx.changedFiles;
      }
      if (webhookCtx.headRef !== undefined) {
        contextOptions.headRef = webhookCtx.headRef;
      }
      if (webhookCtx.baseRef !== undefined) {
        contextOptions.baseRef = webhookCtx.baseRef;
      }

      // Fetch context enrichment (comments history and PR diff)
      const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
      try {
        logger.debug(`[${requestId}] [WEBHOOK] Fetching context enrichment`, {
          requestId,
          isPullRequest,
          issueNumber: issue.number,
        });

        if (isPullRequest) {
          // Fetch both comments and diff for PRs
          const { commentsThread, diffSnippets } = await fetchPRContext(octokit, {
            owner,
            repo,
            pullNumber: issue.number,
            commentLimit: 5,
          });
          if (commentsThread) {
            contextOptions.commentsThread = commentsThread;
          }
          if (diffSnippets) {
            contextOptions.diffSnippets = diffSnippets;
          }
        } else {
          // Fetch only comments for issues
          const { commentsThread } = await fetchIssueContext(octokit, {
            owner,
            repo,
            issueNumber: issue.number,
            commentLimit: 5,
          });
          if (commentsThread) {
            contextOptions.commentsThread = commentsThread;
          }
        }

        logger.debug(`[${requestId}] [WEBHOOK] Context enrichment complete`, {
          requestId,
          hasComments: !!contextOptions.commentsThread,
          hasDiff: !!contextOptions.diffSnippets,
          durationMs: Date.now() - startTime,
        });
      } catch (enrichError) {
        // Log but don't fail - enrichment is optional
        logger.warn(`[${requestId}] [WEBHOOK] Context enrichment failed`, {
          requestId,
          error: enrichError instanceof Error ? enrichError.message : String(enrichError),
        });
      }

      // Create GitHub context for transport layer
      const githubContext = createGitHubContext(contextOptions);

      // Parse context to ParsedInput using transport's parseContext
      const parsedInput = githubTransport.parseContext(githubContext);

      // Get agent instance (issue-based session)
      const agentId = `github:${owner}/${repo}#${issue.number}`;
      logger.info(`[${requestId}] [WEBHOOK] Getting agent instance`, {
        requestId,
        agentId,
        isPullRequest,
        durationMs: Date.now() - startTime,
      });

      const agent = env.GitHubAgent.get(env.GitHubAgent.idFromName(agentId)) as unknown as {
        receiveMessage(input: typeof parsedInput): Promise<{ traceId: string }>;
      };

      // True fire-and-forget: schedule RPC without awaiting
      // waitUntil keeps worker alive for the RPC, but we return immediately
      c.executionCtx.waitUntil(
        (async () => {
          try {
            const result = await agent.receiveMessage(parsedInput);
            logger.info(`[${requestId}] [WEBHOOK] Message queued`, {
              requestId,
              agentId,
              traceId: result.traceId,
              durationMs: Date.now() - startTime,
            });
          } catch (error) {
            // RPC failure only (rare) - DO is unreachable
            logger.error(`[${requestId}] [WEBHOOK] RPC to ChatAgent failed`, {
              requestId,
              agentId,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // Write observability event (fire-and-forget)
          if (collector && storage) {
            collector.complete({ status: 'success' });
            storage.writeEvent(collector.toEvent()).catch((err) => {
              logger.error(`[${requestId}] [OBSERVABILITY] Failed to write event`, {
                requestId,
                error: err instanceof Error ? err.message : String(err),
              });
            });
          }
        })()
      );

      logger.info(`[${requestId}] [WEBHOOK] Returning OK immediately`, {
        requestId,
        agentId,
        durationMs: Date.now() - startTime,
      });

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

      // Complete observability event on error
      if (collector) {
        collector.complete({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }

      // Write observability event to D1 (fire-and-forget)
      if (collector && storage) {
        storage.writeEvent(collector.toEvent()).catch((err) => {
          logger.error(`[${requestId}] [OBSERVABILITY] Failed to write event`, {
            requestId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      return c.json({ error: 'Internal error' }, 500);
    }
  }
);

// Cloudflare Workers export - uses Transport Layer pattern
export default app;
