/**
 * Task Picker Types
 *
 * Defines interfaces for the task aggregation system that pulls tasks
 * from multiple sources (GitHub Issues, file-based, memory-mcp).
 */

export type TaskSource = 'github-issues' | 'file' | 'memory';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Unified task representation from any source
 */
export interface Task {
  /** Unique identifier for the task */
  id: string;

  /** Source system that owns this task */
  source: TaskSource;

  /** Task title/summary */
  title: string;

  /** Detailed task description */
  description: string;

  /** Priority 1-10, higher is more important */
  priority: number;

  /** Labels/tags associated with the task */
  labels: string[];

  /** Current task status */
  status: TaskStatus;

  /** Source-specific metadata */
  metadata: Record<string, unknown>;

  /** Task creation timestamp (Unix ms) */
  createdAt: number;

  /** Last update timestamp (Unix ms) */
  updatedAt: number;
}

/**
 * Interface for task source providers
 */
export interface TaskSourceProvider {
  /** Provider name matching TaskSource */
  name: TaskSource;

  /** Source priority for ordering (higher = checked first) */
  priority: number;

  /**
   * List all pending tasks from this source
   */
  listPending(): Promise<Task[]>;

  /**
   * Mark a task as completed
   * @param taskId - Task identifier
   */
  markComplete(taskId: string): Promise<void>;

  /**
   * Mark a task as failed
   * @param taskId - Task identifier
   * @param error - Error message explaining the failure
   */
  markFailed(taskId: string, error: string): Promise<void>;
}

/**
 * Configuration options for TaskPicker
 */
export interface TaskPickerOptions {
  /** Which sources to enable */
  sources: TaskSource[];

  /** GitHub API token (required for github-issues source) */
  githubToken?: string | undefined;

  /** Memory MCP service URL (required for memory source) */
  memoryMcpUrl?: string | undefined;

  /** Repository context (required for github-issues source) */
  repository?:
    | {
        owner: string;
        name: string;
      }
    | undefined;

  /** Path to TASKS.md file (required for file source) */
  tasksFilePath?: string | undefined;
}
