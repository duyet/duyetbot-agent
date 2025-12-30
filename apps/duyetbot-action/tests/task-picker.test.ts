/**
 * Task Picker Tests
 *
 * Tests for the multi-source task aggregation system
 */

import { describe, expect, it } from 'vitest';
import type { Task, TaskSource, TaskSourceProvider } from '../src/tasks/types.js';

// Mock task source for testing
class MockTaskSource implements TaskSourceProvider {
  constructor(
    public readonly name: TaskSource,
    public readonly priority: number,
    private tasks: Task[] = []
  ) {}

  async listPending(): Promise<Task[]> {
    return this.tasks.filter((t) => t.status === 'pending');
  }

  async markComplete(taskId: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = 'completed';
    }
  }

  async markFailed(taskId: string, _error: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task) {
      task.status = 'failed';
    }
  }
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `test-${Date.now()}`,
    source: 'file',
    title: 'Test Task',
    description: 'Test task description',
    priority: 5,
    labels: [],
    status: 'pending',
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('TaskSourceProvider interface', () => {
  describe('MockTaskSource', () => {
    it('should list pending tasks', async () => {
      const source = new MockTaskSource('file', 2, [
        createTask({ id: 'task-1', status: 'pending' }),
        createTask({ id: 'task-2', status: 'completed' }),
        createTask({ id: 'task-3', status: 'pending' }),
      ]);

      const pending = await source.listPending();

      expect(pending).toHaveLength(2);
      expect(pending.map((t) => t.id)).toEqual(['task-1', 'task-3']);
    });

    it('should mark task as completed', async () => {
      const task = createTask({ id: 'task-1', status: 'pending' });
      const source = new MockTaskSource('file', 2, [task]);

      await source.markComplete('task-1');

      expect(task.status).toBe('completed');
    });

    it('should mark task as failed', async () => {
      const task = createTask({ id: 'task-1', status: 'pending' });
      const source = new MockTaskSource('file', 2, [task]);

      await source.markFailed('task-1', 'Test error');

      expect(task.status).toBe('failed');
    });
  });
});

describe('Task priority sorting', () => {
  it('should sort by priority (higher first)', () => {
    const tasks = [
      createTask({ id: 'low', priority: 1 }),
      createTask({ id: 'high', priority: 10 }),
      createTask({ id: 'medium', priority: 5 }),
    ];

    const sorted = tasks.sort((a, b) => b.priority - a.priority);

    expect(sorted.map((t) => t.id)).toEqual(['high', 'medium', 'low']);
  });

  it('should sort by createdAt when priority is equal', () => {
    const now = Date.now();
    const tasks = [
      createTask({ id: 'older', priority: 5, createdAt: now - 1000 }),
      createTask({ id: 'newer', priority: 5, createdAt: now }),
    ];

    // Sort by priority desc, then by createdAt desc (newer first)
    const sorted = tasks.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return b.createdAt - a.createdAt;
    });

    expect(sorted.map((t) => t.id)).toEqual(['newer', 'older']);
  });
});
