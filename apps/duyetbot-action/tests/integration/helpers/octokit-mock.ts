/**
 * Octokit Mock
 *
 * Mock GitHub API client for integration tests.
 */

import { vi } from 'vitest';

/**
 * Mock Octokit instance
 */
export class MockOctokit {
  public rest: any;
  public requests: any[] = [];

  constructor() {
    this.rest = {
      issues: {
        createComment: vi.fn(),
        updateComment: vi.fn(),
        deleteComment: vi.fn(),
        listComments: vi.fn(),
        get: vi.fn(),
        addLabels: vi.fn(),
        removeLabel: vi.fn(),
        update: vi.fn(),
        close: vi.fn(),
      },
      pulls: {
        create: vi.fn(),
        update: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        merge: vi.fn(),
        requestReviewers: vi.fn(),
        createReview: vi.fn(),
        listReviews: vi.fn(),
      },
      repos: {
        get: vi.fn(),
        createCommitComment: vi.fn(),
      },
      git: {
        createRef: vi.fn(),
        deleteRef: vi.fn(),
      },
      checks: {
        create: vi.fn(),
        listForRef: vi.fn(),
        get: vi.fn(),
        update: vi.fn(),
      },
    };

    // Don't track initially - let mock* methods set up tracking
  }

  /**
   * Setup mock response for issue comment creation
   */
  mockCreateComment(response: { id: number; html_url: string }): void {
    this.rest.issues.createComment.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'issues',
        method: 'createComment',
        args,
        timestamp: Date.now(),
      });
      return { data: response };
    });
  }

  /**
   * Setup mock response for comment update
   */
  mockUpdateComment(response: { id: number; html_url: string }): void {
    this.rest.issues.updateComment.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'issues',
        method: 'updateComment',
        args,
        timestamp: Date.now(),
      });
      return { data: response };
    });
  }

  /**
   * Setup mock response for listing comments
   */
  mockListComments(
    comments: Array<{
      id: number;
      body: string;
      html_url: string;
      created_at: string;
    }>
  ): void {
    this.rest.issues.listComments.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'issues',
        method: 'listComments',
        args,
        timestamp: Date.now(),
      });
      return { data: comments };
    });
  }

  /**
   * Setup mock response for PR creation
   */
  mockCreatePR(response: {
    number: number;
    html_url: string;
    state: string;
    mergeable: boolean;
    head: { sha: string };
  }): void {
    this.rest.pulls.create.mockResolvedValue({
      data: response,
    });
  }

  /**
   * Setup mock response for PR merge
   */
  mockMergePR(response: { merged: boolean; sha: string }): void {
    this.rest.pulls.merge.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'pulls',
        method: 'merge',
        args,
        timestamp: Date.now(),
      });
      return { data: response };
    });
  }

  /**
   * Setup mock response for branch deletion
   */
  mockDeleteRef(): void {
    this.rest.git.deleteRef.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'git',
        method: 'deleteRef',
        args,
        timestamp: Date.now(),
      });
      return {};
    });
  }

  /**
   * Setup mock response for PR review/approval
   */
  mockCreateReview(response: { id: number; state: string; html_url: string }): void {
    this.rest.pulls.createReview.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'pulls',
        method: 'createReview',
        args,
        timestamp: Date.now(),
      });
      return { data: response };
    });
  }

  /**
   * Setup mock response for getting PR
   */
  mockGetPR(response: {
    number: number;
    html_url: string;
    state: string;
    mergeable: boolean;
    head: { sha: string; ref: string };
    base: { ref: string };
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changed_files: number;
  }): void {
    this.rest.pulls.get.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'pulls',
        method: 'get',
        args,
        timestamp: Date.now(),
      });
      return { data: response };
    });
  }

  /**
   * Setup mock response for getting repository
   */
  mockGetRepository(response: {
    permissions: {
      push?: boolean;
      admin?: boolean;
      maintain?: boolean;
    };
  }): void {
    this.rest.repos.get.mockResolvedValue({
      data: response,
    });
  }

  /**
   * Setup mock response for adding labels
   */
  mockAddLabels(): void {
    this.rest.issues.addLabels.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'issues',
        method: 'addLabels',
        args,
        timestamp: Date.now(),
      });
      return { data: [] };
    });
  }

  /**
   * Setup mock response for branch creation
   */
  mockCreateRef(): void {
    this.rest.git.createRef.mockResolvedValue({
      data: {
        ref: 'refs/heads/test-branch',
        object: { sha: 'abc123' },
      },
    });
  }

  /**
   * Setup mock response for status checks
   */
  mockListChecks(
    checkRuns: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
    }>
  ): void {
    this.rest.checks.listForRef.mockImplementation(async (...args: any[]) => {
      this.requests.push({
        resource: 'checks',
        method: 'listForRef',
        args,
        timestamp: Date.now(),
      });
      return {
        data: {
          check_runs: checkRuns,
        },
      };
    });
  }

  /**
   * Get all requests made to the API
   */
  getRequests(): any[] {
    return this.requests;
  }

  /**
   * Get requests for a specific resource and method
   */
  getRequestsByType(resource: string, method: string): any[] {
    return this.requests.filter((req) => req.resource === resource && req.method === method);
  }

  /**
   * Verify a specific API call was made
   */
  verifyCalled(resource: string, method: string, times?: number): boolean {
    const calls = this.getRequestsByType(resource, method);
    if (times !== undefined) {
      return calls.length === times;
    }
    return calls.length > 0;
  }

  /**
   * Get the arguments of the last call to a method
   */
  getLastCallArgs(resource: string, method: string): any | null {
    const calls = this.getRequestsByType(resource, method);
    if (calls.length === 0) return null;
    return calls[calls.length - 1].args[0];
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.requests = [];
    Object.keys(this.rest).forEach((resource) => {
      Object.keys(this.rest[resource]).forEach((method) => {
        this.rest[resource][method].mockClear();
      });
    });
  }

  /**
   * Clear all request history
   */
  clearRequests(): void {
    this.requests = [];
  }
}

/**
 * Create a mock Octokit instance
 */
export function createMockOctokit(): MockOctokit {
  return new MockOctokit();
}
