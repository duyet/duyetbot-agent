/**
 * Pull Request Operations Tests
 *
 * Tests for pull request operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPR,
  createReview,
  getPR,
  listPRs,
  listReviews,
  mergePR,
  requestReview,
  updatePR,
} from '../../../src/github/operations/pulls.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    pulls: {
      create: vi.fn(),
      update: vi.fn(),
      merge: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      requestReviewers: vi.fn(),
      createReview: vi.fn(),
      listReviews: vi.fn(),
    },
    git: {
      deleteRef: vi.fn(),
    },
  },
} as any;

// Mock deleteBranch from branches module
vi.mock('../../../src/github/operations/branches.js', () => ({
  deleteBranch: vi.fn(),
}));

import { deleteBranch as deleteBranchMock } from '../../../src/github/operations/branches.js';

describe('pulls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPR', () => {
    it('should create PR with all fields', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          state: 'open',
          mergeable: true,
          head: { sha: 'abc123' },
        },
      });

      const result = await createPR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'PR body',
        head: 'feature-branch',
        base: 'main',
        draft: true,
      });

      expect(result).toEqual({
        number: 123,
        htmlUrl: 'https://github.com/owner/repo/pull/123',
        state: 'open',
        mergeable: true,
        headSha: 'abc123',
      });
      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'PR body',
        head: 'feature-branch',
        base: 'main',
        draft: true,
      });
    });

    it('should create PR without draft', async () => {
      mockOctokit.rest.pulls.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          state: 'open',
          mergeable: true,
          head: { sha: 'abc123' },
        },
      });

      await createPR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'PR body',
        head: 'feature-branch',
        base: 'main',
      });

      expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test PR',
        body: 'PR body',
        head: 'feature-branch',
        base: 'main',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.create.mockRejectedValue(new Error('Branch not found'));

      await expect(
        createPR(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          title: 'Test PR',
          body: 'PR body',
          head: 'feature-branch',
          base: 'main',
        })
      ).rejects.toThrow('Branch not found');
    });
  });

  describe('updatePR', () => {
    it('should update PR with all fields', async () => {
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      await updatePR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        title: 'Updated Title',
        body: 'Updated body',
        state: 'open',
        base: 'develop',
      });

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        title: 'Updated Title',
        body: 'Updated body',
        state: 'open',
        base: 'develop',
      });
    });

    it('should update PR with partial fields', async () => {
      mockOctokit.rest.pulls.update.mockResolvedValue({});

      await updatePR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        state: 'closed',
      });

      expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        state: 'closed',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.update.mockRejectedValue(new Error('PR not found'));

      await expect(
        updatePR(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          pullNumber: 999,
          state: 'closed',
        })
      ).rejects.toThrow('PR not found');
    });
  });

  describe('mergePR', () => {
    it('should merge PR successfully', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          head: { ref: 'feature-branch' },
        },
      });
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          merged: true,
          sha: 'merged123',
        },
      });

      const result = await mergePR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        mergeMethod: 'squash',
      });

      expect(result).toEqual({
        merged: true,
        sha: 'merged123',
      });
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'squash',
      });
    });

    it('should merge PR and delete branch', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main' },
          number: 123,
          html_url: 'url',
          state: 'open',
          mergeable: true,
          title: 'PR',
          body: '',
          additions: 0,
          deletions: 0,
          changed_files: 0,
        },
      });
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: {
          merged: true,
          sha: 'merged123',
        },
      });
      (deleteBranchMock as any).mockResolvedValue({});

      await mergePR(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        pullNumber: 123,
        deleteBranch: true,
      });

      expect(deleteBranchMock).toHaveBeenCalledWith(mockOctokit, 'owner', 'repo', 'feature-branch');
    });

    it('should handle merge conflict error', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Merge conflict'));

      await expect(
        mergePR(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          pullNumber: 123,
        })
      ).rejects.toThrow('Cannot merge PR due to merge conflicts');
    });

    it('should handle status check error', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Required status check'));

      await expect(
        mergePR(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          pullNumber: 123,
        })
      ).rejects.toThrow('Cannot merge PR: required status checks are pending');
    });

    it('should handle other merge errors', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Unknown error'));

      await expect(
        mergePR(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          pullNumber: 123,
        })
      ).rejects.toThrow('Unknown error');
    });
  });

  describe('getPR', () => {
    it('should get PR details', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          state: 'open',
          mergeable: true,
          head: { sha: 'abc123', ref: 'feature-branch' },
          base: { ref: 'main' },
          title: 'Test PR',
          body: 'PR body',
          additions: 100,
          deletions: 50,
          changed_files: 5,
        },
      });

      const result = await getPR(mockOctokit, 'owner', 'repo', 123);

      expect(result).toEqual({
        number: 123,
        htmlUrl: 'https://github.com/owner/repo/pull/123',
        state: 'open',
        mergeable: true,
        headSha: 'abc123',
        title: 'Test PR',
        body: 'PR body',
        headRef: 'feature-branch',
        baseRef: 'main',
        additions: 100,
        deletions: 50,
        changedFiles: 5,
      });
    });

    it('should handle null body', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/pull/123',
          state: 'open',
          mergeable: true,
          head: { sha: 'abc123', ref: 'feature-branch' },
          base: { ref: 'main' },
          title: 'Test PR',
          body: null,
          additions: 0,
          deletions: 0,
          changed_files: 0,
        },
      });

      const result = await getPR(mockOctokit, 'owner', 'repo', 123);

      expect(result.body).toBe('');
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.get.mockRejectedValue(new Error('PR not found'));

      await expect(getPR(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow('PR not found');
    });
  });

  describe('listPRs', () => {
    it('should list PRs with default filters', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'PR 1',
            state: 'open',
            html_url: 'https://github.com/owner/repo/pull/1',
          },
          {
            number: 2,
            title: 'PR 2',
            state: 'open',
            html_url: 'https://github.com/owner/repo/pull/2',
          },
        ],
      });

      const result = await listPRs(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        number: 1,
        title: 'PR 1',
        state: 'open',
        htmlUrl: 'https://github.com/owner/repo/pull/1',
      });
      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
      });
    });

    it('should list PRs with custom filters', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Feature PR',
            state: 'open',
            html_url: 'https://github.com/owner/repo/pull/1',
          },
        ],
      });

      const result = await listPRs(mockOctokit, 'owner', 'repo', {
        state: 'open',
        head: 'feature-branch',
        base: 'main',
      });

      expect(result).toHaveLength(1);
      expect(mockOctokit.rest.pulls.list).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
        head: 'feature-branch',
        base: 'main',
      });
    });

    it('should handle empty PR list', async () => {
      mockOctokit.rest.pulls.list.mockResolvedValue({
        data: [],
      });

      const result = await listPRs(mockOctokit, 'owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.list.mockRejectedValue(new Error('Repository not found'));

      await expect(listPRs(mockOctokit, 'owner', 'repo')).rejects.toThrow('Repository not found');
    });
  });

  describe('requestReview', () => {
    it('should request review from users', async () => {
      mockOctokit.rest.pulls.requestReviewers.mockResolvedValue({});

      await requestReview(mockOctokit, 'owner', 'repo', 123, ['user1', 'user2']);

      expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        reviewers: ['user1', 'user2'],
      });
    });

    it('should request review from users and teams', async () => {
      mockOctokit.rest.pulls.requestReviewers.mockResolvedValue({});

      await requestReview(mockOctokit, 'owner', 'repo', 123, ['user1'], ['team1', 'team2']);

      expect(mockOctokit.rest.pulls.requestReviewers).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        reviewers: ['user1'],
        team_reviewers: ['team1', 'team2'],
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.requestReviewers.mockRejectedValue(new Error('PR not found'));

      await expect(requestReview(mockOctokit, 'owner', 'repo', 999, ['user1'])).rejects.toThrow(
        'PR not found'
      );
    });
  });

  describe('createReview', () => {
    it('should create approve review', async () => {
      mockOctokit.rest.pulls.createReview.mockResolvedValue({
        data: {
          id: 456,
          html_url: 'https://github.com/owner/repo/pull/123#review-456',
        },
      });

      const result = await createReview(mockOctokit, 'owner', 'repo', 123, {
        event: 'APPROVE',
        body: 'Looks good!',
      });

      expect(result).toEqual({
        id: 456,
        htmlUrl: 'https://github.com/owner/repo/pull/123#review-456',
      });
      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        event: 'APPROVE',
        body: 'Looks good!',
      });
    });

    it('should create review with comments', async () => {
      mockOctokit.rest.pulls.createReview.mockResolvedValue({
        data: {
          id: 456,
          html_url: 'https://github.com/owner/repo/pull/123#review-456',
        },
      });

      await createReview(mockOctokit, 'owner', 'repo', 123, {
        event: 'REQUEST_CHANGES',
        body: 'Please fix these issues',
        comments: [
          {
            path: 'src/file.ts',
            position: 10,
            body: 'Fix this typo',
          },
        ],
      });

      expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        event: 'REQUEST_CHANGES',
        body: 'Please fix these issues',
        comments: [
          {
            path: 'src/file.ts',
            position: 10,
            body: 'Fix this typo',
          },
        ],
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.createReview.mockRejectedValue(new Error('PR not found'));

      await expect(
        createReview(mockOctokit, 'owner', 'repo', 999, {
          event: 'APPROVE',
        })
      ).rejects.toThrow('PR not found');
    });
  });

  describe('listReviews', () => {
    it('should list reviews successfully', async () => {
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 1,
            user: { login: 'user1' },
            state: 'APPROVED',
            body: 'LGTM',
            submitted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            user: { login: 'user2' },
            state: 'CHANGES_REQUESTED',
            body: 'Please fix',
            submitted_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const result = await listReviews(mockOctokit, 'owner', 'repo', 123);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        user: 'user1',
        state: 'APPROVED',
        body: 'LGTM',
        submittedAt: '2024-01-01T00:00:00Z',
      });
    });

    it('should handle null user', async () => {
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 1,
            user: null,
            state: 'COMMENTED',
            body: 'Comment',
            submitted_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const result = await listReviews(mockOctokit, 'owner', 'repo', 123);

      expect(result[0].user).toBe('');
    });

    it('should handle null body and submitted_at', async () => {
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [
          {
            id: 1,
            user: { login: 'user1' },
            state: 'APPROVED',
            body: null,
            submitted_at: null,
          },
        ],
      });

      const result = await listReviews(mockOctokit, 'owner', 'repo', 123);

      expect(result[0].body).toBe('');
      expect(result[0].submittedAt).toBe('');
    });

    it('should handle empty review list', async () => {
      mockOctokit.rest.pulls.listReviews.mockResolvedValue({
        data: [],
      });

      const result = await listReviews(mockOctokit, 'owner', 'repo', 123);

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.pulls.listReviews.mockRejectedValue(new Error('PR not found'));

      await expect(listReviews(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow('PR not found');
    });
  });
});
