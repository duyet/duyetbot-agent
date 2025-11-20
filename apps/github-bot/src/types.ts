/**
 * GitHub Bot Types
 */

export interface GitHubRepository {
  owner: {
    login: string;
  };
  name: string;
  full_name: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url?: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: GitHubUser;
  labels: Array<{ name: string }>;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  changed_files: number;
  additions: number;
  deletions: number;
}

export interface MentionContext {
  task: string;
  repository: GitHubRepository;
  issue?: GitHubIssue;
  pullRequest?: GitHubPullRequest;
  comment: GitHubComment;
  mentionedBy: GitHubUser;
}

export interface BotConfig {
  botUsername: string;
  githubToken: string;
  webhookSecret: string;
  mcpServerUrl?: string;
  mcpAuthToken?: string;
}

export type WebhookEventType =
  | 'issue_comment'
  | 'pull_request_review_comment'
  | 'issues'
  | 'pull_request';
