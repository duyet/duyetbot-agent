/**
 * GitHub Issues Task Source
 *
 * Fetches tasks from GitHub issues with the 'agent-task' label.
 */

import { Octokit } from '@octokit/rest';
import type { Task, TaskSourceProvider } from '../types.js';

/**
 * Options for GitHub Issues source
 */
export interface GitHubIssuesSourceOptions {
  token: string;
  owner: string;
  repo: string;
}

/**
 * GitHub Issues task source provider
 *
 * Tasks are GitHub issues with the 'agent-task' label.
 * Task completion closes the issue with a comment.
 * Task failure adds an 'agent-failed' label.
 */
export class GitHubIssuesSource implements TaskSourceProvider {
  public readonly name = 'github-issues' as const;
  public readonly priority = 3; // High priority source

  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;

  constructor(options: GitHubIssuesSourceOptions) {
    this.octokit = new Octokit({ auth: options.token });
    this.owner = options.owner;
    this.repo = options.repo;
  }

  /**
   * List all pending tasks from GitHub issues
   *
   * Fetches issues with 'agent-task' label that are open.
   */
  async listPending(): Promise<Task[]> {
    try {
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        labels: 'agent-task',
        state: 'open',
        sort: 'created',
        direction: 'desc',
      });

      return issues.map((issue) => this.issueToTask(issue));
    } catch (error) {
      console.error('Error fetching GitHub issues:', error);
      return [];
    }
  }

  /**
   * Mark a task as completed
   *
   * Closes the GitHub issue with a completion comment.
   */
  async markComplete(taskId: string): Promise<void> {
    const issueNumber = this.extractIssueNumber(taskId);

    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: '✅ Task completed by agent',
    });

    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  }

  /**
   * Mark a task as failed
   *
   * Adds 'agent-failed' label and posts error comment.
   */
  async markFailed(taskId: string, error: string): Promise<void> {
    const issueNumber = this.extractIssueNumber(taskId);

    // Add failure label
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels: ['agent-failed'],
    });

    // Add error comment
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body: `❌ Task failed\n\n**Error:**\n\`\`\`\n${error}\n\`\`\``,
    });
  }

  /**
   * Convert GitHub issue to Task
   */
  private issueToTask(issue: any): Task {
    // Extract priority from labels (e.g., 'priority-1', 'priority-5')
    const priorityLabel = issue.labels.find((l: any) =>
      typeof l === 'string' ? l.startsWith('priority-') : l.name?.startsWith('priority-')
    );
    const priority = priorityLabel
      ? Number.parseInt(
          typeof priorityLabel === 'string'
            ? priorityLabel.split('-')[1]
            : priorityLabel.name.split('-')[1],
          10
        )
      : 5;

    // Extract labels
    const labels = issue.labels
      .map((l: any) => (typeof l === 'string' ? l : l.name))
      .filter((l: string) => l !== 'agent-task' && !l.startsWith('priority-'));

    return {
      id: `github-${this.owner}-${this.repo}-${issue.number}`,
      source: 'github-issues',
      title: issue.title,
      description: issue.body || '',
      priority,
      labels,
      status: 'pending',
      metadata: {
        issueNumber: issue.number,
        url: issue.html_url,
        author: issue.user?.login,
        createdAt: issue.created_at,
      },
      createdAt: new Date(issue.created_at).getTime(),
      updatedAt: new Date(issue.updated_at).getTime(),
    };
  }

  /**
   * Extract issue number from task ID
   */
  private extractIssueNumber(taskId: string): number {
    const parts = taskId.split('-');
    const lastPart = parts[parts.length - 1];
    if (!lastPart) {
      throw new Error(`Invalid task ID format: ${taskId}`);
    }
    const issueNumber = Number.parseInt(lastPart, 10);
    if (Number.isNaN(issueNumber)) {
      throw new Error(`Invalid task ID format: ${taskId}`);
    }
    return issueNumber;
  }
}
