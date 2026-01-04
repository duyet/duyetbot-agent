/**
 * TodoManager
 *
 * In-memory task list manager for multi-step operations
 */

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  createdAt: number;
  updatedAt: number;
}

export interface TodoList {
  id: string;
  title: string | undefined;
  items: Map<string, TodoItem>;
  createdAt: number;
  updatedAt: number;
}

export interface TodoStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

export class TodoManager {
  lists: Map<string, TodoList> = new Map();

  createList(title?: string): string {
    const id = this.generateId();
    const list: TodoList = {
      id,
      title,
      items: new Map(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.lists.set(id, list);
    return id;
  }

  addTodo(
    listId: string,
    content?: string,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): string {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`List ${listId} not found`);
    }

    const todoId = this.generateId();
    const item: TodoItem = {
      id: todoId,
      content: content || '',
      status: 'pending',
      priority,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.items.set(todoId, item);
    list.updatedAt = Date.now();
    return todoId;
  }

  updateTodo(
    listId: string,
    todoId: string,
    updates: Partial<Pick<TodoItem, 'status' | 'priority' | 'content'>>
  ): void {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`List ${listId} not found`);
    }

    const item = list.items.get(todoId);
    if (!item) {
      throw new Error(`Todo ${todoId} not found in list ${listId}`);
    }

    Object.assign(item, updates, { updatedAt: Date.now() });
    list.updatedAt = Date.now();
  }

  removeList(listId: string): void {
    this.lists.delete(listId);
  }

  clearCompleted(listId: string): void {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`List ${listId} not found`);
    }

    for (const [id, item] of list.items.entries()) {
      if (item.status === 'completed') {
        list.items.delete(id);
      }
    }
    list.updatedAt = Date.now();
  }

  getList(listId: string): TodoList | undefined {
    return this.lists.get(listId);
  }

  getFormattedList(listId: string): string {
    const list = this.lists.get(listId);
    if (!list) {
      throw new Error(`List ${listId} not found`);
    }

    const lines: string[] = [list.title ? `**${list.title}**` : `**TODO List ${listId}**`, ''];

    if (list.items.size === 0) {
      lines.push('No items');
    } else {
      for (const [id, item] of list.items.entries()) {
        const statusIcon =
          {
            pending: '⏳',
            in_progress: '🔄',
            completed: '✅',
            cancelled: '❌',
          }[item.status] || '⏳';

        const priorityIcon =
          {
            high: '🔴',
            medium: '🟡',
            low: '🟢',
          }[item.priority] || '🟡';

        lines.push(`${statusIcon} ${priorityIcon} ${id}: ${item.content}`);
      }
    }

    return lines.join('\n');
  }

  getStats(listId: string): TodoStats | undefined {
    const list = this.lists.get(listId);
    if (!list) {
      return undefined;
    }

    let completed = 0;
    let inProgress = 0;
    let pending = 0;

    for (const item of list.items.values()) {
      if (item.status === 'completed') completed++;
      else if (item.status === 'in_progress') inProgress++;
      else if (item.status === 'pending') pending++;
    }

    return {
      total: list.items.size,
      completed,
      inProgress,
      pending,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }
}
