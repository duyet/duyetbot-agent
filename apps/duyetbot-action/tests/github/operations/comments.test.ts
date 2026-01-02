/**
 * Comment Operations Tests
 *
 * Tests for issue/PR comment operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createComment,
  deleteComment,
  findBotComment,
  listComments,
  updateComment,
} from '../../../src/github/operations/comments.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    issues: {
      createComment: vi.fn(),
      updateComment: vi.fn(),
      deleteComment: vi.fn(),
      listComments: vi.fn(),
    },
  },
} as any;

describe('comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createComment', () => {
    it('should create a comment successfully', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: {
          id: 123,
          html_url: 'https://github.com/owner/repo/issues/1#comment-123',
        },
      });

      const result = await createComment(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        issueNumber: 1,
        body: 'Test comment',
      });

      expect(result).toEqual({
        id: 123,
        htmlUrl: 'https://github.com/owner/repo/issues/1#comment-123',
      });
      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
        body: 'Test comment',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.createComment.mockRejectedValue(new Error('API Error'));

      await expect(
        createComment(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          issueNumber: 1,
          body: 'Test comment',
        })
      ).rejects.toThrow('API Error');
    });
  });

  describe('updateComment', () => {
    it('should update a comment successfully', async () => {
      mockOctokit.rest.issues.updateComment.mockResolvedValue({
        data: {
          id: 123,
          html_url: 'https://github.com/owner/repo/issues/1#comment-123',
        },
      });

      const result = await updateComment(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        commentId: 123,
        body: 'Updated comment',
      });

      expect(result).toEqual({
        id: 123,
        htmlUrl: 'https://github.com/owner/repo/issues/1#comment-123',
      });
      expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        comment_id: 123,
        body: 'Updated comment',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.updateComment.mockRejectedValue(new Error('Not Found'));

      await expect(
        updateComment(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          commentId: 999,
          body: 'Updated comment',
        })
      ).rejects.toThrow('Not Found');
    });
  });

  describe('deleteComment', () => {
    it('should delete a comment successfully', async () => {
      mockOctokit.rest.issues.deleteComment.mockResolvedValue({});

      await deleteComment(mockOctokit, 'owner', 'repo', 123);

      expect(mockOctokit.rest.issues.deleteComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        comment_id: 123,
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.issues.deleteComment.mockRejectedValue(new Error('Not Found'));

      await expect(deleteComment(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow('Not Found');
    });
  });

  describe('listComments', () => {
    it('should list comments successfully', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            body: 'First comment',
            html_url: 'https://github.com/owner/repo/issues/1#comment-1',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            body: 'Second comment',
            html_url: 'https://github.com/owner/repo/issues/1#comment-2',
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const result = await listComments(mockOctokit, 'owner', 'repo', 1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        body: 'First comment',
        htmlUrl: 'https://github.com/owner/repo/issues/1#comment-1',
        createdAt: '2024-01-01T00:00:00Z',
      });
      expect(mockOctokit.rest.issues.listComments).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 1,
      });
    });

    it('should handle empty comment list', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
      });

      const result = await listComments(mockOctokit, 'owner', 'repo', 1);

      expect(result).toEqual([]);
    });

    it('should handle null body comments', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            body: null,
            html_url: 'https://github.com/owner/repo/issues/1#comment-1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const result = await listComments(mockOctokit, 'owner', 'repo', 1);

      expect(result[0].body).toBe('');
    });

    it('should handle pagination', async () => {
      // First page
      mockOctokit.rest.issues.listComments.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            body: 'Comment 1',
            html_url: 'https://github.com/owner/repo/issues/1#comment-1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const result = await listComments(mockOctokit, 'owner', 'repo', 1);

      expect(result).toHaveLength(1);
    });
  });

  describe('findBotComment', () => {
    it('should find bot comment by marker', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            body: 'Regular comment',
            html_url: 'https://github.com/owner/repo/issues/1#comment-1',
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            body: '<!-- bot-marker --> Bot response',
            html_url: 'https://github.com/owner/repo/issues/1#comment-2',
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const result = await findBotComment(
        mockOctokit,
        'owner',
        'repo',
        1,
        'bot-user',
        '<!-- bot-marker -->'
      );

      expect(result).toEqual({
        id: 2,
        body: '<!-- bot-marker --> Bot response',
      });
    });

    it('should return null when marker not found', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1,
            body: 'Regular comment',
            html_url: 'https://github.com/owner/repo/issues/1#comment-1',
            created_at: '2024-01-01T00:00:00Z',
          },
        ],
      });

      const result = await findBotComment(
        mockOctokit,
        'owner',
        'repo',
        1,
        'bot-user',
        '<!-- bot-marker -->'
      );

      expect(result).toBeNull();
    });

    it('should return null for empty comment list', async () => {
      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [],
      });

      const result = await findBotComment(
        mockOctokit,
        'owner',
        'repo',
        1,
        'bot-user',
        '<!-- bot-marker -->'
      );

      expect(result).toBeNull();
    });
  });
});
