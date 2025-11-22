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
  comment?: GitHubComment;
  mentionedBy: GitHubUser;
}

export interface IssueHandlerConfig {
  /** Actions to respond to automatically */
  autoRespondActions?: Array<'opened' | 'reopened'>;
  /** Labels that trigger automatic analysis */
  triggerLabels?: string[];
  /** System prompt template for issue analysis */
  analysisPromptTemplate?: string;
}

export interface PullRequestHandlerConfig {
  /** Actions to respond to automatically */
  autoRespondActions?: Array<'opened' | 'ready_for_review' | 'synchronize'>;
  /** Labels that trigger automatic review */
  triggerLabels?: string[];
  /** Whether to auto-review when ready for review */
  autoReviewOnReady?: boolean;
  /** Custom prompt for PR analysis */
  analysisPromptTemplate?: string;
}

export interface BotConfig {
  botUsername: string;
  githubToken: string;
  webhookSecret: string;
  mcpServerUrl?: string;
  mcpAuthToken?: string;
  /** LLM model to use */
  model?: string | undefined;
  /** Cloudflare AI binding */
  AI?: any;
  /** AI Gateway name */
  AI_GATEWAY_NAME?: string | undefined;
  /** AI Gateway provider (e.g., 'openrouter') */
  AI_GATEWAY_PROVIDER?: string | undefined;
  /** AI Gateway API key */
  AI_GATEWAY_API_KEY?: string | undefined;
  /** Configuration for issue event handling */
  issueHandlerConfig?: IssueHandlerConfig;
  /** Configuration for pull request event handling */
  pullRequestHandlerConfig?: PullRequestHandlerConfig;
}

export type WebhookEventType =
  | 'issue_comment'
  | 'pull_request_review_comment'
  | 'issues'
  | 'pull_request';
