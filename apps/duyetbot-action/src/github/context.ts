/**
 * GitHub Context Parser
 *
 * Parses GitHub Actions environment and event payload into a structured
 * GitHubContext object used throughout the action.
 */

import { readFileSync } from 'node:fs';

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
  /** Label trigger */
  labelTrigger: string;
  /** User prompt for the agent */
  prompt: string;
  /** Settings JSON string or path */
  settings: string;
  /** Additional CLI arguments */
  claudeArgs: string;
  /** Parsed settings object (merged from settings JSON and env vars) */
  settingsObject?: Settings | undefined;
  /** Specific task ID (from env or settings) */
  taskId?: string;
  /** Task source selection (all, github-issues, file, memory) */
  taskSource?: 'all' | 'github-issues' | 'file' | 'memory';
  /** Continuous mode configuration */
  continuousMode?: 'true' | 'false';
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
  /** Override GitHub token */
  githubToken?: string | undefined;
}

/**
 * Settings structure (from settings JSON)
 */
export interface Settings {
  /** Continuous mode configuration */
  continuous?: {
    enabled?: boolean;
    maxTasks?: number;
    delayBetweenTasks?: number;
    closeIssuesAfterMerge?: boolean;
    stopOnFirstFailure?: boolean;
  };
  /** Auto-merge configuration */
  autoMerge?: {
    enabled?: boolean;
    requiredChecks?: string[];
    closeIssueAfterMerge?: boolean;
    approve?: boolean;
    deleteBranch?: boolean;
    timeout?: number;
  };
  /** Model configuration */
  model?: string;
  /** Task sources configuration */
  taskSources?: Array<'github-issues' | 'file' | 'memory'>;
  /** Dry run mode */
  dryRun?: boolean;
  /** Memory MCP configuration */
  memoryMcp?: {
    url?: string;
  };
  /** Provider configuration */
  provider?: {
    baseUrl?: string;
  };
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

  // Parse settings JSON from INPUT_SETTINGS
  let settingsObject: Settings | undefined;
  const settingsInput = process.env.INPUT_SETTINGS || '';
  if (settingsInput) {
    try {
      // Try parsing as JSON first
      settingsObject = JSON.parse(settingsInput);
    } catch {
      // If not JSON, treat as file path
      try {
        const settingsContent = readFileSync(settingsInput, 'utf-8');
        settingsObject = JSON.parse(settingsContent);
      } catch (error) {
        console.warn(`Failed to parse settings from "${settingsInput}":`, error);
      }
    }
  }

  // Parse inputs from action.yml (simplified interface)
  const inputs: GitHubInputs = {
    triggerPhrase: process.env.TRIGGER_PHRASE || '@duyetbot',
    labelTrigger: process.env.LABEL_TRIGGER || 'duyetbot',
    prompt: process.env.INPUT_PROMPT || '',
    settings: settingsInput,
    claudeArgs: process.env.INPUT_CLAUDE_ARGS || '',
    settingsObject,
    baseBranch: process.env.BASE_BRANCH || '',
    branchPrefix: process.env.BRANCH_PREFIX || 'duyetbot/',
    allowedBots: process.env.ALLOWED_BOTS || '',
    allowedNonWriteUsers: process.env.ALLOWED_NON_WRITE_USERS || '',
    useStickyComment: process.env.USE_STICKY_COMMENT || 'true',
    useCommitSigning: process.env.USE_COMMIT_SIGNING || 'false',
    botId: process.env.BOT_ID || '41898282',
    botName: process.env.BOT_NAME || 'duyetbot[bot]',
    githubToken: process.env.OVERRIDE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || undefined,
  };

  // Merge old env vars for backward compatibility (deprecated but still supported)
  if (process.env.CONTINUOUS_MODE === 'true' || process.env.CONTINUOUS_MODE) {
    settingsObject.continuous = settingsObject.continuous || {};
    settingsObject.continuous.enabled = settingsObject.continuous.enabled ?? true;
  }
  if (process.env.MAX_TASKS) {
    settingsObject.continuous = settingsObject.continuous || {};
    settingsObject.continuous.maxTasks = parseInt(process.env.MAX_TASKS, 10);
  }
  if (process.env.AUTO_MERGE === 'true' || process.env.AUTO_MERGE) {
    settingsObject.autoMerge = settingsObject.autoMerge || {};
    settingsObject.autoMerge.enabled = settingsObject.autoMerge.enabled ?? true;
  }
  if (process.env.CLOSE_ISSUES === 'true' || process.env.CLOSE_ISSUES) {
    settingsObject.autoMerge = settingsObject.autoMerge || {};
    settingsObject.autoMerge.closeIssueAfterMerge =
      settingsObject.autoMerge.closeIssueAfterMerge ?? true;
  }
  if (process.env.DELAY_BETWEEN_TASKS) {
    settingsObject.continuous = settingsObject.continuous || {};
    settingsObject.continuous.delayBetweenTasks =
      parseInt(process.env.DELAY_BETWEEN_TASKS, 10) * 1000;
  }
  if (process.env.DRY_RUN === 'true' || process.env.DRY_RUN) {
    settingsObject.dryRun = true;
  }
  if (process.env.TASK_SOURCE) {
    // Parse comma-separated task sources
    settingsObject.taskSources = process.env.TASK_SOURCE.split(',') as any;
  }
  if (process.env.TASK_ID) {
    // Store task_id for reference (will be picked up by task picker)
    inputs.taskId = process.env.TASK_ID;
  }
  if (process.env.MEMORY_MCP_URL) {
    settingsObject.memoryMcp = settingsObject.memoryMcp || {};
    settingsObject.memoryMcp.url = process.env.MEMORY_MCP_URL;
  }
  if (process.env.BASE_URL) {
    settingsObject.provider = settingsObject.provider || {};
    settingsObject.provider.baseUrl = process.env.BASE_URL;
  }
  if (process.env.MODEL) {
    settingsObject.model = process.env.MODEL;
  }

  // Update inputs with merged settings
  inputs.settingsObject = settingsObject;

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
  if (!payload) {
    return undefined;
  }

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
