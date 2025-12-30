/**
 * GitHub Webhook Task Handler
 *
 * Automatically creates tasks in memory-mcp from GitHub webhooks.
 * Handles:
 * - pull_request.opened -> "Review PR #123: title"
 * - issues.opened -> "Investigate issue #456: title"
 * - push to main -> "Review push to main by user"
 */

import type { WebhookContext } from './middlewares/types.js';

/**
 * Task item returned from memory service
 */
interface TaskItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  priority: number;
  due_date: number | null;
  completed_at: number | null;
  parent_task_id: string | null;
  tags: string[];
  created_at: number;
  updated_at: number;
  metadata: Record<string, unknown> | null;
}

/**
 * RPC interface for memory service addTask method
 */
interface MemoryServiceAddTask {
  addTask: (
    userId: string,
    description: string,
    options?: {
      priority?: number;
      due_date?: number;
      tags?: string[];
      parent_task_id?: string;
      metadata?: Record<string, unknown>;
    }
  ) => Promise<TaskItem>;
}

/**
 * Task creation options for memory-mcp
 */
interface TaskCreationOptions {
  /** Task priority (1-10, default varies by event type) */
  priority?: number;
  /** Tags for categorization */
  tags?: string[];
  /** Additional metadata (URLs, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Result from task creation
 */
interface TaskCreationResult {
  /** Whether task was created successfully */
  success: boolean;
  /** Created task item (if successful) */
  task?: TaskItem;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Default user ID for GitHub webhook tasks
 * Uses a fixed ID since GitHub webhooks aren't tied to a specific user
 */
const GITHUB_USER_ID = 'github-webhook';

/**
 * Get task priority based on event type
 */
function getTaskPriority(eventType: string, action: string): number {
  switch (eventType) {
    case 'pull_request':
      return action === 'opened' ? 7 : 5;
    case 'issues':
      return action === 'opened' ? 6 : 4;
    case 'push':
      return 4;
    default:
      return 5;
  }
}

/**
 * Get task tags based on event type
 */
function getTaskTags(eventType: string, action: string): string[] {
  const tags = ['github'];

  switch (eventType) {
    case 'pull_request':
      tags.push('pr');
      if (action === 'opened') tags.push('review-needed');
      break;
    case 'issues':
      tags.push('issue');
      if (action === 'opened') tags.push('investigation-needed');
      break;
    case 'push':
      tags.push('push');
      break;
  }

  return tags;
}

/**
 * Create task description based on event type
 */
function getTaskDescription(
  eventType: string,
  action: string,
  ctx: WebhookContext
): string {
  const { owner, repo, issue, sender } = ctx;

  switch (eventType) {
    case 'pull_request':
      if (action === 'opened' && issue) {
        return `Review PR #${issue.number}: ${issue.title}`;
      }
      return `PR #${issue?.number ?? 'unknown'}: ${action}`;

    case 'issues':
      if (action === 'opened' && issue) {
        return `Investigate issue #${issue.number}: ${issue.title}`;
      }
      return `Issue #${issue?.number ?? 'unknown'}: ${action}`;

    case 'push':
      return `Review push to ${owner}/${repo} by ${sender.login}`;

    default:
      return `GitHub ${eventType} ${action} in ${owner}/${repo}`;
  }
}

/**
 * Create task metadata with URLs and context
 */
function getTaskMetadata(
  eventType: string,
  ctx: WebhookContext,
  url?: string
): Record<string, unknown> {
  const { owner, repo, issue, sender } = ctx;
  const metadata: Record<string, unknown> = {
    event: eventType,
    owner,
    repo,
    sender: sender.login,
    senderId: sender.id,
  };

  if (issue) {
    metadata.issueNumber = issue.number;
    metadata.issueTitle = issue.title;
    metadata.state = issue.state;
  }

  if (url) {
    metadata.url = url;
  }

  // Add PR-specific metadata
  if (eventType === 'pull_request') {
    if (ctx.additions !== undefined) metadata.additions = ctx.additions;
    if (ctx.deletions !== undefined) metadata.deletions = ctx.deletions;
    if (ctx.commits !== undefined) metadata.commits = ctx.commits;
    if (ctx.changedFiles !== undefined) metadata.changedFiles = ctx.changedFiles;
    if (ctx.headRef !== undefined) metadata.headRef = ctx.headRef;
    if (ctx.baseRef !== undefined) metadata.baseRef = ctx.baseRef;
  }

  return metadata;
}

/**
 * Handle task creation from GitHub webhooks
 *
 * Creates a task in memory-mcp based on the event type:
 * - pull_request.opened: Review PR task (priority 7)
 * - issues.opened: Investigate issue task (priority 6)
 * - push: Review push task (priority 4)
 *
 * @param memoryService - Memory service RPC binding
 * @param eventType - GitHub event type (pull_request, issues, push)
 * @param action - Event action (opened, closed, etc.)
 * @param ctx - Webhook context
 * @param url - Optional URL to the issue/PR
 * @param options - Additional task options
 * @returns Task creation result
 */
export async function handleTaskCreation(
  memoryService: Fetcher,
  eventType: string,
  action: string,
  ctx: WebhookContext,
  url?: string,
  options?: TaskCreationOptions
): Promise<TaskCreationResult> {
  try {
    const description = getTaskDescription(eventType, action, ctx);
    const priority = options?.priority ?? getTaskPriority(eventType, action);
    const tags = options?.tags ?? getTaskTags(eventType, action);
    const metadata = {
      ...getTaskMetadata(eventType, ctx, url),
      ...(options?.metadata ?? {}),
    };

    // Call memory service RPC to create task
    // Type assertion: Fetcher service bindings have RPC methods at runtime
    const task = await (memoryService as unknown as MemoryServiceAddTask).addTask(GITHUB_USER_ID, description, {
      priority,
      tags,
      metadata,
    });

    return {
      success: true,
      task,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if task creation should be enabled for an event
 *
 * Only creates tasks for:
 * - pull_request.opened
 * - issues.opened
 * - push events
 */
export function shouldCreateTask(eventType: string, action: string): boolean {
  switch (eventType) {
    case 'pull_request':
      return action === 'opened';
    case 'issues':
      return action === 'opened';
    case 'push':
      return true;
    default:
      return false;
  }
}
