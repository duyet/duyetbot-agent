/**
 * GitHub Tool
 *
 * Tool for interacting with GitHub API for repository operations
 */
import { z } from 'zod';
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
  ]),
  params: z.record(z.unknown()).optional(),
});
/**
 * Create GitHub tool definition
 */
export function createGitHubTool(client, context) {
  return {
    name: 'github',
    description: `Interact with GitHub API for repository operations on ${context.owner}/${context.repo}`,
    inputSchema: githubInputSchema,
    execute: async (input) => {
      const { action, params = {} } = input;
      try {
        switch (action) {
          case 'get_pr': {
            const number = params.number;
            if (!number) {
              return { success: false, error: 'PR number is required' };
            }
            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/pulls/${number}`
            );
            const pr = response.data;
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
            const number = params.number;
            if (!number) {
              return { success: false, error: 'Issue number is required' };
            }
            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/issues/${number}`
            );
            const issue = response.data;
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
            const title = params.title;
            const body = params.body;
            if (!title) {
              return { success: false, error: 'Issue title is required' };
            }
            const response = await client.request(
              'POST',
              `/repos/${context.owner}/${context.repo}/issues`,
              { title, body, labels: params.labels }
            );
            const issue = response.data;
            return {
              success: true,
              data: {
                number: issue.number,
                url: issue.html_url,
              },
            };
          }
          case 'update_issue': {
            const number = params.number;
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
            const issueNumber = params.issue_number;
            const body = params.body;
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
            const comment = response.data;
            return {
              success: true,
              data: {
                id: comment.id,
                url: comment.html_url,
              },
            };
          }
          case 'get_diff': {
            const number = params.number;
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
              data: { diff: response.data },
            };
          }
          case 'get_file': {
            const path = params.path;
            const ref = params.ref;
            if (!path) {
              return { success: false, error: 'File path is required' };
            }
            const url = `/repos/${context.owner}/${context.repo}/contents/${path}`;
            const response = await client.request('GET', url, {
              ...(ref && { ref }),
            });
            const file = response.data;
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
            const number = params.number;
            const body = params.body;
            const event = params.event || 'COMMENT';
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
            const review = response.data;
            return {
              success: true,
              data: { review_id: review.id },
            };
          }
          case 'list_comments': {
            const issueNumber = params.issue_number;
            if (!issueNumber) {
              return { success: false, error: 'Issue number is required' };
            }
            const response = await client.request(
              'GET',
              `/repos/${context.owner}/${context.repo}/issues/${issueNumber}/comments`
            );
            const comments = response.data;
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
            const runs = response.data;
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
            const workflowId = params.workflow_id;
            const ref = params.ref;
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
            const issueNumber = params.issue_number;
            const labels = params.labels;
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
            const issueNumber = params.issue_number;
            const labelName = params.label;
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
            const number = params.number;
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
            const result = response.data;
            return {
              success: true,
              data: { merged: result.merged, sha: result.sha },
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
