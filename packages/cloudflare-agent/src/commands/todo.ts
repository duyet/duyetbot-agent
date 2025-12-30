/**
 * Todo Command Handler
 *
 * Provides task management commands via the memory-mcp service binding.
 * Tasks are stored in long-term memory with category='task'.
 *
 * Usage:
 *   /todo add <description> [priority:N] [due:timestamp] [tags:tag1,tag2]
 *   /todo list [pending|in_progress|blocked|completed|cancelled]
 *   /todo done <task_id>
 *   /todo cancel <task_id>
 *   /todo update <task_id> [description|priority|status]
 *   /todo delete <task_id>
 */

import { logger } from '@duyetbot/hono-middleware';
import { escapeHtml, escapeMarkdownV2 } from '../debug-footer.js';
import type { CommandContext, CommandHandler } from './types.js';

/**
 * Memory Service RPC interface for task operations
 */
interface MemoryServiceTasks {
  addTask(
    userId: string,
    description: string,
    options?: {
      priority?: number;
      due_date?: number;
      tags?: string[];
      parent_task_id?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TaskItem>;

  listTasks(
    userId: string,
    options?: {
      status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
      limit?: number;
      offset?: number;
      parent_task_id?: string;
    }
  ): Promise<{ tasks: TaskItem[]; total: number }>;

  updateTask(
    taskId: string,
    updates: {
      description?: string;
      status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
      priority?: number;
      due_date?: number;
      tags?: string[];
      completed_at?: number;
    }
  ): Promise<TaskItem>;

  completeTask(taskId: string): Promise<TaskItem>;

  deleteTask(taskId: string): Promise<{ success: boolean; id: string }>;
}

/**
 * Task item from memory service
 */
interface TaskItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: number;
  due_date: number | null;
  completed_at: number | null;
  parent_task_id: string | null;
  tags: string[];
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

/**
 * Extended CommandEnv with MEMORY_SERVICE binding
 */
interface TodoCommandEnv {
  OBSERVABILITY_DB?: D1Database;
  HEARTBEAT_KV?: KVNamespace;
  ENVIRONMENT?: string;
  MEMORY_SERVICE?: MemoryServiceTasks;
}

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '-';

  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (timestamp > now) {
    // Future timestamp (due date)
    if (days > 0) return `in ${days}d`;
    if (hours > 0) return `in ${hours}h`;
    if (minutes > 0) return `in ${minutes}m`;
    return 'soon';
  } else {
    // Past timestamp
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }
}

/**
 * Format task status icon
 */
function getStatusIcon(status: TaskItem['status']): string {
  switch (status) {
    case 'pending':
      return '📋';
    case 'in_progress':
      return '🔄';
    case 'blocked':
      return '🚫';
    case 'completed':
      return '✅';
    case 'cancelled':
      return '❌';
  }
}

/**
 * Format task priority icon
 */
function getPriorityIcon(priority: number): string {
  if (priority >= 8) return '🔴';
  if (priority >= 6) return '🟠';
  if (priority >= 4) return '🟡';
  return '🟢';
}

/**
 * Get user ID from context
 */
function getUserId(ctx: CommandContext): string {
  return String(ctx.state.userId ?? ctx.state.chatId ?? 'unknown');
}

/**
 * Parse priority from string (e.g., "priority:8")
 */
function parsePriority(args: string[]): number | undefined {
  for (const arg of args) {
    if (arg.startsWith('priority:')) {
      const value = Number.parseInt(arg.slice(9), 10);
      if (!Number.isNaN(value) && value >= 1 && value <= 10) {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Parse due date from string (e.g., "due:1234567890" or "due:tomorrow")
 */
function parseDueDate(args: string[]): number | undefined {
  for (const arg of args) {
    if (arg.startsWith('due:')) {
      const value = arg.slice(4);
      const timestamp = Number.parseInt(value, 10);
      if (!Number.isNaN(timestamp) && timestamp > Date.now() / 1000) {
        return timestamp * 1000; // Convert seconds to ms
      }
      // Handle relative dates
      const now = Date.now();
      const lower = value.toLowerCase();
      if (lower === 'tomorrow') return now + 24 * 60 * 60 * 1000;
      if (lower === 'today') return now + 12 * 60 * 60 * 1000; // End of today
      if (lower === 'week') return now + 7 * 24 * 60 * 60 * 1000;
    }
  }
  return undefined;
}

/**
 * Parse tags from string (e.g., "tags:work,urgent")
 */
function parseTags(args: string[]): string[] | undefined {
  for (const arg of args) {
    if (arg.startsWith('tags:')) {
      const tags = arg.slice(5).split(',');
      const cleaned = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
      if (cleaned.length > 0) return cleaned;
    }
  }
  return undefined;
}

/**
 * Extract task ID from args (first non-option arg)
 */
function extractTaskId(args: string[]): string | undefined {
  for (const arg of args) {
    if (!arg.startsWith('priority:') && !arg.startsWith('due:') && !arg.startsWith('tags:') && !arg.startsWith('status:')) {
      return arg;
    }
  }
  return undefined;
}

/**
 * Extract description from args (all non-option args after subcommand)
 */
function extractDescription(args: string[]): string {
  return args
    .filter((arg) => !arg.startsWith('priority:') && !arg.startsWith('due:') && !arg.startsWith('tags:'))
    .join(' ');
}

/**
 * Handle /todo add command
 */
async function handleTodoAdd(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const description = extractDescription(args);
  if (!description) {
    return '❌ Usage: /todo add <description> [priority:N] [due:timestamp] [tags:tag1,tag2]';
  }

  const userId = getUserId(ctx);
  const isHTML = ctx.parseMode === 'HTML';
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  try {
    const priority = parsePriority(args);
    const dueDate = parseDueDate(args);
    const tags = parseTags(args);

    const options: {
      priority?: number;
      due_date?: number;
      tags?: string[];
    } = {};
    if (priority !== undefined) options.priority = priority;
    if (dueDate !== undefined) options.due_date = dueDate;
    if (tags !== undefined) options.tags = tags;

    const task = await env.MEMORY_SERVICE.addTask(userId, description, options);

    return `✅ Task added (ID: ${esc(task.id.slice(0, 8))})\n\n${esc(task.description)}`;
  } catch (err) {
    logger.error('[TODO] addTask failed', { error: String(err), userId });
    return `❌ Failed to add task: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Handle /todo list command
 */
async function handleTodoList(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const userId = getUserId(ctx);
  const isHTML = ctx.parseMode === 'HTML';
  const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  // Parse status filter
  const validStatuses = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'] as const;
  const statusArg = args[0]?.toLowerCase();
  const statusFilter = validStatuses.includes(statusArg as any) ? (statusArg as any) : undefined;

  try {
    const { tasks, total } = await env.MEMORY_SERVICE.listTasks(userId, {
      status: statusFilter,
      limit: 20,
    });

    if (total === 0) {
      const statusText = statusFilter ? ` (${statusFilter})` : '';
      return `📋 No tasks found${statusText}`;
    }

    const lines: string[] = [`📋 ${bold('Tasks')}${statusFilter ? ` (${esc(statusFilter)})` : ''} (${total} total)\n`];

    // Group by status
    const grouped = tasks.reduce(
      (acc, task) => {
        if (!acc[task.status]) acc[task.status] = [];
        acc[task.status]!.push(task);
        return acc;
      },
      {} as Record<string, TaskItem[]>
    );

    const statusOrder: TaskItem['status'][] = ['in_progress', 'pending', 'blocked', 'completed', 'cancelled'];

    for (const status of statusOrder) {
      const statusTasks = grouped[status];
      if (!statusTasks || statusTasks.length === 0) continue;

      lines.push(`${bold(getStatusIcon(status) + ' ' + status.replace('_', ' ').toUpperCase())}`);

      for (const task of statusTasks) {
        const shortId = task.id.slice(0, 8);
        const priorityIcon = getPriorityIcon(task.priority);
        const tags = task.tags.length > 0 ? ` [${task.tags.map(esc).join(', ')}]` : '';
        const due = task.due_date ? ` 📅 ${formatRelativeTime(task.due_date)}` : '';

        lines.push(`${priorityIcon} ${esc(shortId)}: ${esc(task.description)}${tags}${due}`);
      }
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  } catch (err) {
    logger.error('[TODO] listTasks failed', { error: String(err), userId });
    return `❌ Failed to list tasks: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Handle /todo done command
 */
async function handleTodoDone(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const taskId = args[0];
  if (!taskId) {
    return '❌ Usage: /todo done <task_id>';
  }

  const isHTML = ctx.parseMode === 'HTML';
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  try {
    const task = await env.MEMORY_SERVICE.completeTask(taskId);
    return `✅ Task completed\n\n${esc(task.description)}`;
  } catch (err) {
    logger.error('[TODO] completeTask failed', { error: String(err), taskId });
    return `❌ Failed to complete task: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Handle /todo cancel command
 */
async function handleTodoCancel(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const taskId = args[0];
  if (!taskId) {
    return '❌ Usage: /todo cancel <task_id>';
  }

  const isHTML = ctx.parseMode === 'HTML';
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  try {
    const task = await env.MEMORY_SERVICE.updateTask(taskId, { status: 'cancelled' });
    return `❌ Task cancelled\n\n${esc(task.description)}`;
  } catch (err) {
    logger.error('[TODO] cancel failed', { error: String(err), taskId });
    return `❌ Failed to cancel task: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Handle /todo update command
 */
async function handleTodoUpdate(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const taskId = extractTaskId(args);
  if (!taskId) {
    return '❌ Usage: /todo update <task_id> [description|priority:N|status:STATUS]';
  }

  const isHTML = ctx.parseMode === 'HTML';
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  // Parse update options
  const updates: {
    description?: string;
    priority?: number;
    status?: TaskItem['status'];
  } = {};

  for (const arg of args) {
    if (arg.startsWith('priority:')) {
      const value = Number.parseInt(arg.slice(9), 10);
      if (!Number.isNaN(value) && value >= 1 && value <= 10) {
        updates.priority = value;
      }
    } else if (arg.startsWith('status:')) {
      const status = arg.slice(7);
      const validStatuses = ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'];
      if (validStatuses.includes(status)) {
        updates.status = status as TaskItem['status'];
      }
    }
  }

  // Description is everything that's not an option and not the task ID
  const description = args
    .filter((arg) => arg !== taskId && !arg.startsWith('priority:') && !arg.startsWith('status:'))
    .join(' ');
  if (description) {
    updates.description = description;
  }

  if (Object.keys(updates).length === 0) {
    return '❌ No updates provided. Use: /todo update <task_id> [description] [priority:N] [status:STATUS]';
  }

  try {
    const task = await env.MEMORY_SERVICE.updateTask(taskId, updates);
    const changes = Object.keys(updates).join(', ');
    return `✅ Task updated (${changes})\n\n${esc(task.description)}`;
  } catch (err) {
    logger.error('[TODO] updateTask failed', { error: String(err), taskId });
    return `❌ Failed to update task: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Handle /todo delete command
 */
async function handleTodoDelete(args: string[], ctx: CommandContext): Promise<string> {
  const env = ctx.env as TodoCommandEnv;
  if (!env.MEMORY_SERVICE) {
    return '❌ Memory service not available. Please configure MEMORY_SERVICE binding.';
  }

  const taskId = args[0];
  if (!taskId) {
    return '❌ Usage: /todo delete <task_id>';
  }

  const isHTML = ctx.parseMode === 'HTML';
  const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);
  const esc = (text: string) => (isHTML ? escapeHtml(text) : escapeMarkdownV2(text));

  try {
    await env.MEMORY_SERVICE.deleteTask(taskId);
    return `🗑️ Task deleted: ${code(taskId)}`;
  } catch (err) {
    logger.error('[TODO] deleteTask failed', { error: String(err), taskId });
    return `❌ Failed to delete task: ${esc(err instanceof Error ? err.message : String(err))}`;
  }
}

/**
 * Main /todo command handler
 */
export const handleTodoCommand: CommandHandler = async (text, ctx) => {
  const args = text.split(/\s+/).slice(1); // Remove '/todo'
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case 'add':
      return handleTodoAdd(args.slice(1), ctx);
    case 'list':
      return handleTodoList(args.slice(1), ctx);
    case 'done':
      return handleTodoDone(args.slice(1), ctx);
    case 'cancel':
      return handleTodoCancel(args.slice(1), ctx);
    case 'update':
      return handleTodoUpdate(args.slice(1), ctx);
    case 'delete':
      return handleTodoDelete(args.slice(1), ctx);
    default:
      // Show help
      const isHTML = ctx.parseMode === 'HTML';
      const bold = (text: string) => (isHTML ? `<b>${text}</b>` : `*${text}*`);
      const code = (text: string) => (isHTML ? `<code>${text}</code>` : `\`${text}\``);

      return [
        `${bold('Todo Commands')}\n`,
        `${code('/todo add')} <description> [priority:N] [due:timestamp] [tags:tag1,tag2]`,
        `${code('/todo list')} [pending|in_progress|blocked|completed|cancelled]`,
        `${code('/todo done')} <task_id>`,
        `${code('/todo cancel')} <task_id>`,
        `${code('/todo update')} <task_id> [description] [priority:N] [status:STATUS]`,
        `${code('/todo delete')} <task_id>`,
      ].join('\n');
  }
};
