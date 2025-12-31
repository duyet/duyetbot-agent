/**
 * GitHub reporter for PR and issue operations
 */

import { Octokit } from '@octokit/rest';
import type { ReportContext, Reporter } from './types.js';

export interface GitHubReporterOptions {
  /** GitHub personal access token */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** If true, skip actual GitHub API calls */
  dryRun?: boolean | undefined;
}

/**
 * Reports task results to GitHub via issues and pull requests
 */
export class GitHubReporter implements Reporter {
  private octokit: Octokit;

  constructor(private options: GitHubReporterOptions) {
    this.octokit = new Octokit({ auth: options.token });
  }

  /**
   * Report task results to GitHub
   */
  async report(context: ReportContext): Promise<void> {
    if (this.options.dryRun) {
      console.log('[GitHubReporter] Dry run - would report:', {
        taskId: context.taskId,
        success: context.success,
        issueNumber: context.issueNumber,
        prUrl: context.prUrl,
      });
      return;
    }

    // Only report to GitHub if task came from an issue
    if (context.taskSource !== 'github-issues' || !context.issueNumber) {
      return;
    }

    try {
      const comment = this.formatComment(context);
      await this.addIssueComment(context.issueNumber, comment);

      // Add labels based on success/failure
      if (context.success) {
        await this.addLabel(context.issueNumber, 'agent:completed');
        if (context.prUrl) {
          await this.addLabel(context.issueNumber, 'has-pr');
        }
      } else {
        await this.addLabel(context.issueNumber, 'agent:failed');
      }
    } catch (error) {
      console.error('[GitHubReporter] Failed to report to GitHub:', error);
      throw error;
    }
  }

  /**
   * Create a pull request
   */
  async createPullRequest(options: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<{ url: string; number: number }> {
    if (this.options.dryRun) {
      console.log('[GitHubReporter] Dry run - would create PR:', options);
      return {
        url: 'https://github.com/example/repo/pull/1',
        number: 1,
      };
    }

    const response = await this.octokit.pulls.create({
      owner: this.options.owner,
      repo: this.options.repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
    });

    return {
      url: response.data.html_url,
      number: response.data.number,
    };
  }

  /**
   * Add a comment to an issue
   */
  async addIssueComment(issueNumber: number, body: string): Promise<void> {
    if (this.options.dryRun) {
      console.log('[GitHubReporter] Dry run - would add comment to issue', issueNumber);
      return;
    }

    await this.octokit.issues.createComment({
      owner: this.options.owner,
      repo: this.options.repo,
      issue_number: issueNumber,
      body,
    });
  }

  /**
   * Close an issue with optional comment
   */
  async closeIssue(issueNumber: number, comment?: string): Promise<void> {
    if (this.options.dryRun) {
      console.log('[GitHubReporter] Dry run - would close issue', issueNumber);
      return;
    }

    if (comment) {
      await this.addIssueComment(issueNumber, comment);
    }

    await this.octokit.issues.update({
      owner: this.options.owner,
      repo: this.options.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  }

  /**
   * Add a label to an issue
   */
  async addLabel(issueNumber: number, label: string): Promise<void> {
    if (this.options.dryRun) {
      console.log('[GitHubReporter] Dry run - would add label', label, 'to issue', issueNumber);
      return;
    }

    try {
      await this.octokit.issues.addLabels({
        owner: this.options.owner,
        repo: this.options.repo,
        issue_number: issueNumber,
        labels: [label],
      });
    } catch (error) {
      // Ignore label errors - labels might not exist in repo
      console.warn(`[GitHubReporter] Failed to add label ${label}:`, error);
    }
  }

  /**
   * Format report comment for GitHub issue
   */
  private formatComment(context: ReportContext): string {
    const status = context.success ? '✅ Completed' : '❌ Failed';
    const duration = (context.duration / 1000).toFixed(2);

    let comment = `## ${status}\n\n`;
    comment += `**Task ID:** \`${context.taskId}\`\n`;
    comment += `**Duration:** ${duration}s\n`;
    comment += `**Tokens Used:** ${context.tokensUsed}\n\n`;

    if (context.prUrl) {
      comment += `**Pull Request:** ${context.prUrl}\n\n`;
    }

    if (context.branch) {
      comment += `**Branch:** \`${context.branch}\`\n\n`;
    }

    if (context.success) {
      comment += `### Output\n\n`;
      const truncatedOutput = context.output.slice(0, 2000);
      comment += `\`\`\`\n${truncatedOutput}`;
      if (context.output.length > 2000) {
        comment += '\n... (truncated)';
      }
      comment += '\n```\n';
    } else {
      comment += `### Error\n\n`;
      comment += `\`\`\`\n${context.error || 'Unknown error'}\n\`\`\`\n`;
    }

    comment += `\n---\n`;
    comment += `*Automated by duyetbot-agent*`;

    return comment;
  }
}
