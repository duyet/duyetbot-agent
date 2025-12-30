/**
 * Memory MCP Task Source
 *
 * Fetches tasks from the memory-mcp service via HTTP API.
 * Uses the todo-tasks API for task operations.
 */

import { z } from 'zod';
import type { Task, TaskSourceProvider } from '../types.js';

/**
 * Options for Memory MCP source
 */
export interface MemoryMcpSourceOptions {
  /** Base URL for memory-mcp service */
  baseUrl: string;

  /** User ID for task queries */
  userId?: string;
}

/**
 * Task item from memory-mcp API (matches todo-tasks.ts schema)
 */
const memoryTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'blocked', 'completed', 'cancelled']),
  priority: z.number().min(1).max(10),
  due_date: z.number().nullable(),
  completed_at: z.number().nullable(),
  parent_task_id: z.string().nullable(),
  tags: z.array(z.string()),
  created_at: z.number(),
  updated_at: z.number(),
  metadata: z.record(z.unknown()).nullable(),
});

type MemoryTask = z.infer<typeof memoryTaskSchema>;

/**
 * Memory MCP task source provider
 *
 * Queries memory-mcp service for pending tasks.
 */
export class MemoryMcpSource implements TaskSourceProvider {
  public readonly name = 'memory' as const;
  public readonly priority = 1; // Lower priority than GitHub/file

  private readonly baseUrl: string;
  private readonly userId: string;

  constructor(options: MemoryMcpSourceOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.userId = options.userId || 'github-actions-agent';
  }

  /**
   * List all pending tasks from memory-mcp
   *
   * Fetches tasks with status='pending' via HTTP API.
   */
  async listPending(): Promise<Task[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'list',
          params: {
            status: 'pending',
            limit: 100,
          },
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Memory MCP API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { tasks?: MemoryTask[] };
      const tasks = data.tasks || [];

      return tasks.map((task) => this.memoryTaskToTask(task));
    } catch (error) {
      console.error('Error fetching memory-mcp tasks:', error);
      return [];
    }
  }

  /**
   * Mark a task as completed
   *
   * Updates task status via memory-mcp API.
   */
  async markComplete(taskId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete',
          params: {
            id: taskId,
          },
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark task complete: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking task complete:', error);
      throw error;
    }
  }

  /**
   * Mark a task as failed
   *
   * Updates task status to 'cancelled' and stores error in metadata.
   */
  async markFailed(taskId: string, error: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          params: {
            id: taskId,
            status: 'cancelled',
            metadata: {
              error,
              failedAt: Date.now(),
            },
          },
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark task failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error marking task failed:', error);
      throw error;
    }
  }

  /**
   * Convert memory-mcp task to unified Task format
   */
  private memoryTaskToTask(memoryTask: MemoryTask): Task {
    return {
      id: memoryTask.id,
      source: 'memory',
      title: memoryTask.description.slice(0, 80), // First 80 chars as title
      description: memoryTask.description,
      priority: memoryTask.priority,
      labels: memoryTask.tags,
      status: this.mapStatus(memoryTask.status),
      metadata: {
        dueDate: memoryTask.due_date,
        completedAt: memoryTask.completed_at,
        parentTaskId: memoryTask.parent_task_id,
        ...(memoryTask.metadata || {}),
      },
      createdAt: memoryTask.created_at,
      updatedAt: memoryTask.updated_at,
    };
  }

  /**
   * Map memory-mcp status to unified task status
   */
  private mapStatus(
    status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled'
  ): 'pending' | 'in_progress' | 'completed' | 'failed' {
    switch (status) {
      case 'pending':
      case 'blocked':
        return 'pending';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'failed';
    }
  }
}
