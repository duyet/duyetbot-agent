/**
 * Tag Mode
 *
 * Interactive mode triggered by @duyetbot mentions in issues/PRs.
 * Creates a tracking comment and processes the request.
 */

import type { GitHubContext } from '../../github/context.js';
import * as CommentOps from '../../github/operations/comments.js';
import * as LabelOps from '../../github/operations/labels.js';
import type { Mode, ModeContext, ModeOptions, ModeResult } from '../types.js';

/**
 * Progress comment marker for tracking updates
 */
const PROGRESS_MARKER = '<!-- duyetbot-progress -->';

/**
 * Tag mode implementation
 */
export const tagMode: Mode = {
  name: 'tag',
  description: 'Interactive mode triggered by @duyetbot mentions in issues/PRs',

  /**
   * Tag mode triggers on:
   * - Issue/PR events with @duyetbot mention in body or comments
   * - Issue/PR labeled with "duyetbot"
   * - Issue/PR assigned to "duyetbot"
   */
  shouldTrigger(context: GitHubContext): boolean {
    // Must have an entity (issue or PR)
    if (context.entityNumber === undefined) {
      return false;
    }

    // Check for mention trigger
    const triggerPhrase = context.inputs.triggerPhrase?.toLowerCase() || '@duyetbot';
    // For issue_comment events, check comment body first
    const body =
      context.payload?.comment?.body ||
      context.payload?.issue?.body ||
      context.payload?.pull_request?.body ||
      '';
    if (body.toLowerCase().includes(triggerPhrase)) {
      return true;
    }

    // Check for label trigger
    const labelTrigger = context.inputs.labelTrigger?.toLowerCase() || 'duyetbot';
    const labels = context.payload?.issue?.labels || context.payload?.pull_request?.labels || [];
    if (labels.some((l: any) => l.name?.toLowerCase() === labelTrigger)) {
      return true;
    }

    return false;
  },

  /**
   * Prepare mode context
   */
  prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
    const result: ModeContext = {
      mode: 'tag',
      githubContext: context,
    };
    if (data?.commentId !== undefined) result.commentId = data.commentId;
    if (data?.taskId !== undefined) result.taskId = data.taskId;
    if (data?.branchInfo?.baseBranch !== undefined) result.baseBranch = data.branchInfo.baseBranch;
    if (data?.branchInfo?.claudeBranch !== undefined)
      result.claudeBranch = data.branchInfo.claudeBranch;
    return result;
  },

  /**
   * Tag mode allows most tools except continuous-mode specific ones
   */
  getAllowedTools(): string[] {
    return [
      'bash',
      'git',
      'github',
      'read',
      'write',
      'edit',
      'search',
      'research',
      'plan',
      'run_tests',
    ];
  },

  /**
   * Disallowed tools for tag mode
   */
  getDisallowedTools(): string[] {
    return ['continuous_mode'];
  },

  /**
   * Tag mode creates a tracking comment
   */
  shouldCreateTrackingComment(): boolean {
    return true;
  },

  /**
   * Generate prompt for tag mode
   * Extracts the request from the issue/PR body or comment
   */
  generatePrompt(context: ModeContext): string {
    const { githubContext } = context;
    const triggerPhrase = githubContext.inputs.triggerPhrase || '@duyetbot';

    // Get the content that triggered the bot
    const body =
      githubContext.payload?.comment?.body ||
      githubContext.payload?.issue?.body ||
      githubContext.payload?.pull_request?.body ||
      '';

    // Extract the part after the trigger
    const triggerIndex = body.toLowerCase().indexOf(triggerPhrase.toLowerCase());
    let request = '';
    if (triggerIndex !== -1) {
      request = body.slice(triggerIndex + triggerPhrase.length).trim();
    } else {
      request = body.trim();
    }

    // Build context for the agent
    let prompt = 'You are duyetbot, an AI coding assistant.\n\n';
    prompt += `## Task\n\n${request || 'Help with this issue.'}\n\n`;

    // Add issue/PR context
    if (githubContext.entityNumber) {
      const entityType = githubContext.isPR ? 'Pull Request' : 'Issue';
      prompt += `## ${entityType} Context\n\n`;
      prompt += `- **Number**: #${githubContext.entityNumber}\n`;
      prompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
      prompt += `- **URL**: https://github.com/${githubContext.repository.fullName}/${githubContext.isPR ? 'pull' : 'issues'}/${githubContext.entityNumber}\n`;

      // Add labels if present
      const labels =
        githubContext.payload?.issue?.labels || githubContext.payload?.pull_request?.labels || [];
      if (labels.length > 0) {
        prompt += `- **Labels**: ${labels.map((l: any) => l.name).join(', ')}\n`;
      }
    }

    // Add instructions for this mode
    prompt += `\n## Instructions\n\n`;
    prompt += `1. Analyze the request and the codebase\n`;
    prompt += `2. Create a plan for the changes needed\n`;
    prompt += `3. Implement the changes on a new branch\n`;
    prompt += `4. Create a pull request with your changes\n`;
    prompt += `5. Add a summary comment when done\n`;

    // Add user's prompt from input if provided
    if (githubContext.inputs.prompt) {
      prompt += `\n## Additional Context\n\n${githubContext.inputs.prompt}\n`;
    }

    return prompt;
  },

  /**
   * Get optional system prompt for tag mode
   */
  getSystemPrompt(context: ModeContext): string {
    const { githubContext } = context;

    let systemPrompt = '\n## GitHub Context\n\n';
    systemPrompt += `- **Actor**: ${githubContext.actor}\n`;
    systemPrompt += `- **Event**: ${githubContext.eventName}`;
    if (githubContext.eventAction) {
      systemPrompt += ` (${githubContext.eventAction})`;
    }
    systemPrompt += '\n';
    systemPrompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
    systemPrompt += `- **Run ID**: ${githubContext.runId}\n`;

    return systemPrompt;
  },

  /**
   * Prepare the GitHub environment for tag mode
   * Creates/updates a tracking comment and sets up branch if needed
   */
  async prepare(options: ModeOptions): Promise<ModeResult> {
    const { context, octokit } = options;
    const { owner, repo } = context.repository;
    const entityNumber = context.entityNumber!;

    console.log('\n🏷️  Tag Mode Preparation');
    console.log(`  Repository: ${owner}/${repo}`);
    console.log(`  ${context.isPR ? 'PR' : 'Issue'}: #${entityNumber}`);

    // Find existing tracking comment
    const botName = context.inputs.botName || 'duyetbot[bot]';
    let existingComment = null;
    try {
      existingComment = await CommentOps.findBotComment(
        octokit,
        owner,
        repo,
        entityNumber,
        botName,
        PROGRESS_MARKER
      );
    } catch {
      // Ignore errors finding existing comment
    }

    let commentId: number | undefined;
    const taskId = `tag-${owner}-${repo}-${entityNumber}-${Date.now()}`;

    // Create or update tracking comment
    const progressComment = generateProgressComment({
      mode: 'tag',
      taskId,
      status: 'starting',
      message: '🤖 Initializing...',
    });

    if (existingComment) {
      try {
        await CommentOps.updateComment(octokit, {
          owner,
          repo,
          commentId: existingComment.id,
          body: progressComment,
        });
        commentId = existingComment.id;
        console.log(`  ✓ Updated existing comment #${existingComment.id}`);
      } catch {
        // Fall through to create new comment
      }
    }

    if (!commentId) {
      try {
        const result = await CommentOps.createComment(octokit, {
          owner,
          repo,
          issueNumber: entityNumber,
          body: progressComment,
        });
        commentId = result.id;
        console.log(`  ✓ Created tracking comment #${result.id}`);
      } catch {
        // Comment creation failed, continue without it
      }
    }

    // Add "in-progress" label
    try {
      await LabelOps.addLabels(octokit, owner, repo, entityNumber, ['agent:working']);
    } catch {
      // Label might not exist, ignore
    }

    // Determine base branch
    const baseBranch = context.inputs.baseBranch || 'main';

    return {
      commentId,
      branchInfo: {
        baseBranch,
        claudeBranch: undefined,
        currentBranch: baseBranch,
      },
      taskId,
      shouldExecute: true,
    };
  },
};

/**
 * Generate progress tracking comment body
 */
function generateProgressComment(options: {
  mode: string;
  taskId: string;
  status: 'starting' | 'running' | 'success' | 'error';
  message: string;
  output?: string;
  prUrl?: string;
}): string {
  const { mode, taskId, status, message, output, prUrl } = options;

  const statusIcons = {
    starting: '🔄',
    running: '⚙️',
    success: '✅',
    error: '❌',
  };

  let comment = `## 🤖 Duyetbot ${statusIcons[status]} ${status === 'success' ? 'Complete' : status === 'error' ? 'Failed' : 'Working'}\n\n`;
  comment += `**Mode:** ${mode}\n`;
  comment += `**Task ID:** \`${taskId}\`\n\n`;
  comment += `### Status\n\n${message}\n`;

  if (output && output.length > 0) {
    comment += `\n### Output\n\n`;
    const truncated = output.slice(0, 2000);
    comment += `\`\`\`\n${truncated}${output.length > 2000 ? '\n...(truncated)' : ''}\n\`\`\`\n`;
  }

  if (prUrl) {
    comment += `\n### Pull Request\n\n${prUrl}\n`;
  }

  comment += `\n${PROGRESS_MARKER}\n`;

  return comment;
}
