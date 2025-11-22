/**
 * Tool Executor
 *
 * Executes GitHub tools via Octokit API
 */

import type { ToolCall, ToolExecutor } from '@duyetbot/chat-agent';
import type { Octokit } from '@octokit/rest';
import { fetchEnhancedContext, formatEnhancedContext } from '../context-fetcher.js';
import { logger } from '../logger.js';
import type { MentionContext } from '../types.js';

/**
 * Context required for tool execution
 */
export interface ToolExecutorContext {
  octokit: Octokit;
  mentionContext: MentionContext;
}

/**
 * Create a tool executor for GitHub operations
 */
export function createToolExecutor(context: ToolExecutorContext): ToolExecutor {
  const { octokit, mentionContext } = context;
  const owner = mentionContext.repository.owner.login;
  const repo = mentionContext.repository.name;
  const issueNumber = mentionContext.issue?.number || mentionContext.pullRequest?.number;

  return async (call: ToolCall): Promise<string> => {
    const args = JSON.parse(call.arguments || '{}');
    const startTime = Date.now();
    const fullRepo = `${owner}/${repo}`;

    logger.info('Tool call started', {
      tool: call.name,
      repository: fullRepo,
      issue: issueNumber,
    });

    try {
      let result: string;

      switch (call.name) {
        // ============================================
        // Basic Tools
        // ============================================
        case 'post_comment': {
          if (!issueNumber) {
            result = 'Error: No issue or PR number available';
            break;
          }
          await octokit.issues.createComment({
            owner,
            repo,
            issue_number: issueNumber,
            body: args.body,
          });
          result = 'Comment posted successfully';
          break;
        }

        case 'add_reaction': {
          if (!mentionContext.comment) {
            result = 'Error: No comment to react to';
            break;
          }
          const validReactions = [
            'eyes',
            'rocket',
            '+1',
            '-1',
            'heart',
            'hooray',
            'laugh',
            'confused',
          ] as const;
          type ReactionType = (typeof validReactions)[number];

          if (!validReactions.includes(args.reaction as ReactionType)) {
            result = `Error: Invalid reaction '${args.reaction}'`;
            break;
          }

          await octokit.reactions.createForIssueComment({
            owner,
            repo,
            comment_id: mentionContext.comment.id,
            content: args.reaction as ReactionType,
          });
          result = `Added ${args.reaction} reaction`;
          break;
        }

        case 'get_issue_context': {
          const enhanced = await fetchEnhancedContext(
            octokit,
            mentionContext.repository,
            mentionContext.issue?.number,
            mentionContext.pullRequest?.number
          );
          result = formatEnhancedContext(enhanced);
          break;
        }

        // ============================================
        // PR Operation Tools
        // ============================================
        case 'merge_pr': {
          if (!mentionContext.pullRequest) {
            result = 'Error: This is not a pull request';
            break;
          }

          // Check CI status first
          const { data: checks } = await octokit.checks.listForRef({
            owner,
            repo,
            ref: mentionContext.pullRequest.head.sha,
          });

          const failedChecks = checks.check_runs.filter(
            (c) => c.status === 'completed' && c.conclusion !== 'success'
          );

          if (failedChecks.length > 0) {
            result = `Cannot merge: ${failedChecks.length} check(s) failed:\n${failedChecks.map((c) => `- ${c.name}: ${c.conclusion}`).join('\n')}`;
            break;
          }

          const pendingChecks = checks.check_runs.filter((c) => c.status !== 'completed');

          if (pendingChecks.length > 0) {
            result = `Cannot merge: ${pendingChecks.length} check(s) still running:\n${pendingChecks.map((c) => `- ${c.name}`).join('\n')}`;
            break;
          }

          // Merge the PR
          const mergeMethod = args.merge_method || 'squash';
          await octokit.pulls.merge({
            owner,
            repo,
            pull_number: mentionContext.pullRequest.number,
            merge_method: mergeMethod as 'merge' | 'squash' | 'rebase',
            commit_title: args.commit_title,
          });

          result = `PR #${mentionContext.pullRequest.number} merged successfully using ${mergeMethod}`;
          break;
        }

        case 'approve_pr': {
          if (!mentionContext.pullRequest) {
            result = 'Error: This is not a pull request';
            break;
          }

          await octokit.pulls.createReview({
            owner,
            repo,
            pull_number: mentionContext.pullRequest.number,
            event: 'APPROVE',
            body: args.comment || 'Approved',
          });

          result = `PR #${mentionContext.pullRequest.number} approved`;
          break;
        }

        case 'request_changes': {
          if (!mentionContext.pullRequest) {
            result = 'Error: This is not a pull request';
            break;
          }

          await octokit.pulls.createReview({
            owner,
            repo,
            pull_number: mentionContext.pullRequest.number,
            event: 'REQUEST_CHANGES',
            body: args.comment,
          });

          result = `Changes requested on PR #${mentionContext.pullRequest.number}`;
          break;
        }

        case 'check_ci_status': {
          const sha = mentionContext.pullRequest?.head.sha;
          if (!sha) {
            result = 'Error: No commit SHA available';
            break;
          }

          const { data: checks } = await octokit.checks.listForRef({
            owner,
            repo,
            ref: sha,
          });

          if (checks.check_runs.length === 0) {
            result = 'No CI checks found for this commit';
            break;
          }

          const statusLines = checks.check_runs.map((c) => {
            const status = c.status === 'completed' ? c.conclusion : c.status;
            return `- ${c.name}: ${status}`;
          });

          result = `CI Status for ${sha.substring(0, 7)}:\n${statusLines.join('\n')}`;
          break;
        }

        // ============================================
        // Content Tools
        // ============================================
        case 'get_file_content': {
          const { data } = await octokit.repos.getContent({
            owner,
            repo,
            path: args.path,
            ref: args.ref,
          });

          if (Array.isArray(data)) {
            result = `Error: ${args.path} is a directory, not a file`;
            break;
          }

          if (data.type !== 'file') {
            result = `Error: ${args.path} is not a file`;
            break;
          }

          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          result = `File: ${args.path}\n\n\`\`\`\n${content}\n\`\`\``;
          break;
        }

        // ============================================
        // Task Management Tools
        // ============================================
        case 'create_issue': {
          const { data: newIssue } = await octokit.issues.create({
            owner,
            repo,
            title: args.title,
            body: args.body,
            labels: args.labels,
            assignees: args.assignees,
          });

          result = `Created issue #${newIssue.number}: ${newIssue.title}\n${newIssue.html_url}`;
          break;
        }

        case 'add_labels': {
          if (!issueNumber) {
            result = 'Error: No issue or PR number available';
            break;
          }

          await octokit.issues.addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: args.labels,
          });

          result = `Added labels: ${args.labels.join(', ')}`;
          break;
        }

        case 'assign_users': {
          if (!issueNumber) {
            result = 'Error: No issue or PR number available';
            break;
          }

          await octokit.issues.addAssignees({
            owner,
            repo,
            issue_number: issueNumber,
            assignees: args.assignees,
          });

          result = `Assigned users: ${args.assignees.join(', ')}`;
          break;
        }

        default:
          result = `Unknown tool: ${call.name}`;
      }

      logger.info('Tool call completed', {
        tool: call.name,
        repository: fullRepo,
        issue: issueNumber,
        durationMs: Date.now() - startTime,
        success: !result.startsWith('Error'),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Tool call error', {
        tool: call.name,
        repository: fullRepo,
        issue: issueNumber,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return `Error executing ${call.name}: ${errorMessage}`;
    }
  };
}
