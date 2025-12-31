/**
 * Task Source Base Interface
 */

import type { Task, TaskPriority, TaskSourceType } from '../types.js';

/**
 * Base task source interface
 */
export abstract class TaskSource {
  abstract readonly type: TaskSourceType;
  protected enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Poll for new tasks from this source
   */
  abstract poll(): Promise<Task[]>;

  /**
   * Update task status in the source
   */
  abstract updateStatus(taskId: string, status: string): Promise<void>;

  /**
   * Check if source is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the source
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Create a task from source-specific data
   */
  protected createTask(
    id: string,
    sourceId: string,
    title: string,
    description: string,
    priority: TaskPriority,
    tags: string[] = [],
    metadata: Record<string, unknown> = {}
  ): Task {
    return {
      id: `${this.type}:${sourceId}:${id}`,
      sourceId,
      sourceType: this.type,
      title,
      description,
      priority,
      status: 'pending' as const,
      tags,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
