/**
 * Tag Operations Tests
 *
 * Tests for tag and release operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRelease,
  createTag,
  deleteRelease,
  deleteTag,
  getReleaseByTag,
  getTag,
  listReleases,
  listTags,
  updateRelease,
} from '../../../src/github/operations/tags.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    git: {
      createTag: vi.fn(),
      createRef: vi.fn(),
      getRef: vi.fn(),
      getTag: vi.fn(),
      listMatchingRefs: vi.fn(),
      deleteRef: vi.fn(),
    },
    repos: {
      createRelease: vi.fn(),
      getReleaseByTag: vi.fn(),
      listReleases: vi.fn(),
      updateRelease: vi.fn(),
      deleteRelease: vi.fn(),
    },
  },
} as any;

describe('tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTag', () => {
    it('should create tag successfully', async () => {
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: {
          sha: 'tag123',
          url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});

      const result = await createTag(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
        message: 'Release v1.0.0',
      });

      expect(result).toEqual({
        tagName: 'v1.0.0',
        sha: 'tag123',
        url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
      });
      expect(mockOctokit.rest.git.createTag).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        tag: 'v1.0.0',
        object: 'abc123',
        message: 'Release v1.0.0',
        type: 'commit',
        tagging: JSON.stringify({
          name: 'duyetbot',
          email: 'duyetbot@users.noreply.github.com',
        }),
      });
      expect(mockOctokit.rest.git.createRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'refs/tags/v1.0.0',
        sha: 'tag123',
      });
    });

    it('should create tag with default message', async () => {
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: {
          sha: 'tag123',
          url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});

      await createTag(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
      });

      expect(mockOctokit.rest.git.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Tag v1.0.0',
        })
      );
    });

    it('should create tree type tag', async () => {
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: {
          sha: 'tag123',
          url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
        },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});

      await createTag(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'tree-tag',
        target: 'abc123',
        type: 'tree',
      });

      expect(mockOctokit.rest.git.createTag).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tree',
        })
      );
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.createTag.mockRejectedValue(new Error('Invalid SHA'));

      await expect(
        createTag(mockOctokit, {
          owner: 'owner',
          repo: 'repo',
          tagName: 'v1.0.0',
          target: 'invalid',
        })
      ).rejects.toThrow('Invalid SHA');
    });
  });

  describe('createRelease', () => {
    it('should create release with existing tag', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({});
      mockOctokit.rest.repos.createRelease.mockResolvedValue({
        data: {
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/owner/repo/releases/v1.0.0',
          upload_url: 'https://uploads.github.com/...',
        },
      });

      const result = await createRelease(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
        title: 'Version 1.0.0',
        body: 'Release notes',
      });

      expect(result).toEqual({
        tagName: 'v1.0.0',
        htmlUrl: 'https://github.com/owner/repo/releases/v1.0.0',
        uploadUrl: 'https://uploads.github.com/...',
      });
      expect(mockOctokit.rest.git.getRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'tags/v1.0.0',
      });
      expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        tag_name: 'v1.0.0',
        target_commitish: 'abc123',
        name: 'Version 1.0.0',
        body: 'Release notes',
        draft: false,
        prerelease: false,
      });
    });

    it('should create release with new tag', async () => {
      mockOctokit.rest.git.getRef.mockRejectedValue(new Error('Not found'));
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: { sha: 'tag123', url: 'url' },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});
      mockOctokit.rest.repos.createRelease.mockResolvedValue({
        data: {
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/owner/repo/releases/v1.0.0',
          upload_url: 'https://uploads.github.com/...',
        },
      });

      const result = await createRelease(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
      });

      expect(result.tagName).toBe('v1.0.0');
      expect(mockOctokit.rest.git.createTag).toHaveBeenCalled();
    });

    it('should create draft release', async () => {
      mockOctokit.rest.git.getRef.mockRejectedValue(new Error('Not found'));
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: { sha: 'tag123', url: 'url' },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});
      mockOctokit.rest.repos.createRelease.mockResolvedValue({
        data: {
          tag_name: 'v1.0.0',
          html_url: 'url',
          upload_url: 'upload_url',
        },
      });

      await createRelease(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
        draft: true,
      });

      expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
        })
      );
    });

    it('should create prerelease', async () => {
      mockOctokit.rest.git.getRef.mockRejectedValue(new Error('Not found'));
      mockOctokit.rest.git.createTag.mockResolvedValue({
        data: { sha: 'tag123', url: 'url' },
      });
      mockOctokit.rest.git.createRef.mockResolvedValue({});
      mockOctokit.rest.repos.createRelease.mockResolvedValue({
        data: {
          tag_name: 'v1.0.0',
          html_url: 'url',
          upload_url: 'upload_url',
        },
      });

      await createRelease(mockOctokit, {
        owner: 'owner',
        repo: 'repo',
        tagName: 'v1.0.0',
        target: 'abc123',
        prerelease: true,
      });

      expect(mockOctokit.rest.repos.createRelease).toHaveBeenCalledWith(
        expect.objectContaining({
          prerelease: true,
        })
      );
    });
  });

  describe('getTag', () => {
    it('should get tag details', async () => {
      mockOctokit.rest.git.getTag.mockResolvedValue({
        data: {
          sha: 'tag123',
          message: 'Release v1.0.0',
          url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
        },
      });

      const result = await getTag(mockOctokit, 'owner', 'repo', 'v1.0.0');

      expect(result).toEqual({
        tagName: 'v1.0.0',
        sha: 'tag123',
        message: 'Release v1.0.0',
        url: 'https://api.github.com/repos/owner/repo/git/tags/tag123',
      });
      expect(mockOctokit.rest.git.getTag).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        tag_sha: 'v1.0.0',
      });
    });

    it('should handle null message', async () => {
      mockOctokit.rest.git.getTag.mockResolvedValue({
        data: {
          sha: 'tag123',
          message: null,
          url: 'url',
        },
      });

      const result = await getTag(mockOctokit, 'owner', 'repo', 'v1.0.0');

      expect(result.message).toBe('');
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.getTag.mockRejectedValue(new Error('Tag not found'));

      await expect(getTag(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Tag not found'
      );
    });
  });

  describe('listTags', () => {
    it('should list tags successfully', async () => {
      mockOctokit.rest.git.listMatchingRefs.mockResolvedValue({
        data: [
          {
            ref: 'refs/tags/v1.0.0',
            object: { sha: 'abc123', url: 'url1' },
          },
          {
            ref: 'refs/tags/v2.0.0',
            object: { sha: 'def456', url: 'url2' },
          },
        ],
      });

      const result = await listTags(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tagName: 'v1.0.0',
        sha: 'abc123',
        url: 'url1',
      });
      expect(mockOctokit.rest.git.listMatchingRefs).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'tags',
      });
    });

    it('should handle empty tag list', async () => {
      mockOctokit.rest.git.listMatchingRefs.mockResolvedValue({
        data: [],
      });

      const result = await listTags(mockOctokit, 'owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.listMatchingRefs.mockRejectedValue(new Error('Repository not found'));

      await expect(listTags(mockOctokit, 'owner', 'repo')).rejects.toThrow('Repository not found');
    });
  });

  describe('deleteTag', () => {
    it('should delete tag successfully', async () => {
      mockOctokit.rest.git.deleteRef.mockResolvedValue({});

      await deleteTag(mockOctokit, 'owner', 'repo', 'v1.0.0');

      expect(mockOctokit.rest.git.deleteRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'tags/v1.0.0',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.git.deleteRef.mockRejectedValue(new Error('Tag not found'));

      await expect(deleteTag(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Tag not found'
      );
    });
  });

  describe('getReleaseByTag', () => {
    it('should get release by tag', async () => {
      mockOctokit.rest.repos.getReleaseByTag.mockResolvedValue({
        data: {
          id: 123,
          tag_name: 'v1.0.0',
          html_url: 'https://github.com/owner/repo/releases/v1.0.0',
          body: 'Release notes',
          draft: false,
          prerelease: false,
        },
      });

      const result = await getReleaseByTag(mockOctokit, 'owner', 'repo', 'v1.0.0');

      expect(result).toEqual({
        id: 123,
        tagName: 'v1.0.0',
        htmlUrl: 'https://github.com/owner/repo/releases/v1.0.0',
        body: 'Release notes',
        draft: false,
        prerelease: false,
      });
    });

    it('should return null for non-existing release', async () => {
      mockOctokit.rest.repos.getReleaseByTag.mockRejectedValue(new Error('Not found'));

      const result = await getReleaseByTag(mockOctokit, 'owner', 'repo', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should handle null body', async () => {
      mockOctokit.rest.repos.getReleaseByTag.mockResolvedValue({
        data: {
          id: 123,
          tag_name: 'v1.0.0',
          html_url: 'url',
          body: null,
          draft: false,
          prerelease: false,
        },
      });

      const result = await getReleaseByTag(mockOctokit, 'owner', 'repo', 'v1.0.0');

      expect(result?.body).toBe('');
    });
  });

  describe('listReleases', () => {
    it('should list releases successfully', async () => {
      mockOctokit.rest.repos.listReleases.mockResolvedValue({
        data: [
          {
            id: 1,
            tag_name: 'v1.0.0',
            name: 'Version 1.0.0',
            html_url: 'https://github.com/owner/repo/releases/v1.0.0',
            draft: false,
            prerelease: false,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            tag_name: 'v2.0.0',
            name: 'Version 2.0.0',
            html_url: 'https://github.com/owner/repo/releases/v2.0.0',
            draft: false,
            prerelease: true,
            created_at: '2024-02-01T00:00:00Z',
          },
          {
            id: 3,
            tag_name: 'v3.0.0',
            name: null,
            html_url: 'https://github.com/owner/repo/releases/v3.0.0',
            draft: true,
            prerelease: false,
            created_at: '2024-03-01T00:00:00Z',
          },
        ],
      });

      const result = await listReleases(mockOctokit, 'owner', 'repo');

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: 1,
        tagName: 'v1.0.0',
        name: 'Version 1.0.0',
        htmlUrl: 'https://github.com/owner/repo/releases/v1.0.0',
        draft: false,
        prerelease: false,
        createdAt: '2024-01-01T00:00:00Z',
      });
      expect(result[2].name).toBe('');
    });

    it('should handle empty release list', async () => {
      mockOctokit.rest.repos.listReleases.mockResolvedValue({
        data: [],
      });

      const result = await listReleases(mockOctokit, 'owner', 'repo');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.listReleases.mockRejectedValue(new Error('Repository not found'));

      await expect(listReleases(mockOctokit, 'owner', 'repo')).rejects.toThrow(
        'Repository not found'
      );
    });
  });

  describe('updateRelease', () => {
    it('should update release successfully', async () => {
      mockOctokit.rest.repos.updateRelease.mockResolvedValue({});

      await updateRelease(mockOctokit, 'owner', 'repo', 123, {
        name: 'Updated Title',
        body: 'Updated release notes',
        draft: false,
        prerelease: false,
      });

      expect(mockOctokit.rest.repos.updateRelease).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        release_id: 123,
        name: 'Updated Title',
        body: 'Updated release notes',
        draft: false,
        prerelease: false,
      });
    });

    it('should update release with partial fields', async () => {
      mockOctokit.rest.repos.updateRelease.mockResolvedValue({});

      await updateRelease(mockOctokit, 'owner', 'repo', 123, {
        body: 'Updated notes',
      });

      expect(mockOctokit.rest.repos.updateRelease).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        release_id: 123,
        body: 'Updated notes',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.updateRelease.mockRejectedValue(new Error('Release not found'));

      await expect(
        updateRelease(mockOctokit, 'owner', 'repo', 999, {
          name: 'Updated',
        })
      ).rejects.toThrow('Release not found');
    });
  });

  describe('deleteRelease', () => {
    it('should delete release successfully', async () => {
      mockOctokit.rest.repos.deleteRelease.mockResolvedValue({});

      await deleteRelease(mockOctokit, 'owner', 'repo', 123);

      expect(mockOctokit.rest.repos.deleteRelease).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        release_id: 123,
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.deleteRelease.mockRejectedValue(new Error('Release not found'));

      await expect(deleteRelease(mockOctokit, 'owner', 'repo', 999)).rejects.toThrow(
        'Release not found'
      );
    });
  });
});
