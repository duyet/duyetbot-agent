/**
 * Task Picker Tests
 *
 * Tests for task picker with mocked source providers
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskPicker } from '../../src/tasks/picker.js';
import type { Task, TaskSourceProvider } from '../../src/tasks/types.js';

// Mock source providers
const createMockSource = (name: string, priority: number, tasks: Task[]): TaskSourceProvider => ({
  name: name as any,
  priority,
  listPending: vi.fn().mockResolvedValue(tasks),
  markComplete: vi.fn().mockResolvedValue(undefined),
  markFailed: vi.fn().mockResolvedValue(undefined),
});

const createMockTask = (id: string, source: string, priority: number, createdAt: number): Task => ({
  id,
  source: source as any,
  title: `Task ${id}`,
  description: `Description for ${id}`,
  priority,
  labels: [],
  status: 'pending',
  metadata: {},
  createdAt,
  updatedAt: Date.now(),
});

describe('TaskPicker', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should initialize all configured sources', () => {
      const picker = new TaskPicker({
        sources: ['github-issues', 'file', 'memory'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
        memoryMcpUrl: 'https://memory.example.com',
      });

      expect(picker).toBeDefined();
    });

    it('should warn for github-issues source without token', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        new TaskPicker({
          sources: ['github-issues'],
          repository: { owner: 'test', name: 'repo' },
        });
      }).toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('github-issues source requires')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should warn for file source without filePath', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        new TaskPicker({
          sources: ['file'],
        });
      }).toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('file source requires'));

      consoleWarnSpy.mockRestore();
    });

    it('should warn for memory source without memoryMcpUrl', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        new TaskPicker({
          sources: ['memory'],
        });
      }).toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('memory source requires')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error when no sources can be initialized', () => {
      expect(
        () =>
          new TaskPicker({
            sources: ['github-issues'],
          })
      ).toThrow('No task sources initialized');
    });

    it('should initialize partial configuration when some sources fail', () => {
      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      expect(picker).toBeDefined();
    });

    it('should warn about unknown source types', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new TaskPicker({
        sources: ['github-issues', 'unknown' as any],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown source type'));

      consoleWarnSpy.mockRestore();
    });
  });

  describe('pickNext', () => {
    it('should return null when no tasks available', async () => {
      const mockSource = createMockSource('github-issues', 3, []);

      const picker = new TaskPicker({
        sources: ['github-issues'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
      });

      // Replace the sources array with our mock
      (picker as any).sources = [mockSource];

      const task = await picker.pickNext();

      expect(task).toBeNull();
    });

    it('should pick highest priority task', async () => {
      const highPriorityTask = createMockTask('github-issues-1', 'github-issues', 1, Date.now());
      const lowPriorityTask = createMockTask('file-1', 'file', 5, Date.now());

      const githubSource = createMockSource('github-issues', 3, [highPriorityTask]);
      const fileSource = createMockSource('file', 2, [lowPriorityTask]);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      const task = await picker.pickNext();

      expect(task).toMatchObject({
        id: 'github-issues-1',
        priority: 1,
      });
    });

    it('should prioritize by source priority first', async () => {
      const lowPriorityTask = createMockTask('github-issues-1', 'github-issues', 5, Date.now());
      const highPriorityTask = createMockTask('file-1', 'file', 1, Date.now());

      const githubSource = createMockSource('github-issues', 3, [lowPriorityTask]);
      const fileSource = createMockSource('file', 2, [highPriorityTask]);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      const task = await picker.pickNext();

      // github-issues has higher source priority (3) vs file (2)
      expect(task).toMatchObject({
        id: 'github-issues-1',
      });
    });

    it('should prioritize by task priority when source priority equal', async () => {
      const task1 = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const task2 = createMockTask('github-issues-2', 'github-issues', 1, 2000);

      const githubSource = createMockSource('github-issues', 3, [task1, task2]);

      const picker = new TaskPicker({
        sources: ['github-issues'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
      });

      (picker as any).sources = [githubSource];

      const task = await picker.pickNext();

      // task2 has higher priority (1 is better than 5)
      expect(task).toMatchObject({
        id: 'github-issues-2',
      });
    });

    it('should prioritize newer tasks when priorities equal', async () => {
      const olderTask = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const newerTask = createMockTask('github-issues-2', 'github-issues', 5, 2000);

      const githubSource = createMockSource('github-issues', 3, [olderTask, newerTask]);

      const picker = new TaskPicker({
        sources: ['github-issues'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
      });

      (picker as any).sources = [githubSource];

      const task = await picker.pickNext();

      // newerTask has higher createdAt
      expect(task).toMatchObject({
        id: 'github-issues-2',
      });
    });

    it('should aggregate tasks from all sources', async () => {
      const task1 = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const task2 = createMockTask('file-1', 'file', 5, 1000);
      const task3 = createMockTask('memory-1', 'memory', 5, 1000);

      const githubSource = createMockSource('github-issues', 3, [task1]);
      const fileSource = createMockSource('file', 2, [task2]);
      const memorySource = createMockSource('memory', 1, [task3]);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file', 'memory'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
        memoryMcpUrl: 'https://memory.example.com',
      });

      (picker as any).sources = [githubSource, fileSource, memorySource];

      const allTasks = await picker.listAllPending();

      expect(allTasks).toHaveLength(3);
    });

    it('should handle errors from individual sources gracefully', async () => {
      const workingSource = createMockSource('file', 2, [
        createMockTask('file-1', 'file', 5, 1000),
      ]);

      const errorSource = {
        name: 'github-issues' as const,
        priority: 3,
        listPending: vi.fn().mockRejectedValue(new Error('API Error')),
        markComplete: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn().mockResolvedValue(undefined),
      };

      const picker = new TaskPicker({
        sources: ['file'], // Just initialize with working source
        tasksFilePath: '/test/TASKS.md',
      });

      // Manually set both sources
      (picker as any).sources = [errorSource, workingSource];

      // pickNext should throw error when any source fails
      await expect(picker.pickNext()).rejects.toThrow('API Error');
    });
  });

  describe('markComplete', () => {
    it('should delegate to correct source provider', async () => {
      const task = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const githubSource = createMockSource('github-issues', 3, [task]);
      const fileSource = createMockSource('file', 2, []);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      await picker.markComplete('github-issues-1');

      expect(githubSource.markComplete).toHaveBeenCalledWith('github-issues-1');
      expect(fileSource.markComplete).not.toHaveBeenCalled();
    });

    it('should throw error when source not found', async () => {
      const picker = new TaskPicker({
        sources: ['file'],
        tasksFilePath: '/test/TASKS.md',
      });

      await expect(picker.markComplete('unknown-1')).rejects.toThrow(
        'No source found for task ID: unknown-1'
      );
    });

    it('should find source by task ID prefix', async () => {
      const githubTask = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const fileTask = createMockTask('file-line-1', 'file', 5, 1000);

      const githubSource = createMockSource('github-issues', 3, [githubTask]);
      const fileSource = createMockSource('file', 2, [fileTask]);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      await picker.markComplete('github-issues-1');
      await picker.markComplete('file-line-1');

      expect(githubSource.markComplete).toHaveBeenCalledWith('github-issues-1');
      expect(fileSource.markComplete).toHaveBeenCalledWith('file-line-1');
    });
  });

  describe('markFailed', () => {
    it('should delegate to correct source provider with error', async () => {
      const task = createMockTask('github-issues-1', 'github-issues', 5, 1000);
      const githubSource = createMockSource('github-issues', 3, [task]);
      const fileSource = createMockSource('file', 2, []);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      await picker.markFailed('github-issues-1', 'Test error');

      expect(githubSource.markFailed).toHaveBeenCalledWith('github-issues-1', 'Test error');
      expect(fileSource.markFailed).not.toHaveBeenCalled();
    });

    it('should throw error when source not found', async () => {
      const picker = new TaskPicker({
        sources: ['file'],
        tasksFilePath: '/test/TASKS.md',
      });

      await expect(picker.markFailed('unknown-1', 'Error')).rejects.toThrow(
        'No source found for task ID: unknown-1'
      );
    });
  });

  describe('listAllPending', () => {
    it('should return all tasks from all sources', async () => {
      const githubTasks = [
        createMockTask('github-issues-1', 'github-issues', 5, 1000),
        createMockTask('github-issues-2', 'github-issues', 3, 2000),
      ];
      const fileTasks = [createMockTask('file-line-1', 'file', 5, 1000)];

      const githubSource = createMockSource('github-issues', 3, githubTasks);
      const fileSource = createMockSource('file', 2, fileTasks);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      const tasks = await picker.listAllPending();

      expect(tasks).toHaveLength(3);
    });

    it('should not filter or sort tasks', async () => {
      const githubTasks = [
        createMockTask('github-issues-1', 'github-issues', 5, 3000),
        createMockTask('github-issues-2', 'github-issues', 1, 1000),
      ];
      const fileTasks = [createMockTask('file-line-1', 'file', 10, 2000)];

      const githubSource = createMockSource('github-issues', 3, githubTasks);
      const fileSource = createMockSource('file', 2, fileTasks);

      const picker = new TaskPicker({
        sources: ['github-issues', 'file'],
        githubToken: 'ghp_test',
        repository: { owner: 'test', name: 'repo' },
        tasksFilePath: '/test/TASKS.md',
      });

      (picker as any).sources = [githubSource, fileSource];

      const tasks = await picker.listAllPending();

      // Tasks should be in source order (github then file)
      expect(tasks[0].id).toBe('github-issues-1');
      expect(tasks[1].id).toBe('github-issues-2');
      expect(tasks[2].id).toBe('file-line-1');
    });
  });
});
