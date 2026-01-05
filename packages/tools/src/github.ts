/**
 * GitHub Tool
 *
 * Tool for interacting with GitHub API for repository operations
 */

import { z } from 'zod';

/**
 * GitHub API client interface
 * This should be provided by the agent when creating the tool
 */
export interface GitHubClient {
  request: (
    method: string,
    url: string,
    options?: Record<string, unknown>
  ) => Promise<{ data: unknown; status: number }>;
}

/**
 * Repository context
 */
export interface RepoContext {
  owner: string;
  repo: string;
}

/**
 * GitHub tool input schema
 */
export const githubInputSchema = z.object({
  action: z.enum([
    'get_pr',
    'get_issue',
    'create_issue',
    'update_issue',
    'create_comment',
    'get_diff',
    'get_file',
    'create_review',
    'list_comments',
    'get_workflow_runs',
    'trigger_workflow',
    'add_labels',
    'remove_labels',
    'merge_pr',
    'list_prs',
    'get_pr_status',
  ]),
  params: z.record(z.unknown()).optional(),
});

export type GitHubInput = z.infer<typeof githubInputSchema>;

/**
 * GitHub tool result
 */
export interface GitHubToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * GitHub tool definition
 */
export interface GitHubToolDefinition {
  name: string;
  description: string;
  inputSchema: typeof githubInputSchema;
  execute: (input: GitHubInput) => Promise<GitHubToolResult>;
}

/**
 * Create GitHub tool definition
 */
