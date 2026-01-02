/**
 * GitHub Issues Source Tests
 *
 * Tests for GitHub Issues task source with mocked Octokit
 */

import { Octokit } from '@octokit/rest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubIssuesSource } from '../../../src/tasks/sources/github-issues.js';

// Mock Octokit
vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      listForRepo: vi.fn(),
      createComment: vi.fn(),
      update: vi.fn(),
      addLabels: vi.fn(),
    },
  })),
}));

describe('GitHubIssuesSource', () => {
  let source: GitHubIssuesSource;

  const mockOptions = {
    token: 'ghp_test_token',
    owner: 'test-owner',
    repo: 'test-repo',
  };

  beforeEach(() => {
    // Clear mock call history
    vi.clearAllMocks();

    // Create fresh source instance
    source = new GitHubIssuesSource(mockOptions);
  });

  // Helper to get the mock octokit from the source instance
  const getMockOctokit = () => {
    return (source as any).octokit;
  };

  describe('constructor', () => {
    it('should initialize with correct name and priority', () => {
      expect(source.name).toBe('github-issues');
      expect(source.priority).toBe(3);
    });

    it('should create Octokit instance with auth token', () => {
      expect(Octokit).toHaveBeenCalledWith({ auth: mockOptions.token });
    });
  });

  describe('listPending', () => {
    it('should fetch open issues with agent-task label', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Test task 1',
          body: 'Description 1',
          labels: [{ name: 'agent-task' }, { name: 'priority-1' }, { name: 'bug' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
        {
          number: 2,
          title: 'Test task 2',
          body: 'Description 2',
          labels: [{ name: 'agent-task' }, { name: 'priority-5' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/2',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(mockOctokit.issues.listForRepo).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        labels: 'agent-task',
        state: 'open',
        sort: 'created',
        direction: 'desc',
      });

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({
        source: 'github-issues',
        title: 'Test task 1',
        description: 'Description 1',
        priority: 1,
        labels: ['bug'],
        status: 'pending',
      });
      expect(tasks[0].metadata).toMatchObject({
        issueNumber: 1,
        url: 'https://github.com/test-owner/test-repo/issues/1',
        author: 'testuser',
      });
    });

    it('should handle string labels (older GitHub API format)', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Test with string labels',
          body: 'Description',
          labels: ['agent-task', 'priority-3', 'enhancement'],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].priority).toBe(3);
      expect(tasks[0].labels).toEqual(['enhancement']);
    });

    it('should use default priority when no priority label', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Task without priority',
          body: 'Description',
          labels: [{ name: 'agent-task' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks[0].priority).toBe(5);
    });

    it('should filter out agent-task and priority- labels from labels array', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Test task',
          body: 'Description',
          labels: [
            { name: 'agent-task' },
            { name: 'priority-1' },
            { name: 'bug' },
            { name: 'enhancement' },
          ],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks[0].labels).toEqual(['bug', 'enhancement']);
    });

    it('should handle issues without body', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Task without body',
          body: null,
          labels: [{ name: 'agent-task' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks[0].description).toBe('');
    });

    it('should return empty array on API error', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockRejectedValue(new Error('API Error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching GitHub issues:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle empty issues list', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });

      const tasks = await source.listPending();

      expect(tasks).toEqual([]);
    });

    it('should parse timestamps correctly', async () => {
      const mockIssues = [
        {
          number: 1,
          title: 'Test task',
          body: 'Description',
          labels: [{ name: 'agent-task' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T12:30:45Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/1',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks[0].createdAt).toBe(new Date('2024-01-01T00:00:00Z').getTime());
      expect(tasks[0].updatedAt).toBe(new Date('2024-01-02T12:30:45Z').getTime());
    });

    it('should generate correct task ID', async () => {
      const mockIssues = [
        {
          number: 42,
          title: 'Test task',
          body: 'Description',
          labels: [{ name: 'agent-task' }],
          state: 'open',
          user: { login: 'testuser' },
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T01:00:00Z',
          html_url: 'https://github.com/test-owner/test-repo/issues/42',
        },
      ];

      const mockOctokit = getMockOctokit();
      mockOctokit.issues.listForRepo.mockResolvedValue({ data: mockIssues });

      const tasks = await source.listPending();

      expect(tasks[0].id).toBe('github-issues-test-owner-test-repo-42');
    });
  });

  describe('markComplete', () => {
    it('should create comment and close issue', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.createComment.mockResolvedValue({});
      mockOctokit.issues.update.mockResolvedValue({});

      await source.markComplete('github-issues-test-owner-test-repo-42');

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: '✅ Task completed by agent',
      });

      expect(mockOctokit.issues.update).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        state: 'closed',
      });
    });

    it('should extract issue number from task ID', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.createComment.mockResolvedValue({});
      mockOctokit.issues.update.mockResolvedValue({});

      await source.markComplete('github-issues-test-owner-test-repo-123');

      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 123,
        })
      );
    });
  });

  describe('markFailed', () => {
    it('should add label and create error comment', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.addLabels.mockResolvedValue({});
      mockOctokit.issues.createComment.mockResolvedValue({});

      await source.markFailed('github-issues-test-owner-test-repo-42', 'Test error message');

      expect(mockOctokit.issues.addLabels).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        labels: ['agent-failed'],
      });

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: expect.stringContaining('Test error message'),
      });
    });

    it('should format error comment with code block', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.addLabels.mockResolvedValue({});
      mockOctokit.issues.createComment.mockResolvedValue({});

      await source.markFailed('github-issues-test-owner-test-repo-42', 'Error: failed');

      expect(mockOctokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        body: `❌ Task failed\n\n**Error:**\n\`\`\`\nError: failed\n\`\`\``,
      });
    });
  });

  describe('extractIssueNumber', () => {
    it('should extract issue number from valid task ID', async () => {
      const mockOctokit = getMockOctokit();
      mockOctokit.issues.createComment.mockResolvedValue({});
      mockOctokit.issues.update.mockResolvedValue({});

      await source.markComplete('github-issues-test-owner-test-repo-123');

      expect(mockOctokit.issues.update).toHaveBeenCalledWith(
        expect.objectContaining({
          issue_number: 123,
        })
      );
    });

    it('should throw error for invalid task ID format - empty last part', async () => {
      await expect(source.markComplete('github-issues-test-owner-test-repo-')).rejects.toThrow(
        'Invalid task ID format'
      );
    });

    it('should throw error for invalid task ID format - NaN', async () => {
      await expect(source.markComplete('github-issues-test-owner-test-repo-abc')).rejects.toThrow(
        'Invalid task ID format'
      );
    });
  });
});
