/**
 * Kanban Task Types
 *
 * Task management types for the Kanban dashboard.
 * Maps to the memory-mcp task schema.
 */

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export type DateFilterType = 'overdue' | 'today' | 'this_week' | 'this_month' | null;

export interface TaskFilters {
  searchQuery: string;
  priorityFilter: 'high' | 'medium' | 'low' | null;
  tagFilters: string[];
  dateFilter: DateFilterType;
}

export interface TaskItem {
  id: string;
  description: string;
  status: TaskStatus;
  priority: number; // 1-10
  due_date: number | null;
  completed_at: number | null;
  parent_task_id: string | null;
  tags: string[];
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

export type ColumnId = 'backlog' | 'in_progress' | 'done' | 'cancelled';

export interface Column {
  id: ColumnId;
  title: string;
  status: TaskStatus[];
  color: string;
}

export const COLUMNS: Column[] = [
  { id: 'backlog', title: 'Backlog', status: ['pending', 'blocked'], color: 'amber' },
  { id: 'in_progress', title: 'In Progress', status: ['in_progress'], color: 'blue' },
  { id: 'done', title: 'Done', status: ['completed'], color: 'emerald' },
  { id: 'cancelled', title: 'Cancelled', status: ['cancelled'], color: 'slate' },
];

export interface AddTaskInput {
  description: string;
  priority?: number;
  due_date?: number;
  tags?: string[];
  parent_task_id?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  id: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  due_date?: number;
  tags?: string[];
  completed_at?: number;
}

export interface ListTasksInput {
  status?: TaskStatus;
  limit?: number;
  offset?: number;
  parent_task_id?: string;
}

export interface TasksResponse {
  tasks: TaskItem[];
  total: number;
}
