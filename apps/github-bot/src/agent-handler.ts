/**
 * Agent Handler
 *
 * Creates and executes agent for GitHub bot tasks
 */

import { Octokit } from '@octokit/rest';
import type { MentionContext, BotConfig } from './types.js';

/**
 * Build system prompt for GitHub context
 */
export function buildSystemPrompt(context: MentionContext): string {
  const parts: string[] = [];

  parts.push(`You are @duyetbot, an AI assistant helping with GitHub tasks.`);
  parts.push('');

  // Repository context
  parts.push(`## Repository`);
  parts.push(`- Name: ${context.repository.full_name}`);
  parts.push('');

  // Issue/PR context
  if (context.pullRequest) {
    parts.push(`## Pull Request #${context.pullRequest.number}`);
    parts.push(`- Title: ${context.pullRequest.title}`);
    parts.push(`- State: ${context.pullRequest.state}`);
    parts.push(`- Author: @${context.pullRequest.user.login}`);
    parts.push(`- Base: ${context.pullRequest.base.ref} <- Head: ${context.pullRequest.head.ref}`);
    parts.push(`- Changes: +${context.pullRequest.additions} -${context.pullRequest.deletions} (${context.pullRequest.changed_files} files)`);
    if (context.pullRequest.body) {
      parts.push('');
      parts.push('### Description');
      parts.push(context.pullRequest.body);
    }
  } else if (context.issue) {
    parts.push(`## Issue #${context.issue.number}`);
    parts.push(`- Title: ${context.issue.title}`);
    parts.push(`- State: ${context.issue.state}`);
    parts.push(`- Author: @${context.issue.user.login}`);
    if (context.issue.labels.length > 0) {
      parts.push(`- Labels: ${context.issue.labels.map(l => l.name).join(', ')}`);
    }
    if (context.issue.body) {
      parts.push('');
      parts.push('### Description');
      parts.push(context.issue.body);
    }
  }

  parts.push('');
  parts.push(`## Task from @${context.mentionedBy.login}`);
  parts.push(context.task);
  parts.push('');

  parts.push(`## Guidelines`);
  parts.push('- Provide clear, actionable responses');
  parts.push('- Use GitHub-flavored Markdown for formatting');
  parts.push('- Reference specific files, lines, or commits when relevant');
  parts.push('- If you need more information, ask clarifying questions');
  parts.push('- Be concise but thorough');

  return parts.join('\n');
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
          return data.map(f => ({
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
export async function handleMention(
  context: MentionContext,
  config: BotConfig
): Promise<string> {
  // TODO: Use these when integrating with @duyetbot/core agent
  const _octokit = new Octokit({ auth: config.githubToken });
  const _systemPrompt = buildSystemPrompt(context);

  // For now, return a placeholder response
  // TODO: Integrate with @duyetbot/core agent
  const response = `I received your request: "${context.task}"

**Context:**
- Repository: ${context.repository.full_name}
${context.pullRequest ? `- PR #${context.pullRequest.number}: ${context.pullRequest.title}` : ''}
${context.issue && !context.pullRequest ? `- Issue #${context.issue.number}: ${context.issue.title}` : ''}

I'm processing your request. This feature is currently being implemented.

---
*Powered by @duyetbot*`;

  return response;
}
