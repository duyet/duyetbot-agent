/**
 * Tasks API Client
 *
 * Client for interacting with the memory-mcp tasks API.
 * Handles authentication, request/response transformation, and error handling.
 */

import type {
  AddTaskInput,
  ListTasksInput,
  TaskItem,
  TasksResponse,
  UpdateTaskInput,
} from './types';

const MEMORY_MCP_URL =
  process.env.NEXT_PUBLIC_MEMORY_MCP_URL || 'https://memory-mcp.duyetbot.workers.dev';
const AUTH_TOKEN = process.env.NEXT_PUBLIC_MEMORY_AUTH_TOKEN || '';

class TasksClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'TasksClientError';
  }
}

/**
 * Make authenticated request to memory-mcp API
 */
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${MEMORY_MCP_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // Add auth token if available
  if (AUTH_TOKEN) {
    headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({ error: 'Unknown error' }))) as {
        error?: string;
      };
      throw new TasksClientError(errorData.error || 'Request failed', response.status);
    }

    return response.json();
  } catch (error) {
    if (error instanceof TasksClientError) {
      throw error;
    }
    throw new TasksClientError(error instanceof Error ? error.message : 'Network error');
  }
}

/**
 * Tasks API Client
 */
export const tasksClient = {
  /**
   * List tasks with optional filters
   */
  async list(input: ListTasksInput = {}): Promise<TasksResponse> {
    return request('/api/tasks/list', {
      method: 'POST',
      body: JSON.stringify({
        limit: input.limit || 100,
        offset: input.offset || 0,
        status: input.status,
        parent_task_id: input.parent_task_id,
      }),
    });
  },

  /**
   * Add a new task
   */
  async add(input: AddTaskInput): Promise<TaskItem> {
    return request('/api/tasks/add', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing task
   */
  async update(input: UpdateTaskInput): Promise<TaskItem> {
    return request('/api/tasks/update', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Mark a task as completed
   */
  async complete(id: string): Promise<TaskItem> {
    return request('/api/tasks/complete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  /**
   * Delete a task
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    return request('/api/tasks/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  /**
   * Fetch all tasks (for initial board load)
   */
  async fetchAll(): Promise<TaskItem[]> {
    const results = await Promise.all([
      this.list({ status: 'pending', limit: 100 }),
      this.list({ status: 'in_progress', limit: 100 }),
      this.list({ status: 'blocked', limit: 100 }),
      this.list({ status: 'completed', limit: 100 }),
      this.list({ status: 'cancelled', limit: 100 }),
    ]);

    return results.flatMap((r) => r.tasks);
  },
};

export { TasksClientError };
