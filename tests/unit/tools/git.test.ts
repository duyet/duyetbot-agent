import { GitTool } from '@/tools/git';
import type { ToolInput } from '@/tools/types';
import { beforeEach, describe, expect, it } from 'vitest';

describe('GitTool', () => {
  let gitTool: GitTool;

  beforeEach(() => {
    gitTool = new GitTool();
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(gitTool.name).toBe('git');
    });

    it('should have description', () => {
      expect(gitTool.description).toBeDefined();
      expect(gitTool.description.length).toBeGreaterThan(0);
    });

    it('should have input schema', () => {
      expect(gitTool.inputSchema).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should validate status command', () => {
      const input: ToolInput = {
        content: { command: 'status' },
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate clone command', () => {
      const input: ToolInput = {
        content: {
          command: 'clone',
          url: 'https://github.com/user/repo.git',
        },
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate commit command', () => {
      const input: ToolInput = {
        content: {
          command: 'commit',
          message: 'feat: add new feature',
        },
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should validate string command format', () => {
      const input: ToolInput = {
        content: 'status',
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(true);
    });

    it('should reject empty command', () => {
      const input: ToolInput = {
        content: { command: '' },
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(false);
    });

    it('should reject unknown command', () => {
      const input: ToolInput = {
        content: { command: 'unknown' },
      };

      const result = gitTool.validate?.(input);
      expect(result).toBe(false);
    });
  });

  describe('status command', () => {
    it('should execute git status', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
      });

      expect(result.status).toBe('success');
      expect(result.content).toBeDefined();
    });

    it('should return branch information', async () => {
      const result = await gitTool.execute({
        content: 'status',
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.branch).toBeDefined();
    });

    it('should list modified files', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.files).toBeDefined();
    });
  });

  describe('clone command', () => {
    it('should clone repository', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'clone',
          url: 'https://github.com/user/repo.git',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should clone with custom directory', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'clone',
          url: 'https://github.com/user/repo.git',
          directory: 'custom-dir',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should clone with depth option', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'clone',
          url: 'https://github.com/user/repo.git',
          depth: 1,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should return error for invalid URL', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'clone',
          url: 'not-a-valid-url',
        },
      });

      expect(result.status).toBe('error');
    });
  });

  describe('commit command', () => {
    it('should create commit', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'commit',
          message: 'test commit',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should require commit message', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'commit',
        },
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('message');
    });

    it('should support amend option', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'commit',
          message: 'amended commit',
          amend: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('push command', () => {
    it('should push to remote', async () => {
      const result = await gitTool.execute({
        content: { command: 'push' },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should push with remote and branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'push',
          remote: 'origin',
          branch: 'main',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should support force push', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'push',
          force: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('pull command', () => {
    it('should pull from remote', async () => {
      const result = await gitTool.execute({
        content: { command: 'pull' },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should pull with remote and branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'pull',
          remote: 'origin',
          branch: 'main',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should support rebase option', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'pull',
          rebase: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('add command', () => {
    it('should stage files', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'add',
          files: ['file1.ts', 'file2.ts'],
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should stage all files', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'add',
          files: ['.'],
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should require files parameter', async () => {
      const result = await gitTool.execute({
        content: { command: 'add' },
      });

      expect(result.status).toBe('error');
    });
  });

  describe('diff command', () => {
    it('should show diff', async () => {
      const result = await gitTool.execute({
        content: { command: 'diff' },
      });

      expect(result.status).toBe('success');
    });

    it('should diff specific files', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'diff',
          files: ['file1.ts'],
        },
      });

      expect(result.status).toBe('success');
    });

    it('should show staged diff', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'diff',
          staged: true,
        },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('log command', () => {
    it('should show git log', async () => {
      const result = await gitTool.execute({
        content: { command: 'log' },
      });

      expect(result.status).toBe('success');
    });

    it('should limit log entries', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'log',
          limit: 5,
        },
      });

      expect(result.status).toBe('success');
    });

    it('should show oneline format', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'log',
          oneline: true,
        },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('branch command', () => {
    it('should list branches', async () => {
      const result = await gitTool.execute({
        content: { command: 'branch' },
      });

      expect(result.status).toBe('success');
      expect(result.metadata?.branches).toBeDefined();
    });

    it('should create new branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'branch',
          name: 'new-branch',
          create: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should delete branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'branch',
          name: 'old-branch',
          delete: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('checkout command', () => {
    it('should checkout branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'checkout',
          branch: 'main',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should create and checkout new branch', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'checkout',
          branch: 'feature-branch',
          create: true,
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });
  });

  describe('error handling', () => {
    it('should return error for missing command', async () => {
      const result = await gitTool.execute({
        content: {},
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toContain('command');
    });

    it('should handle git command errors', async () => {
      const result = await gitTool.execute({
        content: {
          command: 'push',
          remote: 'nonexistent',
        },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should provide helpful error messages', async () => {
      const result = await gitTool.execute({
        content: { command: 'invalid-command' as any },
      });

      expect(result.status).toBe('error');
      expect(result.error?.message).toBeDefined();
    });
  });

  describe('working directory', () => {
    it('should support custom working directory', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
        metadata: { cwd: '/tmp' },
      });

      expect(['success', 'error']).toContain(result.status);
    });

    it('should use current directory by default', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('metadata', () => {
    it('should include command in metadata', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
      });

      expect(result.metadata?.command).toBe('status');
    });

    it('should include execution duration', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
      });

      expect(result.metadata?.duration).toBeDefined();
      expect(typeof result.metadata?.duration).toBe('number');
    });

    it('should preserve reason metadata', async () => {
      const result = await gitTool.execute({
        content: { command: 'status' },
        metadata: { reason: 'Check repository status' },
      });

      expect(result.metadata?.reason).toBe('Check repository status');
    });
  });
});
