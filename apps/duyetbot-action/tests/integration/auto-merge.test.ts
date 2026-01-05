/**
 * Auto-Merge Integration Tests
 *
 * End-to-end tests for auto-merge workflow:
 * - PR created by agent
 * - CI checks pass
 * - PR is auto-approved
 * - PR is auto-merged
 * - Branch is deleted
 * - Issue is closed (if applicable)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoMergeService, autoMergePR } from '../../src/self-improvement/auto-merge.js';
import { MockOctokit } from './helpers/octokit-mock.js';

describe('Auto-Merge Integration', () => {
  let octokit: MockOctokit;

  beforeEach(() => {
    octokit = new MockOctokit();
    vi.clearAllMocks();
  });

  describe('Auto-Merge Service', () => {
    it('should merge PR when all checks pass', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR details
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 123,
        html_url: 'https://github.com/test-owner/test-repo/pull/123',
        state: 'open',
        mergeable: true,
        head: { sha: 'abc123', ref: 'feature-branch' },
        base: { ref: 'main' },
        title: 'Test PR',
        body: 'Test PR body',
        additions: 100,
        deletions: 50,
        changed_files: 5,
      });

      // Mock successful checks
      octokit.mockListChecks([
        {
          id: 1,
          name: 'ci',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/1',
        },
        {
          id: 2,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/2',
        },
      ]);

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'abc123',
      });

      const config = {
        enabled: true,
        requireChecks: ['ci', 'test'],
        waitForChecks: false,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: false,
      };

      const result = await service.autoMerge(123, config);

      expect(result.merged).toBe(true);
      expect(result.checksPassed).toEqual(['ci', 'test']);
      expect(result.checksFailed).toEqual([]);
    });

    it('should not merge PR with merge conflicts', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR with conflicts
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 456,
        html_url: 'https://github.com/test-owner/test-repo/pull/456',
        state: 'open',
        mergeable: false,
        head: { sha: 'def456', ref: 'conflict-branch' },
        base: { ref: 'main' },
        title: 'Conflict PR',
        body: 'Has conflicts',
        additions: 50,
        deletions: 20,
        changed_files: 3,
      });

      const config = {
        enabled: true,
        requireChecks: [],
        waitForChecks: false,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: false,
      };

      const result = await service.autoMerge(456, config);

      expect(result.merged).toBe(false);
      expect(result.reason).toBe('PR has merge conflicts');
    });

    it('should not merge PR when checks fail', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 789,
        html_url: 'https://github.com/test-owner/test-repo/pull/789',
        state: 'open',
        mergeable: true,
        head: { sha: 'ghi789', ref: 'failing-branch' },
        base: { ref: 'main' },
        title: 'Failing PR',
        body: 'Tests fail',
        additions: 10,
        deletions: 5,
        changed_files: 2,
      });

      // Mock failed checks
      octokit.mockListChecks([
        {
          id: 3,
          name: 'ci',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/3',
        },
        {
          id: 4,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/4',
        },
      ]);

      const config = {
        enabled: true,
        requireChecks: ['ci', 'test'],
        waitForChecks: true,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: false,
      };

      const result = await service.autoMerge(789, config);

      expect(result.merged).toBe(false);
      expect(result.reason).toBe('CI checks failed');
      expect(result.checksFailed).toEqual(['ci']);
      expect(result.checksPassed).toEqual(['test']);
    });

    it('should approve PR before merging when configured', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 101,
        html_url: 'https://github.com/test-owner/test-repo/pull/101',
        state: 'open',
        mergeable: true,
        head: { sha: 'jkl101', ref: 'approve-branch' },
        base: { ref: 'main' },
        title: 'Approval PR',
        body: 'Needs approval',
        additions: 75,
        deletions: 25,
        changed_files: 4,
      });

      // Mock successful checks
      octokit.mockListChecks([
        {
          id: 5,
          name: 'ci',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/5',
        },
      ]);

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'jkl101',
      });

      // Mock approval
      octokit.mockCreateReview({
        id: 555,
        state: 'APPROVED',
        html_url: 'https://github.com/test-owner/test-repo/pull/101/reviews/555',
      });

      const config = {
        enabled: true,
        requireChecks: ['ci'],
        waitForChecks: true,
        timeout: 600000,
        approveFirst: true,
        deleteBranch: false,
      };

      await service.autoMerge(101, config);

      // Verify approval was created
      expect(octokit.verifyCalled('pulls', 'createReview', 1)).toBe(true);

      const reviewArgs = octokit.getLastCallArgs('pulls', 'createReview');
      expect(reviewArgs.event).toBe('APPROVE');
      expect(reviewArgs.body).toContain('Auto-approved');
    });

    it('should delete branch after merge when configured', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 202,
        html_url: 'https://github.com/test-owner/test-repo/pull/202',
        state: 'open',
        mergeable: true,
        head: { sha: 'mno202', ref: 'delete-me-branch' },
        base: { ref: 'main' },
        title: 'Delete Branch PR',
        body: 'Branch should be deleted',
        additions: 30,
        deletions: 15,
        changed_files: 2,
      });

      // Mock successful checks
      octokit.mockListChecks([]);

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'mno202',
      });

      // Mock branch deletion
      octokit.mockDeleteRef();

      const config = {
        enabled: true,
        requireChecks: [],
        waitForChecks: false,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: true,
      };

      await service.autoMerge(202, config);

      // Verify merge was called with delete_branch parameter
      expect(octokit.verifyCalled('pulls', 'merge', 1)).toBe(true);

      const mergeArgs = octokit.getLastCallArgs('pulls', 'merge');
      expect(mergeArgs.delete_branch).toBe(true);
    });

    it('should wait for pending checks to complete', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      let checkCount = 0;
      const mockChecks = () => {
        checkCount++;
        if (checkCount < 3) {
          // First two calls: pending checks
          return [
            {
              id: 6,
              name: 'ci',
              status: 'in_progress',
              conclusion: null,
              html_url: 'https://github.com/test-owner/test-repo/actions/runs/6',
            },
          ];
        }
        // Third call: checks complete
        return [
          {
            id: 6,
            name: 'ci',
            status: 'completed',
            conclusion: 'success',
            html_url: 'https://github.com/test-owner/test-repo/actions/runs/6',
          },
        ];
      };

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 303,
        html_url: 'https://github.com/test-owner/test-repo/pull/303',
        state: 'open',
        mergeable: true,
        head: { sha: 'pqr303', ref: 'waiting-branch' },
        base: { ref: 'main' },
        title: 'Wait for Checks PR',
        body: 'Checks are pending',
        additions: 40,
        deletions: 20,
        changed_files: 3,
      });

      // Setup dynamic mock for checks
      octokit.rest.checks.listForRef.mockImplementation(async () => ({
        data: { check_runs: mockChecks() },
      }));

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'pqr303',
      });

      const config = {
        enabled: true,
        requireChecks: ['ci'],
        waitForChecks: true,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: false,
      };

      const result = await service.autoMerge(303, config);

      expect(result.merged).toBe(true);
      expect(checkCount).toBeGreaterThanOrEqual(3);
    }, 30000); // 30 second timeout for polling test
  });

  describe('Convenience Function', () => {
    it('should use default config when not provided', async () => {
      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 404,
        html_url: 'https://github.com/test-owner/test-repo/pull/404',
        state: 'open',
        mergeable: true,
        head: { sha: 'stu404', ref: 'default-branch' },
        base: { ref: 'main' },
        title: 'Default Config PR',
        body: 'Uses defaults',
        additions: 20,
        deletions: 10,
        changed_files: 2,
      });

      // Mock checks - need to provide successful checks since waitForChecks defaults to true
      octokit.mockListChecks([
        {
          id: 1,
          name: 'ci',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/1',
        },
        {
          id: 2,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/2',
        },
      ]);

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'stu404',
      });

      // Mock approval
      octokit.mockCreateReview({
        id: 777,
        state: 'APPROVED',
        html_url: 'https://github.com/test-owner/test-repo/pull/404/reviews/777',
      });

      const result = await autoMergePR(
        'ghp_test_token',
        'test-owner',
        'test-repo',
        404,
        {},
        octokit
      );

      expect(result.merged).toBe(true);
    });

    it('should merge with custom config', async () => {
      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 505,
        html_url: 'https://github.com/test-owner/test-repo/pull/505',
        state: 'open',
        mergeable: true,
        head: { sha: 'vwx505', ref: 'custom-branch' },
        base: { ref: 'develop' },
        title: 'Custom Config PR',
        body: 'Custom settings',
        additions: 60,
        deletions: 30,
        changed_files: 4,
      });

      // Mock checks - need to provide successful checks since waitForChecks defaults to true
      octokit.mockListChecks([
        {
          id: 3,
          name: 'ci',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/3',
        },
        {
          id: 4,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/4',
        },
      ]);

      // Mock merge
      octokit.mockMergePR({
        merged: true,
        sha: 'vwx505',
      });

      // Mock approval
      octokit.mockCreateReview({
        id: 888,
        state: 'APPROVED',
        html_url: 'https://github.com/test-owner/test-repo/pull/505/reviews/888',
      });

      // Mock branch deletion
      octokit.mockDeleteRef();

      const result = await autoMergePR(
        'ghp_test_token',
        'test-owner',
        'test-repo',
        505,
        {
          approveFirst: true,
          deleteBranch: true,
        },
        octokit
      );

      expect(result.merged).toBe(true);
      expect(octokit.verifyCalled('pulls', 'createReview', 1)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout waiting for checks', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 606,
        html_url: 'https://github.com/test-owner/test-repo/pull/606',
        state: 'open',
        mergeable: true,
        head: { sha: 'yz606', ref: 'timeout-branch' },
        base: { ref: 'main' },
        title: 'Timeout PR',
        body: 'Checks never complete',
        additions: 10,
        deletions: 5,
        changed_files: 1,
      });

      // Mock checks that never complete
      octokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            {
              id: 7,
              name: 'ci',
              status: 'pending',
              conclusion: null,
              html_url: 'https://github.com/test-owner/test-repo/actions/runs/7',
            },
          ],
        },
      });

      const config = {
        enabled: true,
        requireChecks: ['ci'],
        waitForChecks: true,
        timeout: 100, // Very short timeout
        approveFirst: false,
        deleteBranch: false,
      };

      await expect(service.autoMerge(606, config)).rejects.toThrow('Timeout waiting for CI checks');
    }, 30000); // 30 second timeout

    it('should handle merge conflict errors', async () => {
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Mock PR
      octokit.mockListChecks([]);
      octokit.mockGetPR({
        number: 707,
        html_url: 'https://github.com/test-owner/test-repo/pull/707',
        state: 'open',
        mergeable: true,
        head: { sha: 'zab707', ref: 'conflict-error-branch' },
        base: { ref: 'main' },
        title: 'Merge Error PR',
        body: 'Will conflict during merge',
        additions: 15,
        deletions: 8,
        changed_files: 2,
      });

      // Mock checks
      octokit.mockListChecks([]);

      // Mock merge error
      octokit.rest.pulls.merge.mockRejectedValue(new Error('Merge conflict'));

      const config = {
        enabled: true,
        requireChecks: [],
        waitForChecks: false,
        timeout: 600000,
        approveFirst: false,
        deleteBranch: false,
      };

      await expect(service.autoMerge(707, config)).rejects.toThrow('Merge conflict');
    });
  });

  describe('Full Auto-Merge Workflow', () => {
    it('should execute complete auto-merge workflow', async () => {
      // This test simulates the complete workflow from PR creation to merge
      const service = new AutoMergeService('ghp_test_token', 'test-owner', 'test-repo', octokit);

      // Step 1: PR created
      const prNumber = 808;
      const prSha = 'bcd808';
      const branchName = 'feature/auto-merge-test';

      // Mock PR details
      octokit.mockListChecks([
        {
          id: 10,
          name: 'lint',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/10',
        },
        {
          id: 11,
          name: 'test',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/11',
        },
        {
          id: 12,
          name: 'build',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/test-owner/test-repo/actions/runs/12',
        },
      ]);
      octokit.mockGetPR({
        number: prNumber,
        html_url: `https://github.com/test-owner/test-repo/pull/${prNumber}`,
        state: 'open',
        mergeable: true,
        head: { sha: prSha, ref: branchName },
        base: { ref: 'main' },
        title: 'Auto-Merge Test PR',
        body: 'Testing auto-merge workflow',
        additions: 150,
        deletions: 75,
        changed_files: 8,
      });

      // Step 3: Auto-approve
      octokit.mockCreateReview({
        id: 999,
        state: 'APPROVED',
        html_url: `https://github.com/test-owner/test-repo/pull/${prNumber}/reviews/999`,
      });

      // Step 4: Merge
      octokit.mockMergePR({
        merged: true,
        sha: prSha,
      });

      // Step 5: Delete branch
      octokit.mockDeleteRef();

      const config = {
        enabled: true,
        requireChecks: ['lint', 'test', 'build'],
        waitForChecks: true,
        timeout: 600000,
        approveFirst: true,
        deleteBranch: true,
      };

      const result = await service.autoMerge(prNumber, config);

      // Verify complete workflow
      expect(result.merged).toBe(true);
      expect(result.checksPassed).toContain('lint');
      expect(result.checksPassed).toContain('test');
      expect(result.checksPassed).toContain('build');

      // Verify all steps were executed
      expect(octokit.verifyCalled('pulls', 'get')).toBe(true);
      expect(octokit.verifyCalled('checks', 'listForRef')).toBe(true);
      expect(octokit.verifyCalled('pulls', 'createReview', 1)).toBe(true);
      expect(octokit.verifyCalled('pulls', 'merge', 1)).toBe(true);
      // Verify merge was called with delete_branch parameter
      const mergeArgs = octokit.getLastCallArgs('pulls', 'merge');
      expect(mergeArgs.delete_branch).toBe(true);
    });
  });
});
