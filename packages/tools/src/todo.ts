/**
 * Todo Tool - Task Management (Claude Code-style)
 *
 * Provides task tracking and management for multi-step operations.
 * Helps agents plan, track progress, and demonstrate thoroughness.
 *
 * Features:
 * - Create and manage structured task lists
 * - Track task status (pending, in_progress, completed)
 * - Break down complex tasks into smaller steps
 * - Persist todos within a session
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

/**
 * Task status enum
 */
export type TodoStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Todo item structure
 */
export interface TodoItem {
  /** Imperative description of what needs to be done (e.g., "Run tests") */
  content: string;
  /** Current status of the task */
  status: TodoStatus;
  /** Present continuous form shown during execution (e.g., "Running tests") */
  activeForm: string;
}

// =============================================================================
// Input Schema
// =============================================================================

const todoItemSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  activeForm: z.string().min(1, 'Active form is required'),
});

const todoWriteInputSchema = z.object({
  /** The updated todo list */
  todos: z.array(todoItemSchema),
});

type TodoWriteInput = z.infer<typeof todoWriteInputSchema>;

// =============================================================================
// In-memory Todo Storage (per session)
// =============================================================================

/**
 * Global todo storage
 * In a real implementation, this would be persisted to a database or file
 */
let currentTodos: TodoItem[] = [];

/**
 * Get current todos (for external access)
 */
export function getTodos(): TodoItem[] {
  return [...currentTodos];
}

/**
 * Set todos (for external access)
 */
export function setTodos(todos: TodoItem[]): void {
  currentTodos = [...todos];
}

/**
 * Clear all todos
 */
export function clearTodos(): void {
  currentTodos = [];
}

/**
 * Format todos as a readable string
 */
export function formatTodos(todos: TodoItem[]): string {
  if (todos.length === 0) {
    return 'No tasks in the todo list.';
  }

  const lines: string[] = ['## Todo List', ''];

  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i];
    if (!todo) continue;

    let statusIcon: string;
    switch (todo.status) {
      case 'completed':
        statusIcon = '✅';
        break;
      case 'in_progress':
        statusIcon = '🔄';
        break;
      case 'pending':
      default:
        statusIcon = '⬜';
        break;
    }

    lines.push(`${i + 1}. ${statusIcon} ${todo.content}`);
  }

  // Add summary
  const completed = todos.filter((t) => t.status === 'completed').length;
  const inProgress = todos.filter((t) => t.status === 'in_progress').length;
  const pending = todos.filter((t) => t.status === 'pending').length;

  lines.push('');
  lines.push(`Progress: ${completed}/${todos.length} completed`);
  if (inProgress > 0) {
    lines.push(`Currently working on: ${inProgress} task(s)`);
  }
  if (pending > 0) {
    lines.push(`Remaining: ${pending} task(s)`);
  }

  return lines.join('\n');
}

// =============================================================================
// Tool Implementation
// =============================================================================

/**
 * TodoWrite Tool - Create and manage structured task lists
 *
 * Use this tool to track progress on complex, multi-step tasks.
 * Helps demonstrate thoroughness and gives visibility into progress.
 */
export class TodoWriteTool implements Tool {
  name = 'todo_write';
  description =
    'Create and manage a structured task list for tracking progress on complex tasks. ' +
    'Use for multi-step tasks (3+ steps), complex implementations, or when the user provides multiple tasks. ' +
    'Each todo has: content (what to do), status (pending/in_progress/completed), and activeForm (present continuous).';
  inputSchema = todoWriteInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    return result.success;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    try {
      const parsed = this.inputSchema.parse(input.content) as TodoWriteInput;
      const { todos } = parsed;

      // Validate: only one task should be in_progress at a time
      const inProgressCount = todos.filter((t) => t.status === 'in_progress').length;
      if (inProgressCount > 1) {
        return {
          status: 'error',
          content: 'Only one task should be in_progress at a time',
          error: {
            message: `Found ${inProgressCount} tasks in_progress. Please update to have only one.`,
            code: 'MULTIPLE_IN_PROGRESS',
          },
        };
      }

      // Update the global todo list
      currentTodos = todos.map((t) => ({ ...t }));

      // Format the response
      const formatted = formatTodos(currentTodos);

      return {
        status: 'success',
        content: formatted,
        metadata: {
          totalTasks: todos.length,
          completed: todos.filter((t) => t.status === 'completed').length,
          inProgress: inProgressCount,
          pending: todos.filter((t) => t.status === 'pending').length,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: 'Failed to update todo list',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'TODO_WRITE_FAILED',
        },
      };
    }
  }
}

/**
 * TodoRead Tool - Read the current todo list
 */
export class TodoReadTool implements Tool {
  name = 'todo_read';
  description = 'Read the current todo list to see task progress and status.';
  inputSchema = z.object({});

  validate(_input: ToolInput): boolean {
    return true;
  }

  async execute(_input: ToolInput): Promise<ToolOutput> {
    const formatted = formatTodos(currentTodos);

    return {
      status: 'success',
      content: formatted,
      metadata: {
        totalTasks: currentTodos.length,
        completed: currentTodos.filter((t) => t.status === 'completed').length,
        inProgress: currentTodos.filter((t) => t.status === 'in_progress').length,
        pending: currentTodos.filter((t) => t.status === 'pending').length,
      },
    };
  }
}

export const todoWriteTool = new TodoWriteTool();
export const todoReadTool = new TodoReadTool();

// =============================================================================
// Type Exports
// =============================================================================

export type { TodoWriteInput };
