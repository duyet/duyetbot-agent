/**
 * Merge conflict detection tests
 *
 * Tests for PR merge conflict detection and reporting functionality.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  checkMergeConflicts,
  formatConflictComment,
  MergeConflictStatus,
} from '../merge-conflict.js';

describe('checkMergeConflicts', () => {
  it('should detect clean merge', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        mergeable: true,
        merge_commit_sha: 'abc123',
      },
    });

    const octokit = {
      pulls: { get: mockGet },
      issues: {
        createComment: vi.fn(),
        listComments: vi.fn(),
        updateComment: vi.fn(),
      },
    } as any;

    const result = await checkMergeConflicts(octokit, 'owner', 'repo', 123);

    expect(result.status).toBe('clean');
    expect(result.mergeable).toBe(true);
    expect(result.message).toContain('cleanly');
  });

  it('should detect merge conflicts', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        mergeable: false,
        merge_commit_sha: null,
      },
    });

    const octokit = {
      pulls: { get: mockGet },
      issues: {
        createComment: vi.fn(),
        listComments: vi.fn(),
        updateComment: vi.fn(),
      },
    } as any;

    const result = await checkMergeConflicts(octokit, 'owner', 'repo', 123);

    expect(result.status).toBe('conflicting');
    expect(result.mergeable).toBe(false);
    expect(result.message).toContain('conflicts');
  });

  it('should handle unknown merge status', async () => {
    const mockGet = vi.fn().mockResolvedValue({
      data: {
        mergeable: null,
        merge_commit_sha: null,
      },
    });

    const octokit = {
      pulls: { get: mockGet },
      issues: {
        createComment: vi.fn(),
        listComments: vi.fn(),
        updateComment: vi.fn(),
      },
    } as any;

    const result = await checkMergeConflicts(octokit, 'owner', 'repo', 123);

    expect(result.status).toBe('unknown');
    expect(result.mergeable).toBe(null);
    expect(result.message).toContain('checking');
  });

  it('should handle API errors gracefully', async () => {
    const mockGet = vi.fn().mockRejectedValue(new Error('API Error'));

    const octokit = {
      pulls: { get: mockGet },
      issues: {
        createComment: vi.fn(),
        listComments: vi.fn(),
        updateComment: vi.fn(),
      },
    } as any;

    const result = await checkMergeConflicts(octokit, 'owner', 'repo', 123);

    expect(result.status).toBe('unknown');
    expect(result.message).toContain('Unable to check merge status');
  });
});

describe('formatConflictComment', () => {
  const baseResult = {
    mergeable: true,
    mergeCommitSha: 'abc123',
    status: 'clean' as MergeConflictStatus,
    message: 'Clean merge',
  };

  it('should format clean merge comment', () => {
    const result = { ...baseResult, status: 'clean' as const, message: 'Clean merge' };
    const comment = formatConflictComment(result, 123, 'feature-branch', 'main');

    expect(comment).toContain('## Merge Status Check');
    expect(comment).toContain('✅');
    expect(comment).toContain('#123');
    expect(comment).toContain('feature-branch');
    expect(comment).toContain('main');
    expect(comment).toContain('ready to merge');
  });

  it('should format conflicting merge comment', () => {
    const result = {
      mergeable: false,
      status: 'conflicting' as MergeConflictStatus,
      message: 'Has conflicts',
    };
    const comment = formatConflictComment(result, 123, 'feature-branch', 'main');

    expect(comment).toContain('## Merge Status Check');
    expect(comment).toContain('⚠️');
    expect(comment).toContain('conflicts');
    expect(comment).toContain('### Resolution Steps');
    expect(comment).toContain('git fetch');
    expect(comment).toContain('git checkout');
    expect(comment).toContain('git merge');
  });

  it('should format unknown status comment', () => {
    const result = {
      mergeable: null,
      status: 'unknown' as MergeConflictStatus,
      message: 'Still checking',
    };
    const comment = formatConflictComment(result, 123, 'feature-branch', 'main');

    expect(comment).toContain('## Merge Status Check');
    expect(comment).toContain('⏳');
    expect(comment).toContain('calculating mergeability');
  });

  it('should include resolution steps for conflicts', () => {
    const result = {
      mergeable: false,
      status: 'conflicting' as MergeConflictStatus,
      message: 'Has conflicts',
    };
    const comment = formatConflictComment(result, 456, 'fix/auth', 'develop');

    expect(comment).toContain('```bash');
    expect(comment).toContain('git fetch origin develop');
    expect(comment).toContain('git checkout fix/auth');
    expect(comment).toContain('git merge origin/develop');
    expect(comment).toContain('git add .');
    expect(comment).toContain('git commit -m "Resolve merge conflicts"');
  });

  it('should include footer', () => {
    const result = { ...baseResult };
    const comment = formatConflictComment(result, 123, 'feature', 'main');

    expect(comment).toContain('---');
    expect(comment).toContain('*Checked by');
  });

  it('should handle special characters in branch names', () => {
    const result = { ...baseResult };
    const comment = formatConflictComment(result, 123, 'feature/123-thing', 'release/v2.0');

    expect(comment).toContain('feature/123-thing');
    expect(comment).toContain('release/v2.0');
  });
});
