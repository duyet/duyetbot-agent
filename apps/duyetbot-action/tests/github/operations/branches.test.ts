/**
 * Branch Operations Tests
 *
 * Tests for branch operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  branchExists,
  compareBranches,
  createBranch,
  deleteBranch,
  getBranch,
  getDefaultBranch,
  listBranches,
  mergeBranch,
} from '../../../src/github/operations/branches.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    git: {
      getRef: vi.fn(),
      createRef: vi.fn(),
      deleteRef: vi.fn(),
    },
    repos: {
      getBranch: vi.fn(),
      listBranches: vi.fn(),
      get: vi.fn(),
      compareCommits: vi.fn(),
      merge: vi.fn(),
    },
  },
} as any;

describe('branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBranch', () => {
    it('should create branch from SHA', async () => {
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          object: {
            sha: 'abc123',
            url: 'https://api.github.com/repos/owner/repo/git/refs/heads/feature',
          },
        },
      });

      const result = await createBranch(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        branchName: 'feature',
        sha: 'abc123',
      });

      expect(result).toEqual({
        name: 'feature',
        sha: 'abc123',
        url: 'https://api.github.com/repos/owner/repo/git/refs/heads/feature',
      });
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/heads/feature',
        sha: 'abc123',
      });
    });

    it('should create branch from another branch', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: {
          object: { sha: 'def456' },
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          object: {
            sha: 'def456',
            url: 'https://api.github.com/repos/owner/repo/git/refs/heads/feature',
          },
        },
      });

      const result = await createBranch(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        branchName: 'feature',
        fromBranch: 'develop',
      });

      expect(result.sha).toBe('def456');
      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/develop',
      });
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/heads/feature',
        sha: 'def456',
      });
    });

    it('should create branch from default branch', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: {
          object: { sha: 'main123' },
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({
        data: {
          object: {
            sha: 'main123',
            url: 'https://api.github.com/repos/owner/repo/git/refs/heads/feature',
          },
        },
      });

      await createBranch(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        branchName: 'feature',
      });

      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/main',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.createRef.mockRejectedValue(new Error('Branch already exists'));

      await expect(
        createBranch(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          branchName: 'feature',
          sha: 'abc123',
        })
      ).rejects.toThrow('Branch already exists');
    });
  });

  describe('deleteBranch', () => {
    it('should delete branch successfully', async () => {
      mockOctokit.rest.git.deleteRef.mockResolvedValue({});

      await deleteBranch(mockOctokit, 'owner', 'repo', 'feature');

      expect(mockOctokit.rest.git.deleteRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/feature',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.deleteRef.mockRejectedValue(new Error('Branch not found'));

      await expect(deleteBranch(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Branch not found'
      );
    });
  });

  describe('getBranch', () => {
    it('should get branch details', async () => {
      mockOctokit.rest.repos.getBranch.mockResolvedValue({
        data: {
          name: 'main',
          commit: {
            sha: 'abc123',
            url: 'https://api.github.com/repos/owner/repo/git/commits/abc123',
          },
          protected: true,
        },
      });

      const result = await getBranch(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toEqual({
        name: 'main',
        sha: 'abc123',
        url: 'https://api.github.com/repos/owner/repo/git/commits/abc123',
        protected: true,
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.getBranch.mockRejectedValue(new Error('Branch not found'));

      await expect(getBranch(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Branch not found'
      );
    });
  });

  describe('listBranches', () => {
    it('should list all branches', async () => {
      mockOctokit.rest.repos.listBranches.mockResolvedValue({
        data: [
          {
            name: 'main',
            commit: { sha: 'abc123' },
            protected: true,
          },
          {
            name: 'develop',
            commit: { sha: 'def456' },
            protected: false,
          },
          {
            name: 'feature',
            commit: { sha: 'ghi789' },
          },
        ],
      });

      const result = await listBranches(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        name: 'main',
        sha: 'abc123',
        protected: true,
      });
      expect(result[2]).toEqual({
        name: 'feature',
        sha: 'ghi789',
        protected: false,
      });
    });

    it('should list only protected branches', async () => {
      mockOctokit.rest.repos.listBranches.mockResolvedValue({
        data: [
          {
            name: 'main',
            commit: { sha: 'abc123' },
            protected: true,
          },
        ],
      });

      const result = await listBranches(mockOctokit, 'owner', 'repo', true);

      expect(result).toHaveLength(1);
      expect(mockOctokit.rest.repos.listBranches).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        protected: true,
      });
    });

    it('should handle empty branch list', async () => {
      mockOctokit.rest.repos.listBranches.mockResolvedValue({
        data: [],
      });

      const result = await listBranches(mockOctokit, 'owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.listBranches.mockRejectedValue(new Error('Repository not found'));

      await expect(listBranches(mockOctokit, 'owner', 'repo')).rejects.toThrow(
        'Repository not found'
      );
    });
  });

  describe('branchExists', () => {
    it('should return true for existing branch', async () => {
      mockOctokit.rest.repos.getBranch.mockResolvedValue({
        data: {
          name: 'main',
          commit: { sha: 'abc123', url: 'url' },
          protected: false,
        },
      });

      const result = await branchExists(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      mockOctokit.rest.repos.getBranch.mockRejectedValue(new Error('Branch not found'));

      const result = await branchExists(mockOctokit, 'owner', 'repo', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('getDefaultBranch', () => {
    it('should get default branch name', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          default_branch: 'main',
        },
      });

      const result = await getDefaultBranch(mockOctokit, 'owner', 'repo');

      expect(result).toBe('main');
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('Repository not found'));

      await expect(getDefaultBranch(mockOctokit, 'owner', 'repo')).rejects.toThrow(
        'Repository not found'
      );
    });
  });

  describe('compareBranches', () => {
    it('should compare two branches', async () => {
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: {
          ahead_by: 5,
          behind_by: 2,
          status: 'diverged',
          files: [{ filename: 'file1.ts' }, { filename: 'file2.ts' }, { filename: 'file3.ts' }],
        },
      });

      const result = await compareBranches(mockOctokit, 'owner', 'repo', 'main', 'feature');

      expect(result).toEqual({
        aheadBy: 5,
        behindBy: 2,
        diverged: true,
        filesChanged: 3,
      });
    });

    it('should handle identical branches', async () => {
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: {
          ahead_by: 0,
          behind_by: 0,
          status: 'identical',
          files: [],
        },
      });

      const result = await compareBranches(mockOctokit, 'owner', 'repo', 'main', 'main');

      expect(result).toEqual({
        aheadBy: 0,
        behindBy: 0,
        diverged: false,
        filesChanged: 0,
      });
    });

    it('should handle null files', async () => {
      mockOctokit.rest.repos.compareCommits.mockResolvedValue({
        data: {
          ahead_by: 3,
          behind_by: 1,
          status: 'ahead',
          files: null,
        },
      });

      const result = await compareBranches(mockOctokit, 'owner', 'repo', 'main', 'feature');

      expect(result.filesChanged).toBe(0);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.compareCommits.mockRejectedValue(new Error('Branch not found'));

      await expect(
        compareBranches(mockOctokit, 'owner', 'repo', 'main', 'nonexistent')
      ).rejects.toThrow('Branch not found');
    });
  });

  describe('mergeBranch', () => {
    it('should merge branch successfully', async () => {
      mockOctokit.rest.repos.merge.mockResolvedValue({
        data: {
          sha: 'merged123',
        },
      });

      const result = await mergeBranch(mockOctokit, 'owner', 'repo', 'main', 'feature');

      expect(result).toEqual({
        merged: true,
        sha: 'merged123',
      });
      expect(mockOctokit.rest.repos.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base: 'main',
        head: 'feature',
      });
    });

    it('should merge branch with commit message', async () => {
      mockOctokit.rest.repos.merge.mockResolvedValue({
        data: {
          sha: 'merged123',
        },
      });

      await mergeBranch(mockOctokit, 'owner', 'repo', 'main', 'feature', 'Merge feature branch');

      expect(mockOctokit.rest.repos.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base: 'main',
        head: 'feature',
        commit_message: 'Merge feature branch',
      });
    });

    it('should handle merge conflicts', async () => {
      mockOctokit.rest.repos.merge.mockRejectedValue(new Error('Merge conflict'));

      await expect(mergeBranch(mockOctokit, 'owner', 'repo', 'main', 'feature')).rejects.toThrow(
        'Merge conflict'
      );
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.merge.mockRejectedValue(new Error('Base branch not found'));

      await expect(
        mergeBranch(mockOctokit, 'owner', 'repo', 'nonexistent', 'feature')
      ).rejects.toThrow('Base branch not found');
    });
  });
});
