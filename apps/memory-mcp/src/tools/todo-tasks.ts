/**
 * Todo/Task Management Tools for Memory MCP
 *
 * Provides todo-specific operations on top of the long-term memory storage.
 * Tasks are stored with category='task' and use additional columns for
 * status tracking, priorities, due dates, and hierarchical organization.
 */

import { z } from 'zod';
import type { D1Storage } from '../storage/d1.js';

// Task status enum matching the migration schema
export const taskStatusEnum = z.enum([
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
]);

// Types for task operations
export type TaskStatus = z.infer<typeof taskStatusEnum>;

/**
 * Task item returned by list operations
 */
export interface TaskItem {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number;
  due_date: number | null;
  completed_at: number | null;
  parent_task_id: string | null;
  tags: string[];
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Add task schema
 */
export const addTaskSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  priority: z.number().min(1).max(10).optional().default(5),
  due_date: z.number().optional(), // Unix timestamp
  tags: z.array(z.string()).optional().default([]),
  parent_task_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type AddTaskInput = z.infer<typeof addTaskSchema>;

/**
 * List tasks schema
 */
export const listTasksSchema = z.object({
  status: taskStatusEnum.optional(),
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
  parent_task_id: z.string().optional(), // Filter by parent
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;

/**
 * Update task schema
 */
export const updateTaskSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: z.number().min(1).max(10).optional(),
  due_date: z.number().optional(),
  tags: z.array(z.string()).optional(),
  completed_at: z.number().optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Complete task schema
 */
export const completeTaskSchema = z.object({
  id: z.string(),
});

export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;

/**
 * Delete task schema
 */
export const deleteTaskSchema = z.object({
  id: z.string(),
});

export type DeleteTaskInput = z.infer<typeof deleteTaskSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse task metadata from database row
 */
function parseTaskMetadata(
  metadata: string | Record<string, unknown> | null
): Record<string, unknown> {
  if (!metadata) {
    return {
      status: 'pending' as TaskStatus,
      tags: [],
    };
  }

  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    return {
      status: (parsed.status || 'pending') as TaskStatus,
      tags: (parsed.tags as string[]) || [],
      parent_task_id: (parsed.parent_task_id as string | null) || null,
      due_date: (parsed.due_date as number | null) || null,
      completed_at: (parsed.completed_at as number | null) || null,
      ...parsed,
    };
  } catch {
    return {
      status: 'pending' as TaskStatus,
      tags: [],
    };
  }
}

/**
 * Convert database row to TaskItem
 */
function rowToTaskItem(row: any): TaskItem {
  const metadata = parseTaskMetadata(row.metadata);
  return {
    id: row.id,
    description: row.value, // Tasks store description in 'value' column
    status: (metadata.status as TaskStatus) || 'pending',
    priority: row.importance ?? 5, // Priority stored in 'importance' column
    due_date: (metadata.due_date as number | null) ?? null,
    completed_at: (metadata.completed_at as number | null) ?? null,
    parent_task_id: (metadata.parent_task_id as string | null) ?? null,
    tags: (metadata.tags as string[]) ?? [],
    created_at: row.created_at ?? Date.now(),
    updated_at: row.updated_at ?? Date.now(),
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
  };
}

// ============================================================================
// Task Operations
// ============================================================================

/**
 * Add a new task
 *
 * Creates a new task with status='pending' and the provided options.
 * The task is stored as a long-term memory item with category='task'.
 */
export async function addTask(
  input: AddTaskInput,
  d1Storage: D1Storage,
  userId: string
): Promise<TaskItem> {
  const { description, priority, due_date, tags, parent_task_id, metadata } =
    addTaskSchema.parse(input);

  // Build task metadata
  const taskMetadata: Record<string, unknown> = {
    status: 'pending',
    tags: tags || [],
    ...(parent_task_id && { parent_task_id }),
    ...(due_date && { due_date }),
    ...(metadata || {}),
  };

  // Generate a unique key for this task (timestamp + random)
  const key = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  // Save to long-term memory
  const result = await d1Storage.saveLongTermMemory(userId, 'task', key, description, {
    importance: priority || 5,
    metadata: taskMetadata,
  });

  // Return the created task
  return {
    id: result.id,
    description,
    status: 'pending',
    priority: priority || 5,
    due_date: due_date || null,
    completed_at: null,
    parent_task_id: parent_task_id || null,
    tags: tags || [],
    created_at: result.created_at,
    updated_at: result.updated_at,
    metadata: taskMetadata,
  };
}

/**
 * List tasks for a user
 *
 * Retrieves tasks with optional filtering by status, parent task, and pagination.
 * Results are ordered by priority (descending) and creation date.
 */
export async function listTasks(
  input: ListTasksInput,
  d1Storage: D1Storage,
  userId: string
): Promise<{ tasks: TaskItem[]; total: number }> {
  const { status, limit = 20, offset = 0, parent_task_id } = listTasksSchema.parse(input);

  // Get all tasks for the user
  const { items } = await d1Storage.listLongTermMemory(userId, {
    category: 'task',
    limit: 1000, // Get all to filter in-memory
    offset: 0,
  });

  // Filter and transform
  let filtered = items
    .map((item) => {
      const metadata = parseTaskMetadata(item.metadata);
      return {
        ...item,
        status: metadata.status || 'pending',
        parent_task_id: metadata.parent_task_id || null,
      };
    })
    .filter((item) => {
      // Filter by status
      if (status) {
        const itemMetadata = parseTaskMetadata(item.metadata);
        if (itemMetadata.status !== status) {
          return false;
        }
      }

      // Filter by parent task
      if (parent_task_id) {
        const itemMetadata = parseTaskMetadata(item.metadata);
        if (itemMetadata.parent_task_id !== parent_task_id) {
          return false;
        }
      }

      return true;
    });

  // Sort by priority (descending) and creation date
  filtered.sort((a, b) => {
    if (b.importance !== a.importance) {
      return b.importance - a.importance; // Higher priority first
    }
    return b.created_at - a.created_at; // Newer first
  });

  // Apply pagination
  const paginated = filtered.slice(offset, offset + limit);

  return {
    tasks: paginated.map(rowToTaskItem),
    total: filtered.length,
  };
}

/**
 * Update an existing task
 *
 * Updates the specified fields of a task. Only provided fields are updated.
 */
export async function updateTask(
  input: UpdateTaskInput,
  d1Storage: D1Storage
): Promise<TaskItem> {
  const { id, description, status, priority, due_date, tags, completed_at } =
    updateTaskSchema.parse(input);

  // Get existing task
  const existing = await d1Storage.getLongTermMemory(id);
  if (!existing || existing.category !== 'task') {
    throw new Error('Task not found');
  }

  // Parse existing metadata
  const existingMetadata = parseTaskMetadata(existing.metadata);

  // Build updated metadata
  const updatedMetadata: Record<string, unknown> = {
    ...existingMetadata,
    ...(status !== undefined && { status }),
    ...(tags !== undefined && { tags }),
    ...(due_date !== undefined && { due_date }),
    ...(completed_at !== undefined && { completed_at }),
  };

  // Update the task - only include defined values
  const updateOptions: {
    value?: string;
    importance?: number;
    metadata: Record<string, unknown>;
  } = { metadata: updatedMetadata };

  if (description !== undefined) {
    updateOptions.value = description;
  }
  if (priority !== undefined) {
    updateOptions.importance = priority;
  }

  await d1Storage.updateLongTermMemory(id, updateOptions);

  // Get the updated task
  const updated = await d1Storage.getLongTermMemory(id);
  if (!updated) {
    throw new Error('Failed to retrieve updated task');
  }

  return rowToTaskItem(updated);
}

/**
 * Mark a task as completed
 *
 * Shortcut for updating task status to 'completed' with completion timestamp.
 */
export async function completeTask(
  input: CompleteTaskInput,
  d1Storage: D1Storage
): Promise<TaskItem> {
  const { id } = completeTaskSchema.parse(input);

  return updateTask(
    {
      id,
      status: 'completed',
      completed_at: Date.now(),
    },
    d1Storage
  );
}

/**
 * Delete a task
 *
 * Permanently removes a task from storage.
 */
export async function deleteTask(
  input: DeleteTaskInput,
  d1Storage: D1Storage
): Promise<{ success: boolean; id: string }> {
  const { id } = deleteTaskSchema.parse(input);

  // Verify it's a task
  const existing = await d1Storage.getLongTermMemory(id);
  if (!existing || existing.category !== 'task') {
    throw new Error('Task not found');
  }

  const success = await d1Storage.deleteLongTermMemory(id);

  return {
    success,
    id,
  };
}
