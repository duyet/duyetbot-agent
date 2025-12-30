/**
 * File-based Task Source
 *
 * Parses tasks from a TASKS.md file with markdown checkboxes.
 * Format:
 *   - [ ] Task description
 *   - [x] Completed task
 *   - [ ] [P1] High priority task
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { Task, TaskSourceProvider } from '../types.js';

/**
 * Options for file-based task source
 */
export interface FileTasksSourceOptions {
  /** Path to TASKS.md file */
  filePath: string;
}

/**
 * File-based task source provider
 *
 * Reads tasks from a markdown file with checkboxes.
 * Supports priority markers: [P1] through [P10]
 */
export class FileTasksSource implements TaskSourceProvider {
  public readonly name = 'file' as const;
  public readonly priority = 2; // Medium priority source

  private readonly filePath: string;

  constructor(options: FileTasksSourceOptions) {
    this.filePath = options.filePath;
  }

  /**
   * List all pending tasks from the file
   *
   * Parses markdown checkboxes that are unchecked.
   */
  async listPending(): Promise<Task[]> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const lines = content.split('\n');
      const tasks: Task[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) {
          continue;
        }

        // Match unchecked checkbox: - [ ] or * [ ]
        const uncheckedMatch = line.match(/^[-*]\s+\[\s\]\s+(.+)$/);
        if (uncheckedMatch?.[1]) {
          const taskText = uncheckedMatch[1];
          tasks.push(this.parseTaskLine(taskText, i));
        }
      }

      return tasks;
    } catch (error) {
      console.error(`Error reading tasks file ${this.filePath}:`, error);
      return [];
    }
  }

  /**
   * Mark a task as completed
   *
   * Updates the checkbox to [x] in the file.
   */
  async markComplete(taskId: string): Promise<void> {
    const lineNumber = this.extractLineNumber(taskId);
    await this.updateTaskCheckbox(lineNumber, true);
  }

  /**
   * Mark a task as failed
   *
   * Adds a failure comment below the task line.
   */
  async markFailed(taskId: string, error: string): Promise<void> {
    const lineNumber = this.extractLineNumber(taskId);

    try {
      const content = await readFile(this.filePath, 'utf-8');
      const lines = content.split('\n');

      // Insert error comment after the task line
      const errorComment = `  > ❌ Failed: ${error}`;
      lines.splice(lineNumber + 1, 0, errorComment);

      await writeFile(this.filePath, lines.join('\n'), 'utf-8');
    } catch (error) {
      console.error(`Error marking task failed in ${this.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Parse a task line into a Task object
   */
  private parseTaskLine(taskText: string, lineNumber: number): Task {
    // Extract priority marker: [P1] through [P10]
    const priorityMatch = taskText.match(/^\[P(\d+)\]\s+(.+)$/);
    let priority = 5; // Default priority
    let description = taskText;

    if (priorityMatch?.[1] && priorityMatch[2]) {
      priority = Math.min(10, Math.max(1, Number.parseInt(priorityMatch[1], 10)));
      description = priorityMatch[2];
    }

    // Extract labels from hashtags: #label
    const labels: string[] = [];
    const labelMatches = description.matchAll(/#(\w+)/g);
    for (const match of labelMatches) {
      if (match[1]) {
        labels.push(match[1]);
      }
    }

    // Remove hashtags from description
    const cleanDescription = description.replace(/#\w+/g, '').trim();

    return {
      id: `file-line-${lineNumber}`,
      source: 'file',
      title: cleanDescription.slice(0, 80), // First 80 chars as title
      description: cleanDescription,
      priority,
      labels,
      status: 'pending',
      metadata: {
        filePath: this.filePath,
        lineNumber,
      },
      createdAt: Date.now(), // File doesn't track creation time
      updatedAt: Date.now(),
    };
  }

  /**
   * Update a task checkbox in the file
   */
  private async updateTaskCheckbox(lineNumber: number, checked: boolean): Promise<void> {
    try {
      const content = await readFile(this.filePath, 'utf-8');
      const lines = content.split('\n');

      if (lineNumber >= lines.length) {
        throw new Error(`Line number ${lineNumber} out of range`);
      }

      const line = lines[lineNumber];
      if (!line) {
        throw new Error(`Line ${lineNumber} is empty or undefined`);
      }
      const checkMark = checked ? 'x' : ' ';

      // Update checkbox: - [ ] -> - [x] or - [x] -> - [ ]
      lines[lineNumber] = line.replace(/^([-*]\s+\[)\s(\]\s+.+)$/, `$1${checkMark}$2`);

      await writeFile(this.filePath, lines.join('\n'), 'utf-8');
    } catch (error) {
      console.error(`Error updating checkbox in ${this.filePath}:`, error);
      throw error;
    }
  }

  /**
   * Extract line number from task ID
   */
  private extractLineNumber(taskId: string): number {
    const match = taskId.match(/^file-line-(\d+)$/);
    if (!match?.[1]) {
      throw new Error(`Invalid file task ID: ${taskId}`);
    }
    return Number.parseInt(match[1], 10);
  }
}
