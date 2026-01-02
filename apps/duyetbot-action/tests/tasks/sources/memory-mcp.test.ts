/**
 * Memory MCP Source Tests
 *
 * Tests for memory MCP task source with mocked fetch
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryMcpSource } from '../../../src/tasks/sources/memory-mcp.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('MemoryMcpSource', () => {
  let source: MemoryMcpSource;

  const mockOptions = {
    baseUrl: 'https://memory.example.com',
    userId: 'test-user',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    source = new MemoryMcpSource(mockOptions);
  });

  describe('constructor', () => {
    it('should initialize with correct name and priority', () => {
      expect(source.name).toBe('memory');
      expect(source.priority).toBe(1);
    });

    it('should remove trailing slash from baseUrl', () => {
      const sourceWithSlash = new MemoryMcpSource({
        baseUrl: 'https://memory.example.com/',
      });
      expect(sourceWithSlash).toMatchObject({
        baseUrl: 'https://memory.example.com',
      });
    });

    it('should use default userId if not provided', () => {
      const sourceWithoutUser = new MemoryMcpSource({
        baseUrl: 'https://memory.example.com',
      });
      expect(sourceWithoutUser).toMatchObject({
        userId: 'github-actions-agent',
      });
    });

    it('should use provided userId', () => {
      expect(source.userId).toBe('test-user');
    });
  });

  describe('listPending', () => {
    it('should fetch pending tasks from memory-mcp API', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test task 1',
          status: 'pending',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: ['bug', 'urgent'],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
        {
          id: 'task-2',
          description: 'Test task 2',
          status: 'pending',
          priority: 1,
          due_date: 1704240000000,
          completed_at: null,
          parent_task_id: 'task-1',
          tags: ['enhancement'],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: { key: 'value' },
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://memory.example.com/api/tasks',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('"action":"list"'),
        })
      );

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        id: 'task-1',
        source: 'memory',
        title: 'Test task 1',
        description: 'Test task 1',
        priority: 5,
        labels: ['bug', 'urgent'],
        status: 'pending',
      });
      expect(tasks[0].metadata).toMatchObject({
        dueDate: null,
        completedAt: null,
        parentTaskId: null,
      });
    });

    it('should send correct request parameters', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: [] }),
      });

      await source.listPending();

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toMatchObject({
        action: 'list',
        params: {
          status: 'pending',
          limit: 100,
        },
        userId: 'test-user',
      });
    });

    it('should handle empty tasks list', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: [] }),
      });

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
    });

    it('should handle missing tasks field', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching memory-mcp tasks:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should return empty array on non-OK response', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);

      consoleSpy.mockRestore();
    });

    it('should truncate title to 80 characters', async () => {
      const longDescription = 'a'.repeat(100);

      const mockTasks = [
        {
          id: 'task-1',
          description: longDescription,
          status: 'pending',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].title.length).toBe(80);
      expect(tasks[0].description.length).toBe(100);
    });

    it('should parse timestamps correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test task',
          status: 'pending',
          priority: 5,
          due_date: 1704240000000,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].createdAt).toBe(1704067200000);
      expect(tasks[0].updatedAt).toBe(1704153600000);
      expect(tasks[0].metadata.dueDate).toBe(1704240000000);
    });

    it('should include metadata from task', async () => {
      const customMetadata = { key1: 'value1', key2: 42 };

      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test task',
          status: 'pending',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: customMetadata,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].metadata).toMatchObject(customMetadata);
    });
  });

  describe('markComplete', () => {
    it('should send complete action to API', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await source.markComplete('task-1');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toMatchObject({
        action: 'complete',
        params: {
          id: 'task-1',
        },
        userId: 'test-user',
      });
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(source.markComplete('task-1')).rejects.toThrow(
        'Failed to mark task complete: 500'
      );
    });

    it('should log error on network failure', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(source.markComplete('task-1')).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Error marking task complete:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('markFailed', () => {
    it('should send update action with cancelled status', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await source.markFailed('task-1', 'Test error message');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toMatchObject({
        action: 'update',
        params: {
          id: 'task-1',
          status: 'cancelled',
          metadata: {
            error: 'Test error message',
            failedAt: expect.any(Number),
          },
        },
        userId: 'test-user',
      });
    });

    it('should include error in metadata', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await source.markFailed('task-1', 'Something went wrong');

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.params.metadata.error).toBe('Something went wrong');
    });

    it('should include failedAt timestamp', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const beforeTime = Date.now();
      await source.markFailed('task-1', 'Error');
      const afterTime = Date.now();

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.params.metadata.failedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(body.params.metadata.failedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(source.markFailed('task-1', 'Test error')).rejects.toThrow(
        'Failed to mark task failed: 500'
      );
    });

    it('should log error on network failure', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(source.markFailed('task-1', 'Error')).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Error marking task failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('mapStatus', () => {
    it('should map pending to pending', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test',
          status: 'pending',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].status).toBe('pending');
    });

    it('should map blocked to pending', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test',
          status: 'blocked',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].status).toBe('pending');
    });

    it('should map in_progress to in_progress', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test',
          status: 'in_progress',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].status).toBe('in_progress');
    });

    it('should map completed to completed', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test',
          status: 'completed',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].status).toBe('completed');
    });

    it('should map cancelled to failed', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          description: 'Test',
          status: 'cancelled',
          priority: 5,
          due_date: null,
          completed_at: null,
          parent_task_id: null,
          tags: [],
          created_at: 1704067200000,
          updated_at: 1704153600000,
          metadata: null,
        },
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const tasks = await source.listPending();

      expect(tasks[0].status).toBe('failed');
    });
  });
});
