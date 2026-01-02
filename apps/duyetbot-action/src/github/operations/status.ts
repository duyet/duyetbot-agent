/**
 * Status Check Operations
 *
 * GitHub API operations for commit status checks.
 */

import type { Octokit } from '../api/client.js';

export interface StatusCheck {
  context: string;
  state: 'pending' | 'success' | 'failure' | 'error';
  description?: string | undefined;
  targetUrl?: string | undefined;
}

export interface CheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | null;
  detailsUrl?: string | undefined;
  startedAt: string;
  completedAt: string | null;
}

/**
 * Create a status check on a commit
 */
export async function createStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  status: StatusCheck
): Promise<void> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    sha,
    context: status.context,
    state: status.state,
  };
  if (status.description !== undefined) params.description = status.description;
  if (status.targetUrl !== undefined) params.target_url = status.targetUrl;

  await octokit.rest.repos.createCommitStatus(params as any);
}

/**
 * Get combined status for a ref
 */
export async function getCombinedStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<{
  state: string;
  statuses: Array<{
    context: string;
    state: string;
    description: string;
    targetUrl: string;
    createdAt: string;
    updatedAt: string;
  }>;
}> {
  const response = await octokit.rest.repos.getCombinedStatusForRef({
    owner,
    repo,
    ref,
  });

  return {
    state: response.data.state,
    statuses: response.data.statuses.map((status) => ({
      context: status.context,
      state: status.state,
      description: status.description || '',
      targetUrl: status.target_url || '',
      createdAt: status.created_at,
      updatedAt: status.updated_at,
    })),
  };
}

/**
 * List check runs for a ref
 */
export async function listCheckRuns(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<CheckRun[]> {
  const response = await octokit.rest.checks.listForRef({
    owner,
    repo,
    ref,
  });

  return response.data.check_runs
    .filter((run): run is typeof run & { status: 'queued' | 'in_progress' | 'completed' } =>
      ['queued', 'in_progress', 'completed'].includes(run.status)
    )
    .map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion === 'action_required' ? 'failure' : run.conclusion,
      detailsUrl: run.details_url || undefined,
      startedAt: run.started_at ?? '',
      completedAt: run.completed_at,
    }));
}

/**
 * Wait for status checks to complete
 */
export async function waitForStatusChecks(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  options: {
    requiredContexts?: string[];
    timeout: number;
    pollInterval?: number;
  }
): Promise<{
  success: boolean;
  state: string;
  statuses: Array<{ context: string; state: string; description: string }>;
}> {
  const { requiredContexts = [], timeout, pollInterval = 10000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const combined = await getCombinedStatus(octokit, owner, repo, ref);
    const statuses = combined.statuses;

    // Check if any required contexts have failed
    const failedStatuses = statuses.filter((s) => s.state === 'failure' || s.state === 'error');
    const failedRequired = failedStatuses.filter((s) =>
      requiredContexts.length === 0 ? true : requiredContexts.includes(s.context)
    );

    if (failedRequired.length > 0) {
      return {
        success: false,
        state: combined.state,
        statuses: statuses.map((s) => ({
          context: s.context,
          state: s.state,
          description: s.description,
        })),
      };
    }

    // Check if all required contexts have succeeded
    if (requiredContexts.length > 0) {
      const completedRequired = statuses.filter(
        (s) => requiredContexts.includes(s.context) && s.state === 'success'
      );

      if (completedRequired.length >= requiredContexts.length) {
        return {
          success: true,
          state: combined.state,
          statuses: statuses.map((s) => ({
            context: s.context,
            state: s.state,
            description: s.description,
          })),
        };
      }
    } else {
      // No specific contexts required, just wait for overall success
      if (combined.state === 'success') {
        return {
          success: true,
          state: combined.state,
          statuses: statuses.map((s) => ({
            context: s.context,
            state: s.state,
            description: s.description,
          })),
        };
      }
    }

    // Check if overall state is failure
    if (combined.state === 'failure') {
      return {
        success: false,
        state: combined.state,
        statuses: statuses.map((s) => ({
          context: s.context,
          state: s.state,
          description: s.description,
        })),
      };
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('Timeout waiting for status checks');
}

/**
 * Create a check run (GitHub Actions check)
 */
export async function createCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  options: {
    name: string;
    headSha: string;
    detailsUrl?: string;
    externalId?: string;
    status: 'queued' | 'in_progress';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
    output?: {
      title: string;
      summary: string;
      text?: string;
      annotations?: Array<{
        path: string;
        startLine: number;
        endLine: number;
        annotationLevel: 'notice' | 'warning' | 'failure';
        message: string;
      }>;
    };
    startedAt?: string;
    completedAt?: string;
  }
): Promise<{ id: number; htmlUrl: string }> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    name: options.name,
    head_sha: options.headSha,
    status: options.status,
  };

  if (options.detailsUrl !== undefined) params.details_url = options.detailsUrl;
  if (options.externalId !== undefined) params.external_id = options.externalId;
  if (options.conclusion !== undefined) params.conclusion = options.conclusion;
  if (options.startedAt !== undefined) params.started_at = options.startedAt;
  if (options.completedAt !== undefined) params.completed_at = options.completedAt;
  if (options.output !== undefined) {
    params.output = {
      title: options.output.title,
      summary: options.output.summary,
    };
    if (options.output.text !== undefined) (params.output as any).text = options.output.text;
    if (options.output.annotations !== undefined) {
      (params.output as any).annotations = options.output.annotations.map((ann) => ({
        path: ann.path,
        start_line: ann.startLine,
        end_line: ann.endLine,
        annotation_level: ann.annotationLevel,
        message: ann.message,
      }));
    }
  }

  const response = await octokit.rest.checks.create(params as any);

  return {
    id: response.data.id,
    htmlUrl: response.data.html_url ?? '',
  };
}

/**
 * Update a check run
 */
export async function updateCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
  updates: {
    name?: string;
    detailsUrl?: string;
    externalId?: string;
    status?: 'queued' | 'in_progress' | 'completed';
    conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out';
    output?: {
      title: string;
      summary: string;
      text?: string;
      annotations?: Array<{
        path: string;
        startLine: number;
        endLine: number;
        annotationLevel: 'notice' | 'warning' | 'failure';
        message: string;
      }>;
    };
    startedAt?: string;
    completedAt?: string;
  }
): Promise<void> {
  const params: Record<string, unknown> = {
    owner,
    repo,
    check_run_id: checkRunId,
  };

  if (updates.name !== undefined) params.name = updates.name;
  if (updates.detailsUrl !== undefined) params.details_url = updates.detailsUrl;
  if (updates.externalId !== undefined) params.external_id = updates.externalId;
  if (updates.status !== undefined) params.status = updates.status;
  if (updates.conclusion !== undefined) params.conclusion = updates.conclusion;
  if (updates.startedAt !== undefined) params.started_at = updates.startedAt;
  if (updates.completedAt !== undefined) params.completed_at = updates.completedAt;
  if (updates.output !== undefined) {
    params.output = {
      title: updates.output.title,
      summary: updates.output.summary,
    };
    if (updates.output.text !== undefined) (params.output as any).text = updates.output.text;
    if (updates.output.annotations !== undefined) {
      (params.output as any).annotations = updates.output.annotations.map((ann) => ({
        path: ann.path,
        start_line: ann.startLine,
        end_line: ann.endLine,
        annotation_level: ann.annotationLevel,
        message: ann.message,
      }));
    }
  }

  await octokit.rest.checks.update(params as any);
}
