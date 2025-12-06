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
  ) => Promise<{
    data: unknown;
    status: number;
  }>;
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
export declare const githubInputSchema: z.ZodObject<
  {
    action: z.ZodEnum<
      [
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
      ]
    >;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    action:
      | 'get_pr'
      | 'create_comment'
      | 'get_issue'
      | 'get_diff'
      | 'create_issue'
      | 'update_issue'
      | 'get_file'
      | 'create_review'
      | 'list_comments'
      | 'get_workflow_runs'
      | 'trigger_workflow'
      | 'add_labels'
      | 'remove_labels'
      | 'merge_pr';
    params?: Record<string, unknown> | undefined;
  },
  {
    action:
      | 'get_pr'
      | 'create_comment'
      | 'get_issue'
      | 'get_diff'
      | 'create_issue'
      | 'update_issue'
      | 'get_file'
      | 'create_review'
      | 'list_comments'
      | 'get_workflow_runs'
      | 'trigger_workflow'
      | 'add_labels'
      | 'remove_labels'
      | 'merge_pr';
    params?: Record<string, unknown> | undefined;
  }
>;
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
export declare function createGitHubTool(
  client: GitHubClient,
  context: RepoContext
): GitHubToolDefinition;
//# sourceMappingURL=github.d.ts.map
