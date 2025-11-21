/**
 * Agent Handler
 *
 * Creates and executes agent for GitHub bot tasks
 */

import { Octokit } from '@octokit/rest';
import { loadAndRenderTemplate } from './template-loader.js';
import { createMCPClient, GitHubSessionManager } from './session-manager.js';
import type { BotConfig, MentionContext } from './types.js';

/**
 * Build system prompt for GitHub context
 */
export function buildSystemPrompt(context: MentionContext): string {
  // Prepare template context with pre-computed values
  const templateContext: Record<string, unknown> = {
    repository: context.repository,
    task: context.task,
    mentionedBy: context.mentionedBy,
  };

  // Add pull request context if present
  if (context.pullRequest) {
    templateContext.pullRequest = context.pullRequest;
  }

  // Add issue context if present (and no PR, since PR takes precedence in template)
  if (context.issue && !context.pullRequest) {
    templateContext.issue = {
      ...context.issue,
      // Pre-compute labels string for template
      labelsString: context.issue.labels.map((l) => l.name).join(', '),
    };
  }

  return loadAndRenderTemplate('system-prompt.txt', templateContext);
}

/**
 * Create GitHub tool for agent
 */
export function createGitHubTool(octokit: Octokit, repo: { owner: string; name: string }) {
  return {
    name: 'github',
    description: 'Interact with GitHub API',
    execute: async (action: string, params: Record<string, unknown>): Promise<unknown> => {
      switch (action) {
        case 'get_pr': {
          const { data } = await octokit.pulls.get({
            owner: repo.owner,
            repo: repo.name,
            pull_number: params.number as number,
          });
          return {
            title: data.title,
            body: data.body,
            state: data.state,
            files_changed: data.changed_files,
            additions: data.additions,
            deletions: data.deletions,
          };
        }

        case 'get_diff': {
          const { data } = await octokit.pulls.get({
            owner: repo.owner,
            repo: repo.name,
            pull_number: params.number as number,
            mediaType: { format: 'diff' },
          });
          return data;
        }

        case 'get_files': {
          const { data } = await octokit.pulls.listFiles({
            owner: repo.owner,
            repo: repo.name,
            pull_number: params.number as number,
          });
          return data.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
          }));
        }

        case 'get_issue': {
          const { data } = await octokit.issues.get({
            owner: repo.owner,
            repo: repo.name,
            issue_number: params.number as number,
          });
          return {
            title: data.title,
            body: data.body,
            state: data.state,
            labels: data.labels,
          };
        }

        case 'add_labels': {
          await octokit.issues.addLabels({
            owner: repo.owner,
            repo: repo.name,
            issue_number: params.issue_number as number,
            labels: params.labels as string[],
          });
          return { success: true };
        }

        case 'create_review': {
          await octokit.pulls.createReview({
            owner: repo.owner,
            repo: repo.name,
            pull_number: params.number as number,
            body: params.body as string,
            event: (params.event as 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT') || 'COMMENT',
          });
          return { success: true };
        }

        default:
          throw new Error(`Unknown GitHub action: ${action}`);
      }
    },
  };
}

/**
 * Handle mention and generate response
 */
export async function handleMention(context: MentionContext, config: BotConfig): Promise<string> {
  const octokit = new Octokit({ auth: config.githubToken });
  const systemPrompt = buildSystemPrompt(context);

  // Initialize session manager with MCP client if configured
  let sessionManager: GitHubSessionManager;
  if (config.mcpServerUrl) {
    const mcpClient = createMCPClient(config.mcpServerUrl, config.mcpAuthToken);
    sessionManager = new GitHubSessionManager(mcpClient);
  } else {
    sessionManager = new GitHubSessionManager();
  }

  // Get or create session based on context
  let session;
  if (context.pullRequest) {
    session = await sessionManager.getPRSession(
      context.repository,
      context.pullRequest.number,
      context.pullRequest.title
    );
  } else if (context.issue) {
    session = await sessionManager.getIssueSession(
      context.repository,
      context.issue.number,
      context.issue.title
    );
  } else {
    // Fallback for unknown context
    session = {
      sessionId: `github:${context.repository.full_name}:unknown:${Date.now()}`,
      messages: [],
      metadata: {
        type: 'issue' as const,
        repository: {
          owner: context.repository.owner.login,
          name: context.repository.name,
          fullName: context.repository.full_name,
        },
        number: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  }

  // Add the user's message to the session
  await sessionManager.appendMessage(session.sessionId, 'user', context.task);

  // Create the GitHub tool for this context
  const githubTool = createGitHubTool(octokit, {
    owner: context.repository.owner.login,
    name: context.repository.name,
  });

  // TODO: Integrate with @duyetbot/core agent for actual execution
  // For now, return a placeholder response with session info
  const response = `I received your request: "${context.task}"

**Context:**
- Repository: ${context.repository.full_name}
- Session: \`${session.sessionId}\`
- Message history: ${session.messages.length} previous messages
${context.pullRequest ? `- PR #${context.pullRequest.number}: ${context.pullRequest.title}` : ''}
${context.issue && !context.pullRequest ? `- Issue #${context.issue.number}: ${context.issue.title}` : ''}

**System Prompt Preview:**
\`\`\`
${systemPrompt.slice(0, 200)}...
\`\`\`

**Available GitHub Actions:**
${['get_pr', 'get_issue', 'create_comment', 'get_diff', 'get_files', 'add_labels', 'create_review'].map(a => `- \`${a}\``).join('\n')}

I'm processing your request. Full agent integration is in progress.

---
*Powered by @duyetbot • Tool: ${githubTool.name}*`;

  // Save assistant response to session
  await sessionManager.appendMessage(session.sessionId, 'assistant', response);

  return response;
}
