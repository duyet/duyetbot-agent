/**
 * TodoWrite Tool
 *
 * Manages task lists for multi-step operations with progress tracking
 * Based on Claude Code's TODO pattern
 */

import type { Tool, ToolInput, ToolOutput } from '@duyetbot/types';
import { z } from 'zod';
import { TodoManager, type TodoItem } from './todo.js';

// Input schema for todo operations
const todoInputSchema = z.object({
  action: z.enum([
    'create_list',
    'add_todo',
    'update_todo',
    'remove_list',
    'clear_completed',
    'get_list',
    'get_formatted',
    'get_stats',
    'get_all_lists',
  ]),
  listId: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  todoId: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
});

const manager = new TodoManager();

export class TodoWriteTool implements Tool {
  name = 'todo';
  description =
    'Manage task lists for multi-step operations. Create, update, and track TODO items across conversations.';

  inputSchema = todoInputSchema;

  validate(input: ToolInput): boolean {
    const result = this.inputSchema.safeParse(input.content);
    if (!result.success) {
      return false;
    }

    return true;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();

    try {
      const parsed = this.inputSchema.safeParse(input.content);
      if (!parsed.success) {
        return {
          status: 'error',
          content: 'Invalid input',
          error: {
            message: `Invalid input: ${parsed.error.message}`,
            code: 'INVALID_INPUT',
          },
        };
      }

      const data = parsed.data;

      switch (data.action) {
        case 'create_list': {
          const listId = manager.createList(data.title);
          return {
            status: 'success',
            content: `✅ Created TODO list with ID: ${listId}`,
            metadata: { listId },
          };
        }

        case 'add_todo': {
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for add_todo',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          const newTodoId = manager.addTodo(data.listId, data.content, data.priority);
          return {
            status: 'success',
            content: `✅ Added TODO item with ID: ${newTodoId}`,
            metadata: { listId: data.listId, todoId: newTodoId },
          };
        }

        case 'update_todo':
          if (!data.listId || !data.todoId) {
            return {
              status: 'error',
              content: 'List ID and todo ID required for update_todo',
              error: {
                message: 'Missing listId or todoId',
                code: 'MISSING_IDS',
              },
            };
          }

          const updateData: Partial<Pick<TodoItem, 'status' | 'priority'>> = {};
          if (data.status !== undefined) updateData.status = data.status;
          if (data.priority !== undefined) updateData.priority = data.priority;

          manager.updateTodo(data.listId, data.todoId, updateData);
          return {
            status: 'success',
            content: `✅ Updated TODO item ${data.todoId}`,
            metadata: { listId: data.listId, todoId: data.todoId },
          };

        case 'remove_list':
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for remove_list',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          manager.removeList(data.listId);
          return {
            status: 'success',
            content: `✅ Removed TODO list ${data.listId}`,
            metadata: { listId: data.listId },
          };

        case 'clear_completed':
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for clear_completed',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          manager.clearCompleted(data.listId);
          return {
            status: 'success',
            content: `✅ Cleared completed items from list ${data.listId}`,
            metadata: { listId: data.listId },
          };

        case 'get_list': {
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for get_list',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          const list = manager.getList(data.listId);
          if (!list) {
            return {
              status: 'error',
              content: `TODO list ${data.listId} not found`,
              error: {
                message: `List ${data.listId} not found`,
                code: 'LIST_NOT_FOUND',
              },
            };
          }

          return {
            status: 'success',
            content: manager.getFormattedList(data.listId),
            metadata: { listId: data.listId },
          };
        }

        case 'get_formatted':
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for get_formatted',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          return {
            status: 'success',
            content: manager.getFormattedList(data.listId),
            metadata: { listId: data.listId },
          };

        case 'get_stats': {
          if (!data.listId) {
            return {
              status: 'error',
              content: 'List ID required for get_stats',
              error: {
                message: 'Missing listId parameter',
                code: 'MISSING_LIST_ID',
              },
            };
          }

          const stats = manager.getStats(data.listId);
          if (!stats) {
            return {
              status: 'error',
              content: `TODO list ${data.listId} not found`,
              error: {
                message: `List ${data.listId} not found`,
                code: 'LIST_NOT_FOUND',
              },
            };
          }

          const statsText = [
            `📊 **TODO List Statistics**`,
            `Total: ${stats.total}`,
            `Completed: ${stats.completed} (${Math.round((stats.completed / stats.total) * 100)}%)`,
            `In Progress: ${stats.inProgress}`,
            `Pending: ${stats.pending}`,
          ].join('\n');

          return {
            status: 'success',
            content: statsText,
            metadata: { listId: data.listId, stats },
          };
        }

        case 'get_all_lists': {
          const lists = manager.lists;
          const listsText = [
            `📋 **All TODO Lists** (${lists.size})`,
            ...Array.from(lists.entries()).map(([id, list]: [string, any]) => {
              const stats = manager.getStats(id);
              if (!stats) return '';
              return [
                `  **${list.title || id}**`,
                `    Items: ${stats.total}`,
                `    Completed: ${stats.completed}`,
                `    In Progress: ${stats.inProgress}`,
                `    Created: ${new Date(list.createdAt).toLocaleString()}`,
              ].join('\n');
            }),
          ].join('\n\n');

          return {
            status: 'success',
            content: listsText,
          };
        }

        default:
          return {
            status: 'error',
            content: `Unknown action: ${data.action}`,
            error: {
              message: `Action ${data.action} not implemented`,
              code: 'UNKNOWN_ACTION',
            },
          };
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        status: 'error',
        content: 'An error occurred while managing TODO list',
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'EXECUTION_ERROR',
        },
        metadata: { duration },
      };
    }
  }
}

export const todoWriteTool = new TodoWriteTool();
