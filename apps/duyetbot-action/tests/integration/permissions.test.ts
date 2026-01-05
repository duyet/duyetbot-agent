/**
 * Permission Validation Integration Tests
 *
 * Tests for permission validation:
 * - Check if actor has write access
 * - Handle allowed non-write users
 * - Handle bot users
 * - Permission error scenarios
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkWritePermissions } from '../../src/github/validation/permissions.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Permission Validation Integration', () => {
  let mockOctokit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOctokit = {
      rest: {
        repos: {
          get: vi.fn(),
        },
      },
    };
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('Write Permission Checks', () => {
    it('should grant access to users with push permission', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'maintainer-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
      });
    });

    it('should grant access to users with admin permission', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: true,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'admin-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
    });

    it('should grant access to users with maintain permission', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: true,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'maintainer-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
    });

    it('should deny access to users without write permissions', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
            read: true,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'external-contributor',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });

    it('should deny access when permission check fails', async () => {
      mockOctokit.rest.repos.get.mockRejectedValue(new Error('API error'));

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'unknown-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });
  });

  describe('Allowed Non-Write Users', () => {
    it('should grant access to user in allowed_non_write_users list', async () => {
      // No permission check needed when user is in allowed list
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'trusted-contributor',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'trusted-contributor,another-user',
        true
      );

      expect(hasPermission).toBe(true);
      // Should not make API call when user is in allowed list
      expect(mockOctokit.rest.repos.get).not.toHaveBeenCalled();
    });

    it('should grant access when allowed_non_write_users is wildcard', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'any-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '*', true);

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).not.toHaveBeenCalled();
    });

    it('should handle comma-separated list of allowed users', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'user-two',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'user-one, user-two , user-three',
        true
      );

      expect(hasPermission).toBe(true);
    });

    it('should be case-insensitive when checking allowed users', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'Trusted-Contributor',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'trusted-contributor',
        true
      );

      expect(hasPermission).toBe(true);
    });

    it('should deny access to user not in allowed list', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'untrusted-user',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'trusted-user,another-trusted-user',
        true
      );

      expect(hasPermission).toBe(false);
      // Should fall through to permission check
      expect(mockOctokit.rest.repos.get).toHaveBeenCalled();
    });
  });

  describe('GitHub Token Provided Flag', () => {
    it('should not bypass permission check without github_token input', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'contributor',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'contributor',
        false // githubTokenProvided is false
      );

      expect(hasPermission).toBe(false);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalled();
    });

    it('should bypass permission check with allowed users and github_token', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'contributor',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'contributor',
        true // githubTokenProvided is true
      );

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).not.toHaveBeenCalled();
    });
  });

  describe('Bot Users', () => {
    it('should check permissions for bot users', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'duyetbot[bot]',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
    });

    it('should allow bots in allowed_non_write_users', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'mybot[bot]',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'mybot[bot]',
        true
      );

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty allowed_non_write_users', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', true);

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).toHaveBeenCalled();
    });

    it('should handle whitespace in allowed list', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'user1',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        '  user1  ,  user2  ',
        true
      );

      expect(hasPermission).toBe(true);
    });

    it('should handle missing permissions object in response', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          // No permissions field
          id: 123,
          name: 'test-repo',
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });
  });

  describe('Permission Check Caching', () => {
    it('should make separate API calls for different users', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext: context1 } = createTestContext({
        githubContextOverrides: { actor: 'user1' },
      });
      const { githubContext: context2 } = createTestContext({
        githubContextOverrides: { actor: 'user2' },
      });

      await checkWritePermissions(mockOctokit, context1, '', false);
      await checkWritePermissions(mockOctokit, context2, '', false);

      expect(mockOctokit.rest.repos.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Logging', () => {
    it('should log permission check results', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
            read: true,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'readonly-user',
        },
      });

      await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Permission check result:',
        expect.objectContaining({
          push: false,
          admin: false,
          maintain: false,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log error when permission check fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockOctokit.rest.repos.get.mockRejectedValue(new Error('Network error'));

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'error-user',
        },
      });

      await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to check permissions:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should log when user is in allowed list', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'allowed-user',
        },
      });

      await checkWritePermissions(mockOctokit, githubContext, 'allowed-user', true);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('allowed-user'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('allowed_non_write_users'));

      consoleSpy.mockRestore();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should allow repository owner to trigger bot', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: true,
            maintain: true,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'test-owner',
          repository: {
            owner: 'test-owner',
            repo: 'test-repo',
            fullName: 'test-owner/test-repo',
          },
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
    });

    it('should allow maintainer with write access', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: true,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'team-lead',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(true);
    });

    it('should deny external contributor without write access', async () => {
      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
            read: true,
            triage: true,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'external-contributor',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });

    it('should allow trusted external contributor via allowed list', async () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'trusted-external-contributor',
        },
      });

      const hasPermission = await checkWritePermissions(
        mockOctokit,
        githubContext,
        'trusted-external-contributor,another-trusted-user',
        true
      );

      expect(hasPermission).toBe(true);
      expect(mockOctokit.rest.repos.get).not.toHaveBeenCalled();
    });
  });
});
