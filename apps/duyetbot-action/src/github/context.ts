/**
 * GitHub Context Parser
 *
 * Parses GitHub Actions environment and event payload into a structured
 * GitHubContext object used throughout the action.
 */

import * as core from '@actions/core';
import { readFileSync } from 'fs';

/**
 * Parsed GitHub context with all information needed for mode detection
 * and action execution
 */
export interface GitHubContext {
  /** Event name (e.g., issues, pull_request, workflow_dispatch) */
  eventName: string;
  /** Event action (e.g., opened, labeled, created) */
  eventAction?: string | undefined;
  /** Actor who triggered the event */
  actor: string;
  /** Repository information */
  repository: {
    owner: string;
    repo: string;
    fullName: string;
  };
  /** Issue or PR number */
  entityNumber?: number | undefined;
  /** Whether this is a PR event */
  isPR: boolean;
  /** Raw event payload */
  payload?: any | undefined;
  /** Parsed inputs from action.yml */
  inputs: GitHubInputs;
  /** Run ID */
  runId: string;
}

/**
 * Parsed action inputs
 */
export interface GitHubInputs {
  /** Trigger phrase for mentions (e.g., @duyetbot) */
  triggerPhrase: string;
  /** Assignee username trigger */
  assigneeTrigger: string;
  /** Label trigger */
  labelTrigger: string;
  /** User prompt for the agent */
  prompt: string;
  /** Settings JSON */
  settings: string;
  /** Continuous mode enabled */
  continuousMode: string;
  /** Maximum tasks in continuous mode */
  maxTasks: string;
  /** Auto-merge enabled */
  autoMerge: string;
  /** Close issues after merge */
  closeIssues: string;
  /** Delay between tasks */
  delayBetweenTasks: string;
  /** Dry run mode */
  dryRun: string;
  /** Task source */
  taskSource: string;
  /** Specific task ID */
  taskId: string;
  /** Base branch */
  baseBranch: string;
  /** Branch prefix */
  branchPrefix: string;
  /** Allowed bots */
  allowedBots: string;
  /** Allowed non-write users */
  allowedNonWriteUsers: string;
  /** Use sticky comment */
  useStickyComment: string;
  /** Use commit signing */
  useCommitSigning: string;
  /** Bot ID */
  botId: string;
  /** Bot name */
  botName: string;
  /** Memory MCP URL */
  memoryMcpUrl: string;
  /** Override GitHub token */
  githubToken?: string | undefined;
}

/**
 * Parses the GitHub context from environment variables and event payload
 */
export function parseGitHubContext(): GitHubContext {
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const eventAction = process.env.GITHUB_EVENT_ACTION;
  const actor = process.env.GITHUB_ACTOR || '';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const runId = process.env.GITHUB_RUN_ID || '';
  const eventPath = process.env.GITHUB_EVENT_PATH;

  // Parse repository - handle potential undefined values
  const parts = repository.split('/');
  const owner = parts[0] || '';
  const repo = parts[1] || '';

  // Load event payload
  let payload: any;
  if (eventPath) {
    try {
      payload = JSON.parse(readFileSync(eventPath, 'utf-8'));
    } catch (error) {
      console.warn(`Failed to load event payload from ${eventPath}:`, error);
    }
  }

  // Parse inputs from action.yml
  const inputs: GitHubInputs = {
    triggerPhrase: core.getInput('trigger_phrase') || '@duyetbot',
    assigneeTrigger: core.getInput('assignee_trigger') || 'duyetbot',
    labelTrigger: core.getInput('label_trigger') || 'duyetbot',
    prompt: core.getInput('prompt') || '',
    settings: core.getInput('settings') || '',
    continuousMode: core.getInput('continuous_mode') || 'false',
    maxTasks: core.getInput('max_tasks') || '100',
    autoMerge: core.getInput('auto_merge') || 'true',
    closeIssues: core.getInput('close_issues') || 'true',
    delayBetweenTasks: core.getInput('delay_between_tasks') || '5',
    dryRun: core.getInput('dry_run') || 'false',
    taskSource: core.getInput('task_source') || 'github-issues',
    taskId: core.getInput('task_id') || '',
    baseBranch: core.getInput('base_branch') || '',
    branchPrefix: core.getInput('branch_prefix') || 'duyetbot/',
    allowedBots: core.getInput('allowed_bots') || '',
    allowedNonWriteUsers: core.getInput('allowed_non_write_users') || '',
    useStickyComment: core.getInput('use_sticky_comment') || 'true',
    useCommitSigning: core.getInput('use_commit_signing') || 'false',
    botId: core.getInput('bot_id') || '41898282',
    botName: core.getInput('bot_name') || 'duyetbot[bot]',
    memoryMcpUrl: core.getInput('memory_mcp_url') || '',
    githubToken: core.getInput('github_token') || undefined,
  };

  const entityNumber = getEntityNumber(payload, eventName);
  const isPR = isPREvent(payload, eventName);

  return {
    eventName,
    eventAction,
    actor,
    repository: {
      owner,
      repo,
      fullName: repository,
    },
    entityNumber,
    isPR,
    payload,
    inputs,
    runId,
  };
}

/**
 * Extracts the entity number (issue or PR number) from the payload
 */
function getEntityNumber(payload: any, eventName: string): number | undefined {
  if (!payload) return undefined;

  if (eventName === 'pull_request' || eventName === 'pull_request_review') {
    return payload.pull_request?.number;
  }
  if (eventName === 'issues' || eventName === 'issue_comment') {
    return payload.issue?.number;
  }

  return undefined;
}

/**
 * Determines if this is a PR-related event
 */
function isPREvent(payload: any, eventName: string): boolean {
  return (
    eventName === 'pull_request' ||
    eventName === 'pull_request_review' ||
    eventName === 'pull_request_review_comment' ||
    eventName === 'pull_request_target' ||
    !!payload?.pull_request ||
    !!payload?.issue?.pull_request
  );
}

/**
 * Type guard to check if context is an entity context (has an issue or PR)
 */
export function isEntityContext(context: GitHubContext): boolean {
  return context.entityNumber !== undefined;
}

/**
 * Type guard to check if context is a workflow dispatch event
 */
export function isWorkflowDispatch(context: GitHubContext): boolean {
  return context.eventName === 'workflow_dispatch';
}
