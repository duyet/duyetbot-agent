/**
 * Issue Operations Tests
 *
 * Tests for issue operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeIssue,
  createIssue,
  getIssue,
  listIssues,
  reopenIssue,
  updateIssue,
} from '../../../src/github/operations/issues.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    issues: {
      create: vi.fn(),
      update: vi.fn(),
      createComment: vi.fn(),
      get: vi.fn(),
      listForRepo: vi.fn(),
    },
  },
} as any;

describe('issues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createIssue', () => {
    it('should create issue with all fields', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/issues/123',
        },
      });

      const result = await createIssue(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Issue body',
        labels: ['bug', 'enhancement'],
        assignees: ['user1', 'user2'],
      });

      expect(result).toEqual({
        number: 123,
        htmlUrl: 'https://github.com/owner/repo/issues/123',
      });
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
        body: 'Issue body',
        labels: ['bug', 'enhancement'],
        assignees: ['user1', 'user2'],
      });
    });

    it('should create issue with only required fields', async () => {
      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 123,
          html_url: 'https://github.com/owner/repo/issues/123',
        },
      });

      const result = await createIssue(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
      });

      expect(result).toEqual({
        number: 123,
        htmlUrl: 'https://github.com/owner/repo/issues/123',
      });
      expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        title: 'Test Issue',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.create.mockRejectedValue(new Error('Repository not found'));

      await expect(
        createIssue(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          title: 'Test Issue',
        })
      ).rejects.toThrow('Repository not found');
    });
  });

  describe('updateIssue', () => {
    it('should update issue with all fields', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({});

      await updateIssue(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        issueNumber: 123,
        title: 'Updated Title',
        body: 'Updated body',
        state: 'open',
        labels: ['bug'],
        assignees: ['user1'],
      });

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        title: 'Updated Title',
        body: 'Updated body',
        state: 'open',
        labels: ['bug'],
        assignees: ['user1'],
      });
    });

    it('should update issue with partial fields', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({});

      await updateIssue(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        issueNumber: 123,
        state: 'closed',
      });

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        state: 'closed',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('Issue not found'));

      await expect(
        updateIssue(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          issueNumber: 999,
          state: 'closed',
        })
      ).rejects.toThrow('Issue not found');
    });
  });

  describe('closeIssue', () => {
    it('should close issue without comment', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({});

      await closeIssue(mockOctokit, 'owner', 'repo', 123);

      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        state: 'closed',
      });
    });

    it('should close issue with comment', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({});
      mockOctokit.rest.issues.update.mockResolvedValue({});

      await closeIssue(mockOctokit, 'owner', 'repo', 123, 'Closing this issue as resolved');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        body: 'Closing this issue as resolved',
      });
      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        state: 'closed',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('Issue not found'));

      await expect(closeIssue(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow(
        'Issue not found'
      );
    });
  });

  describe('reopenIssue', () => {
    it('should reopen issue successfully', async () => {
      mockOctokit.rest.issues.update.mockResolvedValue({});

      await reopenIssue(mockOctokit, 'owner', 'repo', 123);

      expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        state: 'open',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.update.mockRejectedValue(new Error('Issue not found'));

      await expect(reopenIssue(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow(
        'Issue not found'
      );
    });
  });

  describe('getIssue', () => {
    it('should get issue details', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Issue body',
          state: 'open',
          labels: [{ name: 'bug' }, { name: 'enhancement' }],
          assignees: [{ login: 'user1' }, { login: 'user2' }],
          html_url: 'https://github.com/owner/repo/issues/123',
        },
      });

      const result = await getIssue(mockOctokit, 'owner', 'repo', 123);

      expect(result).toEqual({
        number: 123,
        title: 'Test Issue',
        body: 'Issue body',
        state: 'open',
        labels: ['bug', 'enhancement'],
        assignees: ['user1', 'user2'],
        htmlUrl: 'https://github.com/owner/repo/issues/123',
      });
    });

    it('should handle null body', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: null,
          state: 'open',
          labels: [],
          assignees: [],
          html_url: 'https://github.com/owner/repo/issues/123',
        },
      });

      const result = await getIssue(mockOctokit, 'owner', 'repo', 123);

      expect(result.body).toBe('');
    });

    it('should handle missing assignees', async () => {
      mockOctokit.rest.issues.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test Issue',
          body: 'Issue body',
          state: 'open',
          labels: [],
          assignees: null,
          html_url: 'https://github.com/owner/repo/issues/123',
        },
      });

      const result = await getIssue(mockOctokit, 'owner', 'repo', 123);

      expect(result.assignees).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.get.mockRejectedValue(new Error('Issue not found'));

      await expect(getIssue(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow('Issue not found');
    });
  });

  describe('listIssues', () => {
    it('should list issues with default filters', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Issue 1',
            state: 'open',
            html_url: 'https://github.com/owner/repo/issues/1',
          },
          {
            number: 2,
            title: 'Issue 2',
            state: 'open',
            html_url: 'https://github.com/owner/repo/issues/2',
          },
        ],
      });

      const result = await listIssues(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        number: 1,
        title: 'Issue 1',
        state: 'open',
        htmlUrl: 'https://github.com/owner/repo/issues/1',
      });
      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'open',
      });
    });

    it('should list issues with custom filters', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Bug Issue',
            state: 'closed',
            html_url: 'https://github.com/owner/repo/issues/1',
          },
        ],
      });

      const result = await listIssues(mockOctokit, 'owner', 'repo', {
        state: 'closed',
        labels: ['bug'],
        assignee: 'user1',
      });

      expect(result).toHaveLength(1);
      expect(mockOctokit.rest.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        state: 'closed',
        labels: 'bug',
        assignee: 'user1',
      });
    });

    it('should handle empty issue list', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [],
      });

      const result = await listIssues(mockOctokit, 'owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.listForRepo.mockRejectedValue(new Error('Repository not found'));

      await expect(listIssues(mockOctokit, 'owner', 'repo')).rejects.toThrow(
        'Repository not found'
      );
    });

    it('should handle pagination', async () => {
      mockOctokit.rest.issues.listForRepo.mockResolvedValue({
        data: [
          {
            number: 1,
            title: 'Issue 1',
            state: 'open',
            html_url: 'https://github.com/owner/repo/issues/1',
          },
        ],
      });

      const result = await listIssues(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(1);
    });
  });
});