export function createGitHubTool(client: GitHubClient, context: RepoContext): GitHubToolDefinition {
  return {
    name: 'github',
    description: `Interact with GitHub API for repository operations on ${context.owner}/${context.repo}`,
    inputSchema: githubInputSchema,
    execute: async (input: GitHubInput): Promise<GitHubToolResult> => {
      const { action, params = {} } = input;

      try {
        switch (action) {
          case 'get_pr': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }

            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/pulls/${number}`
            );

            const pr = response.data as {
              title: string;
              body: string;
              state: string;
              changed_files: number;
              commits: number;
              user: { login: string };
              head: { ref: string };
              base: { ref: string };
            };

            return {
              success: true,
              data: {
                title: pr.title,
                body: pr.body,
                state: pr.state,
                files_changed: pr.changed_files,
                commits: pr.commits,
                author: pr.user.login,
                head: pr.head.ref,
                base: pr.base.ref,
              },
            };
          }

          case 'get_issue': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'Issue number is required' };
            }

            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/issues/${number}`
            );

            const issue = response.data as {
              title: string;
              body: string;
              state: string;
              user: { login: string };
              labels: Array<{ name: string }>;
            };

            return {
              success: true,
              data: {
                title: issue.title,
                body: issue.body,
                state: issue.state,
                author: issue.user.login,
                labels: issue.labels.map((l) => l.name),
              },
            };
          }

          case 'create_issue': {
            const title = params.title as string;
            const body = params.body as string;
            if (!title) {
              return { success: false, error: 'Issue title is required' };
            }

            const response = await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/issues`,
              { title, body, labels: params.labels }
            );

            const issue = response.data as { number: number; html_url: string };

            return {
              success: true,
              data: {
                number: issue.number,
                url: issue.html_url,
              },
            };
          }

          case 'update_issue': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'Issue number is required' };
            }

            await client.request(
              'PATCH',
              `/repos/${context.owner}/${context.repo}/issues/${number}`,
              {
                title: params.title,
                body: params.body,
                state: params.state,
                labels: params.labels,
              }
            );

            return { success: true, data: { updated: true } };
          }

          case 'create_comment': {
            const issueNumber = params.issue_number as number;
            const body = params.body as string;
            if (!issueNumber || !body) {
              return {
                success: false,
                error: 'Issue number and body are required',
              };
            }

            const response = await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/issues/${issueNumber}/comments`,
              { body }
            );

            const comment = response.data as { id: number; html_url: string };

            return {
              success: true,
              data: {
                id: comment.id,
                url: comment.html_url,
              },
            };
          }

          case 'get_diff': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }

            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/pulls/${number}`,
              { headers: { Accept: 'application/vnd.github.v3.diff' } }
            );

            return {
              success: true,
              data: { diff: response.data as string },
            };
          }

          case 'get_file': {
            const path = params.path as string;
            const ref = params.ref as string | undefined;
            if (!path) {
              return { success: false, error: 'File path is required' };
            }

            const url = `/repos/${context.owner}/${context.repo}/contents/${path}`;
            const response = await client.request('GET', url, {
              ...(ref && { ref }),
            });

            const file = response.data as {
              content: string;
              encoding: string;
              sha: string;
            };

            // Decode base64 content
            const content =
              file.encoding === 'base64'
                ? Buffer.from(file.content, 'base64').toString('utf-8')
                : file.content;

            return {
              success: true,
              data: { content, sha: file.sha },
            };
          }

          case 'create_review': {
            const number = params.number as number;
            const body = params.body as string;
            const event = (params.event as string) || 'COMMENT';
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }

            const response = await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/pulls/${number}/reviews`,
              {
                body,
                event,
                comments: params.comments,
              }
            );

            const review = response.data as { id: number };

            return {
              success: true,
              data: { review_id: review.id },
            };
          }

          case 'list_comments': {
            const issueNumber = params.issue_number as number;
            if (!issueNumber) {
              return { success: false, error: 'Issue number is required' };
            }

            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/issues/${issueNumber}/comments`
            );

            const comments = response.data as Array<{
              id: number;
              body: string;
              user: { login: string };
              created_at: string;
            }>;

            return {
              success: true,
              data: {
                comments: comments.map((c) => ({
                  id: c.id,
                  body: c.body,
                  author: c.user.login,
                  created_at: c.created_at,
                })),
              },
            };
          }

          case 'get_workflow_runs': {
            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/actions/runs`,
              { per_page: params.limit || 10 }
            );

            const runs = response.data as {
              workflow_runs: Array<{
                id: number;
                name: string;
                status: string;
                conclusion: string;
                html_url: string;
              }>;
            };

            return {
              success: true,
              data: {
                runs: runs.workflow_runs.map((r) => ({
                  id: r.id,
                  name: r.name,
                  status: r.status,
                  conclusion: r.conclusion,
                  url: r.html_url,
                })),
              },
            };
          }

          case 'trigger_workflow': {
            const workflowId = params.workflow_id as string | number;
            const ref = params.ref as string;
            if (!workflowId || !ref) {
              return {
                success: false,
                error: 'Workflow ID and ref (branch) are required',
              };
            }

            await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/actions/workflows/${workflowId}/dispatches`,
              {
                ref,
                inputs: params.inputs || {},
              }
            );

            return {
              success: true,
              data: { triggered: true, workflow_id: workflowId, ref },
            };
          }

          case 'add_labels': {
            const issueNumber = params.issue_number as number;
            const labels = params.labels as string[];
            if (!issueNumber || !labels || labels.length === 0) {
              return {
                success: false,
                error: 'Issue number and labels are required',
              };
            }

            await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/issues/${issueNumber}/labels`,
              { labels }
            );

            return { success: true, data: { added: labels } };
          }

          case 'remove_labels': {
            const issueNumber = params.issue_number as number;
            const labelName = params.label as string;
            if (!issueNumber || !labelName) {
              return {
                success: false,
                error: 'Issue number and label name are required',
              };
            }

            await client.request(
              'DELETE',
              `/repos/${context.owner}/${context.repo}/issues/${issueNumber}/labels/${encodeURIComponent(labelName)}`
            );

            return { success: true, data: { removed: labelName } };
          }

          case 'merge_pr': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }

            const response = await client.request(
              'PUT',
              `/repos/${context.owner}/${context.repo}/pulls/${number}/merge`,
              {
                commit_title: params.commit_title,
                commit_message: params.commit_message,
                merge_method: params.merge_method || 'merge',
              }
            );

            const result = response.data as { sha: string; merged: boolean };

            return {
              success: true,
              data: { merged: result.merged, sha: result.sha },
            };
          }

          case 'list_prs': {
            const state = (params.state as string) || 'open';
            const _perPage = (params.per_page as number) || 100;
            const creator = (params.creator as string) || undefined;
            const labels = (params.labels as string) || undefined;

            const queryParams: Record<string, string | number> = {
              state,
              per_page: _perPage,
              sort: 'created',
              direction: 'desc',
            };
            if (creator) {
              queryParams.creator = creator;
            }
            if (labels) {
              queryParams.labels = labels;
            }

            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/pulls`,
              queryParams
            );

            const prs = response.data as Array<{
              number: number;
              title: string;
              state: string;
              created_at: string;
              updated_at: string;
              user: { login: string; type: string };
              head: { ref: string; sha: string };
              base: { ref: string };
              mergeable: boolean | null;
              merge_state_status: string | null;
              labels: Array<{ name: string }>;
            }>;

            return {
              success: true,
              data: {
                prs: prs.map((pr) => ({
                  number: pr.number,
                  title: pr.title,
                  state: pr.state,
                  created_at: pr.created_at,
                  updated_at: pr.updated_at,
                  author: pr.user.login,
                  author_is_bot: pr.user.type === 'Bot',
                  head_ref: pr.head.ref,
                  base_ref: pr.base.ref,
                  mergeable: pr.mergeable,
                  merge_state_status: pr.merge_state_status,
                  labels: pr.labels.map((l) => l.name),
                })),
                count: prs.length,
              },
            };
          }

          case 'get_pr_status': {
            const number = params.number as number;
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }

            // Fetch PR with status check rollup
            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/pulls/${number}`,
              { headers: { Accept: 'application/vnd.github+json' } }
            );

            const pr = response.data as {
              number: number;
              title: string;
              state: string;
              mergeable: boolean | null;
              merge_state_status: string;
              status_check_rollup?: Array<{
                __typename: string;
                name: string;
                status: string;
                conclusion: string | null;
                workflow_name?: string;
                details_url?: string;
              }>;
            };

            // Parse status checks
            const statusChecks = (pr.status_check_rollup || []).map((check) => ({
              name: check.name,
              status: check.status,
              conclusion: check.conclusion,
              workflow: check.workflow_name || null,
              details_url: check.details_url || null,
            }));

            // Calculate overall status
            const completedChecks = statusChecks.filter((c) => c.status === 'COMPLETED');
            const failedChecks = completedChecks.filter((c) => c.conclusion === 'FAILURE');
            const passedChecks = completedChecks.filter((c) => c.conclusion === 'SUCCESS');
            const pendingChecks = statusChecks.filter(
              (c) => c.status === 'PENDING' || c.status === 'QUEUED'
            );

            const allPassed =
              completedChecks.length > 0 && failedChecks.length === 0 && pendingChecks.length === 0;
            const hasFailures = failedChecks.length > 0;
            const isPending = pendingChecks.length > 0;

            return {
              success: true,
              data: {
                number: pr.number,
                title: pr.title,
                state: pr.state,
                mergeable: pr.mergeable,
                merge_state_status: pr.merge_state_status,
                status_checks: statusChecks,
                summary: {
                  total: statusChecks.length,
                  passed: passedChecks.length,
                  failed: failedChecks.length,
                  pending: pendingChecks.length,
                  all_passed: allPassed,
                  has_failures: hasFailures,
                  is_pending: isPending,
                },
              },
            };
          }

          default:
            return {
              success: false,
              error: `Unknown GitHub action: ${action}`,
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          success: false,
          error: `GitHub API error: ${message}`,
        };
      }
    },
  };
}
