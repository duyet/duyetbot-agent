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
export function createGitHubTool(
  client: GitHubClient,
  context: RepoContext
): GitHubToolDefinition {
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
