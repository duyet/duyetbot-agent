/**
 * Task Picker
 *
 * Main task aggregation system that pulls tasks from multiple sources,
 * prioritizes them, and provides a unified interface for task operations.
 */

import {
  FileTasksSource,
  type FileTasksSourceOptions,
  GitHubIssuesSource,
  type GitHubIssuesSourceOptions,
  MemoryMcpSource,
  type MemoryMcpSourceOptions,
} from './sources/index.js';
import type { Task, TaskPickerOptions, TaskSourceProvider } from './types.js';

/**
 * Task Picker
 *
 * Aggregates tasks from multiple sources and provides prioritized task selection.
 *
 * Usage:
 * ```typescript
 * const picker = new TaskPicker({
 *   sources: ['github-issues', 'file', 'memory'],
 *   githubToken: process.env.GITHUB_TOKEN,
 *   repository: { owner: 'user', name: 'repo' },
 *   tasksFilePath: './TASKS.md',
 *   memoryMcpUrl: 'https://memory.example.com',
 * });
 *
 * const task = await picker.pickNext();
 * if (task) {
 *   // Execute task...
 *   await picker.markComplete(task.id);
 * }
 * ```
 */
export class TaskPicker {
  private sources: TaskSourceProvider[] = [];

  constructor(options: TaskPickerOptions) {
    this.initializeSources(options);
  }

  /**
   * Pick the next highest priority task
   *
   * Aggregates tasks from all sources, sorts by source priority and task priority,
   * and returns the highest priority pending task.
   *
   * @returns Next task to execute, or null if no tasks available
   */
  async pickNext(): Promise<Task | null> {
    // Aggregate tasks from all sources in parallel
    const taskLists = await Promise.all(this.sources.map((source) => source.listPending()));

    // Flatten and combine all tasks
    const allTasks: Array<Task & { sourcePriority: number }> = [];
    for (let i = 0; i < this.sources.length; i++) {
      const source = this.sources[i];
      const tasks = taskLists[i];
      if (!source || !tasks) {
        continue;
      }
      for (const task of tasks) {
        allTasks.push({
          ...task,
          sourcePriority: source.priority,
        });
      }
    }

    if (allTasks.length === 0) {
      return null;
    }

    // Sort by source priority (descending), then task priority (descending)
    allTasks.sort((a, b) => {
      // Higher source priority first
      if (a.sourcePriority !== b.sourcePriority) {
        return b.sourcePriority - a.sourcePriority;
      }
      // Higher task priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Newer tasks first (higher createdAt)
      return b.createdAt - a.createdAt;
    });

    // Return the highest priority task (remove sourcePriority field)
    const firstTask = allTasks[0];
    if (!firstTask) {
      return null;
    }
    const { sourcePriority: _, ...task } = firstTask;
    return task;
  }

  /**
   * Mark a task as completed
   *
   * Delegates to the appropriate source provider based on task ID.
   */
  async markComplete(taskId: string): Promise<void> {
    const source = this.findSourceForTask(taskId);
    if (!source) {
      throw new Error(`No source found for task ID: ${taskId}`);
    }

    await source.markComplete(taskId);
  }

  /**
   * Mark a task as failed
   *
   * Delegates to the appropriate source provider based on task ID.
   */
  async markFailed(taskId: string, error: string): Promise<void> {
    const source = this.findSourceForTask(taskId);
    if (!source) {
      throw new Error(`No source found for task ID: ${taskId}`);
    }

    await source.markFailed(taskId, error);
  }

  /**
   * Get all pending tasks from all sources
   *
   * Returns all tasks without filtering or prioritization.
   */
  async listAllPending(): Promise<Task[]> {
    const taskLists = await Promise.all(this.sources.map((source) => source.listPending()));
    return taskLists.flat();
  }

  /**
   * Initialize task source providers based on options
   */
  private initializeSources(options: TaskPickerOptions): void {
    for (const sourceType of options.sources) {
      try {
        const source = this.createSource(sourceType, options);
        if (source) {
          this.sources.push(source);
        }
      } catch (error) {
        console.error(`Failed to initialize source ${sourceType}:`, error);
      }
    }

    if (this.sources.length === 0) {
      throw new Error('No task sources initialized. Check your configuration.');
    }
  }

  /**
   * Create a source provider instance
   */
  private createSource(sourceType: string, options: TaskPickerOptions): TaskSourceProvider | null {
    switch (sourceType) {
      case 'github-issues': {
        if (!options.githubToken || !options.repository) {
          console.warn('github-issues source requires githubToken and repository');
          return null;
        }
        const githubOptions: GitHubIssuesSourceOptions = {
          token: options.githubToken,
          owner: options.repository.owner,
          repo: options.repository.name,
        };
        return new GitHubIssuesSource(githubOptions);
      }

      case 'file': {
        if (!options.tasksFilePath) {
          console.warn('file source requires tasksFilePath');
          return null;
        }
        const fileOptions: FileTasksSourceOptions = {
          filePath: options.tasksFilePath,
        };
        return new FileTasksSource(fileOptions);
      }

      case 'memory': {
        if (!options.memoryMcpUrl) {
          console.warn('memory source requires memoryMcpUrl');
          return null;
        }
        const memoryOptions: MemoryMcpSourceOptions = {
          baseUrl: options.memoryMcpUrl,
        };
        return new MemoryMcpSource(memoryOptions);
      }

      default:
        console.warn(`Unknown source type: ${sourceType}`);
        return null;
    }
  }

  /**
   * Find the source provider for a given task ID
   */
  private findSourceForTask(taskId: string): TaskSourceProvider | null {
    // Task IDs are prefixed with source type (e.g., "github-...", "file-...", "memory-...")
    for (const source of this.sources) {
      if (taskId.startsWith(`${source.name}-`)) {
        return source;
      }
    }
    return null;
  }
}
