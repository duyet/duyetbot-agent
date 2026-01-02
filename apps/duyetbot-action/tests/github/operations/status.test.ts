/**
 * Status Check Operations Tests
 *
 * Tests for commit status check operations
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCheckRun,
  createStatus,
  getCombinedStatus,
  listCheckRuns,
  updateCheckRun,
  waitForStatusChecks,
} from '../../../src/github/operations/status.js';

// Mock Octokit
const mockOctokit = {
  rest: {
    repos: {
      createCommitStatus: vi.fn(),
      getCombinedStatusForRef: vi.fn(),
    },
    checks: {
      listForRef: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
} as any;

describe('status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createStatus', () => {
    it('should create status with all fields', async () => {
      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue({});

      await createStatus(mockOctokit, 'owner', 'repo', 'abc123', {
        context: 'ci/test',
        state: 'success',
        description: 'Tests passed',
        targetUrl: 'https://ci.example.com/build/123',
      });

      expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        sha: 'abc123',
        context: 'ci/test',
        state: 'success',
        description: 'Tests passed',
        target_url: 'https://ci.example.com/build/123',
      });
    });

    it('should create status with required fields only', async () => {
      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue({});

      await createStatus(mockOctokit, 'owner', 'repo', 'abc123', {
        context: 'ci/test',
        state: 'pending',
      });

      expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        sha: 'abc123',
        context: 'ci/test',
        state: 'pending',
      });
    });

    it('should handle all state types', async () => {
      mockOctokit.rest.repos.createCommitStatus.mockResolvedValue({});

      const states: Array<'pending' | 'success' | 'failure' | 'error'> = [
        'pending',
        'success',
        'failure',
        'error',
      ];

      for (const state of states) {
        await createStatus(mockOctokit, 'owner', 'repo', 'abc123', {
          context: 'ci/test',
          state,
        });
      }

      expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledTimes(4);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.createCommitStatus.mockRejectedValue(new Error('Commit not found'));

      await expect(
        createStatus(mockOctokit, 'owner', 'repo', 'invalid', {
          context: 'ci/test',
          state: 'success',
        })
      ).rejects.toThrow('Commit not found');
    });
  });

  describe('getCombinedStatus', () => {
    it('should get combined status', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [
            {
              context: 'ci/test',
              state: 'success',
              description: 'Tests passed',
              target_url: 'https://ci.example.com',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:01:00Z',
            },
            {
              context: 'ci/lint',
              state: 'success',
              description: 'Lint passed',
              target_url: 'https://ci.example.com/lint',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:30Z',
            },
          ],
        },
      });

      const result = await getCombinedStatus(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toEqual({
        state: 'success',
        statuses: [
          {
            context: 'ci/test',
            state: 'success',
            description: 'Tests passed',
            targetUrl: 'https://ci.example.com',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:01:00Z',
          },
          {
            context: 'ci/lint',
            state: 'success',
            description: 'Lint passed',
            targetUrl: 'https://ci.example.com/lint',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:30Z',
          },
        ],
      });
    });

    it('should handle null target_url and description', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'pending',
          statuses: [
            {
              context: 'ci/test',
              state: 'pending',
              description: null,
              target_url: null,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await getCombinedStatus(mockOctokit, 'owner', 'repo', 'main');

      expect(result.statuses[0].description).toBe('');
      expect(result.statuses[0].targetUrl).toBe('');
    });

    it('should handle empty status list', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'pending',
          statuses: [],
        },
      });

      const result = await getCombinedStatus(mockOctokit, 'owner', 'repo', 'main');

      expect(result.statuses).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockRejectedValue(new Error('Ref not found'));

      await expect(getCombinedStatus(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Ref not found'
      );
    });
  });

  describe('listCheckRuns', () => {
    it('should list check runs successfully', async () => {
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            {
              id: 1,
              name: 'test',
              status: 'completed',
              conclusion: 'success',
              details_url: 'https://github.com/owner/repo/runs/1',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: '2024-01-01T00:01:00Z',
            },
            {
              id: 2,
              name: 'lint',
              status: 'in_progress',
              conclusion: null,
              details_url: 'https://github.com/owner/repo/runs/2',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: null,
            },
          ],
        },
      });

      const result = await listCheckRuns(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'test',
        status: 'completed',
        conclusion: 'success',
        detailsUrl: 'https://github.com/owner/repo/runs/1',
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      });
    });

    it('should filter out invalid statuses', async () => {
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            {
              id: 1,
              name: 'test',
              status: 'completed',
              conclusion: 'success',
              details_url: 'url',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: '2024-01-01T00:01:00Z',
            },
            {
              id: 2,
              name: 'invalid',
              status: 'invalid_status',
              conclusion: null,
              details_url: 'url',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: null,
            },
          ],
        },
      });

      const result = await listCheckRuns(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
    });

    it('should handle action_required conclusion', async () => {
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: {
          check_runs: [
            {
              id: 1,
              name: 'security',
              status: 'completed',
              conclusion: 'action_required',
              details_url: 'url',
              started_at: '2024-01-01T00:00:00Z',
              completed_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
      });

      const result = await listCheckRuns(mockOctokit, 'owner', 'repo', 'main');

      expect(result[0].conclusion).toBe('failure');
    });

    it('should handle empty check run list', async () => {
      mockOctokit.rest.checks.listForRef.mockResolvedValue({
        data: { check_runs: [] },
      });

      const result = await listCheckRuns(mockOctokit, 'owner', 'repo', 'main');

      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.checks.listForRef.mockRejectedValue(new Error('Ref not found'));

      await expect(listCheckRuns(mockOctokit, 'owner', 'repo', 'nonexistent')).rejects.toThrow(
        'Ref not found'
      );
    });
  });

  describe('waitForStatusChecks', () => {
    it('should return success when all required contexts pass', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [
            {
              context: 'ci/test',
              state: 'success',
              description: 'Passed',
              target_url: 'url',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
      });

      const result = await waitForStatusChecks(mockOctokit, 'owner', 'repo', 'main', {
        requiredContexts: ['ci/test'],
        timeout: 5000,
        pollInterval: 1000,
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe('success');
    });

    it('should return failure when required contexts fail', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'failure',
          statuses: [
            {
              context: 'ci/test',
              state: 'failure',
              description: 'Failed',
              target_url: 'url',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
      });

      const result = await waitForStatusChecks(mockOctokit, 'owner', 'repo', 'main', {
        requiredContexts: ['ci/test'],
        timeout: 5000,
      });

      expect(result.success).toBe(false);
    });

    it('should return success for overall success without required contexts', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'success',
          statuses: [
            {
              context: 'ci/test',
              state: 'success',
              description: 'Passed',
              target_url: 'url',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
      });

      const result = await waitForStatusChecks(mockOctokit, 'owner', 'repo', 'main', {
        timeout: 5000,
      });

      expect(result.success).toBe(true);
    });

    it('should timeout after specified duration', async () => {
      // Mock Date.now() to control time progression
      let currentTime = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'pending',
          statuses: [],
        },
      });

      const promise = waitForStatusChecks(mockOctokit, 'owner', 'repo', 'main', {
        timeout: 100,
        pollInterval: 50,
      });

      // Advance time past the timeout to trigger timeout error
      currentTime += 150;

      await expect(promise).rejects.toThrow('Timeout waiting for status checks');
    });

    it('should handle errors in status checks', async () => {
      mockOctokit.rest.repos.getCombinedStatusForRef.mockResolvedValue({
        data: {
          state: 'failure',
          statuses: [
            {
              context: 'ci/test',
              state: 'error',
              description: 'Error',
              target_url: 'url',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:01:00Z',
            },
          ],
        },
      });

      const result = await waitForStatusChecks(mockOctokit, 'owner', 'repo', 'main', {
        requiredContexts: ['ci/test'],
        timeout: 5000,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('createCheckRun', () => {
    it('should create check run with all fields', async () => {
      mockOctokit.rest.checks.create.mockResolvedValue({
        data: {
          id: 123,
          html_url: 'https://github.com/owner/repo/runs/123',
        },
      });

      const result = await createCheckRun(mockOctokit, 'owner', 'repo', {
        name: 'test',
        headSha: 'abc123',
        detailsUrl: 'https://ci.example.com/build/123',
        externalId: 'build-123',
        status: 'in_progress',
        conclusion: 'success',
        output: {
          title: 'Test Results',
          summary: 'All tests passed',
          text: 'Detailed output',
          annotations: [
            {
              path: 'src/file.ts',
              startLine: 10,
              endLine: 10,
              annotationLevel: 'warning',
              message: 'Consider refactoring',
            },
          ],
        },
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      });

      expect(result).toEqual({
        id: 123,
        htmlUrl: 'https://github.com/owner/repo/runs/123',
      });
    });

    it('should create check run with minimal fields', async () => {
      mockOctokit.rest.checks.create.mockResolvedValue({
        data: {
          id: 123,
          html_url: 'url',
        },
      });

      await createCheckRun(mockOctokit, 'owner', 'repo', {
        name: 'test',
        headSha: 'abc123',
        status: 'queued',
      });

      expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        name: 'test',
        head_sha: 'abc123',
        status: 'queued',
      });
    });

    it('should handle null html_url', async () => {
      mockOctokit.rest.checks.create.mockResolvedValue({
        data: {
          id: 123,
          html_url: null,
        },
      });

      const result = await createCheckRun(mockOctokit, 'owner', 'repo', {
        name: 'test',
        headSha: 'abc123',
        status: 'queued',
      });

      expect(result.htmlUrl).toBe('');
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.checks.create.mockRejectedValue(new Error('Invalid SHA'));

      await expect(
        createCheckRun(mockOctokit, 'owner', 'repo', {
          name: 'test',
          headSha: 'invalid',
          status: 'queued',
        })
      ).rejects.toThrow('Invalid SHA');
    });
  });

  describe('updateCheckRun', () => {
    it('should update check run with all fields', async () => {
      mockOctokit.rest.checks.update.mockResolvedValue({});

      await updateCheckRun(mockOctokit, 'owner', 'repo', 123, {
        name: 'updated-test',
        detailsUrl: 'https://ci.example.com/build/456',
        externalId: 'build-456',
        status: 'completed',
        conclusion: 'success',
        output: {
          title: 'Updated Results',
          summary: 'Still passing',
          text: 'Updated output',
          annotations: [
            {
              path: 'src/file.ts',
              startLine: 10,
              endLine: 10,
              annotationLevel: 'notice',
              message: 'Fixed',
            },
          ],
        },
        startedAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:02:00Z',
      });

      expect(mockOctokit.rest.checks.update).toHaveBeenCalled();
      const callArgs = mockOctokit.rest.checks.update.mock.calls[0][0];
      expect(callArgs.owner).toBe('owner');
      expect(callArgs.repo).toBe('repo');
      expect(callArgs.check_run_id).toBe(123);
      expect(callArgs.name).toBe('updated-test');
    });

    it('should update check run with partial fields', async () => {
      mockOctokit.rest.checks.update.mockResolvedValue({});

      await updateCheckRun(mockOctokit, 'owner', 'repo', 123, {
        status: 'completed',
        conclusion: 'failure',
      });

      expect(mockOctokit.rest.checks.update).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        check_run_id: 123,
        status: 'completed',
        conclusion: 'failure',
      });
    });

    it('should handle API errors', async () => {
      mockOctokit.rest.checks.update.mockRejectedValue(new Error('Check run not found'));

      await expect(
        updateCheckRun(mockOctokit, 'owner', 'repo', 999, {
          status: 'completed',
        })
      ).rejects.toThrow('Check run not found');
    });
  });
});
