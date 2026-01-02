/**
 * File Tasks Source Tests
 *
 * Tests for file-based task source with mocked fs operations
 */

import { readFile, writeFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileTasksSource } from '../../../src/tasks/sources/file-tasks.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('FileTasksSource', () => {
  let source: FileTasksSource;

  const mockOptions = {
    filePath: '/test/TASKS.md',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    source = new FileTasksSource(mockOptions);
  });

  describe('constructor', () => {
    it('should initialize with correct name and priority', () => {
      expect(source.name).toBe('file');
      expect(source.priority).toBe(2);
    });

    it('should store file path', () => {
      expect(source).toMatchObject({
        filePath: '/test/TASKS.md',
      });
    });
  });

  describe('listPending', () => {
    it('should parse unchecked checkboxes', async () => {
      const content = `
- [ ] Task 1
- [x] Completed task
- [ ] Task 2
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        source: 'file',
        title: 'Task 1',
        priority: 5,
        status: 'pending',
      });
      expect(tasks[1].title).toBe('Task 2');
    });

    it('should parse asterisk checkboxes', async () => {
      const content = `
* [ ] Task with asterisk
* [x] Completed asterisk task
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].title).toBe('Task with asterisk');
    });

    it('should extract priority from [P1] to [P10]', async () => {
      const content = `
- [ ] [P1] High priority task
- [ ] [P5] Medium priority task
- [ ] [P10] Max priority task
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].priority).toBe(1);
      expect(tasks[1].priority).toBe(5);
      expect(tasks[2].priority).toBe(10);
    });

    it('should clamp priority to 1-10 range', async () => {
      const content = `
- [ ] [P0] Below min
- [ ] [P15] Above max
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].priority).toBe(1);
      expect(tasks[1].priority).toBe(10);
    });

    it('should extract labels from hashtags', async () => {
      const content = `
- [ ] [P3] Task with #bug and #urgent labels
- [ ] Another #enhancement task
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].labels).toEqual(['bug', 'urgent']);
      expect(tasks[0].title).toBe('Task with  and  labels');
      expect(tasks[1].labels).toEqual(['enhancement']);
    });

    it('should remove hashtags from description', async () => {
      const content = `
- [ ] Task with #label in middle
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].description).toBe('Task with  in middle');
      expect(tasks[0].labels).toEqual(['label']);
    });

    it('should use default priority when no priority marker', async () => {
      const content = `
- [ ] Task without priority marker
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].priority).toBe(5);
    });

    it('should handle tasks with only priority and no labels', async () => {
      const content = `
- [ ] [P2] Simple task
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].priority).toBe(2);
      expect(tasks[0].labels).toEqual([]);
      expect(tasks[0].title).toBe('Simple task');
    });

    it('should generate correct task ID with line number', async () => {
      const content = `
# Header

- [ ] Task at line 3
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].id).toBe('file-line-3');
    });

    it('should skip empty lines', async () => {
      const content = `


- [ ] Task after empty lines
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks).toHaveLength(1);
    });

    it('should return empty array on file read error', async () => {
      (readFile as any).mockRejectedValue(new Error('File not found'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error reading tasks file'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle complex task descriptions', async () => {
      const content = `
- [ ] [P1] #urgent Complex task description that is longer than 80 characters and should be truncated in the title field
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].title.length).toBeLessThanOrEqual(80);
      expect(tasks[0].description.length).toBeGreaterThan(80);
    });

    it('should handle tasks with multiple hashtags', async () => {
      const content = `
- [ ] Task #bug #urgent #frontend #api
`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].labels).toEqual(['bug', 'urgent', 'frontend', 'api']);
    });
  });

  describe('markComplete', () => {
    it('should update checkbox from [ ] to [x]', async () => {
      const content = `- [ ] Task to complete\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markComplete('file-line-0');

      expect(writeFile).toHaveBeenCalledWith('/test/TASKS.md', `- [x] Task to complete\n`, 'utf-8');
    });

    it('should update asterisk checkbox', async () => {
      const content = `* [ ] Task with asterisk\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markComplete('file-line-0');

      expect(writeFile).toHaveBeenCalledWith(
        '/test/TASKS.md',
        `* [x] Task with asterisk\n`,
        'utf-8'
      );
    });

    it('should extract line number from task ID', async () => {
      const content = `- [ ] Task\n- [ ] Another\n- [ ] Third\n- [ ] Fourth\n- [ ] Fifth\n- [ ] Sixth\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markComplete('file-line-5');

      expect(readFile).toHaveBeenCalledWith('/test/TASKS.md', 'utf-8');
      expect(writeFile).toHaveBeenCalled();
    });

    it('should throw error for invalid task ID format', async () => {
      await expect(source.markComplete('invalid-id')).rejects.toThrow('Invalid file task ID');
    });

    it('should throw error when line number out of range', async () => {
      const content = `- [ ] Task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await expect(source.markComplete('file-line-10')).rejects.toThrow(
        'Line number 10 out of range'
      );
    });

    it('should preserve other line content when updating', async () => {
      const content = `- [ ] Task to complete\n- [ ] Other task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markComplete('file-line-0');

      const writtenContent = (writeFile as any).mock.calls[0][1];
      expect(writtenContent).toContain('- [x] Task to complete');
      expect(writtenContent).toContain('- [ ] Other task');
    });
  });

  describe('markFailed', () => {
    it('should insert error comment below task line', async () => {
      const content = `- [ ] Task that failed\n- [ ] Next task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markFailed('file-line-0', 'Test error');

      const writtenContent = (writeFile as any).mock.calls[0][1];
      expect(writtenContent).toContain('- [ ] Task that failed');
      expect(writtenContent).toContain('  > ❌ Failed: Test error');
      expect(writtenContent).toContain('- [ ] Next task');
    });

    it('should insert error at correct position', async () => {
      const content = `- [ ] First task\n- [ ] Second task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markFailed('file-line-1', 'Error on second');

      const writtenContent = (writeFile as any).mock.calls[0][1];
      const lines = writtenContent.split('\n');

      expect(lines[0]).toBe('- [ ] First task');
      expect(lines[1]).toBe('- [ ] Second task');
      expect(lines[2]).toBe('  > ❌ Failed: Error on second');
    });

    it('should throw error on file read failure', async () => {
      (readFile as any).mockRejectedValue(new Error('Read error'));

      await expect(source.markFailed('file-line-0', 'Test error')).rejects.toThrow('Read error');
    });

    it('should log error on write failure', async () => {
      const content = `- [ ] Task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockRejectedValue(new Error('Write error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(source.markFailed('file-line-0', 'Test error')).rejects.toThrow('Write error');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error marking task failed'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('extractLineNumber', () => {
    it('should extract line number from valid task ID', async () => {
      const content = `- [ ] Task\n`;
      (readFile as any).mockResolvedValue(content);
      (writeFile as any).mockResolvedValue(undefined);

      await source.markComplete('file-line-0');

      expect(readFile).toHaveBeenCalled();
    });

    it('should throw error for malformed task ID', async () => {
      await expect(source.markComplete('file-line-')).rejects.toThrow('Invalid file task ID');
    });

    it('should throw error for non-numeric line number', async () => {
      await expect(source.markComplete('file-line-abc')).rejects.toThrow();
    });
  });

  describe('metadata', () => {
    it('should include filePath in metadata', async () => {
      const content = `- [ ] Task\n`;
      (readFile as any).mockResolvedValue(content);

      const tasks = await source.listPending();

      expect(tasks[0].metadata).toMatchObject({
        filePath: '/test/TASKS.md',
        lineNumber: 0,
      });
    });

    it('should include timestamps in metadata', async () => {
      const content = `- [ ] Task\n`;
      (readFile as any).mockResolvedValue(content);

      const beforeTime = Date.now();
      const tasks = await source.listPending();
      const afterTime = Date.now();

      expect(tasks[0].createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(tasks[0].createdAt).toBeLessThanOrEqual(afterTime);
      expect(tasks[0].updatedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(tasks[0].updatedAt).toBeLessThanOrEqual(afterTime);
    });
  });
});
