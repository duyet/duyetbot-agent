/**
 * Agent Mode
 *
 * Direct automation mode for explicit prompts.
 * Runs when given a direct task via prompt input or issue creation.
 */

import type { GitHubContext } from '../../github/context.js';
import type { Mode, ModeContext, ModeOptions, ModeResult } from '../types.js';

/**
 * Agent mode implementation
 */
export const agentMode: Mode = {
  name: 'agent',
  description: 'Direct automation mode for explicit prompts',

  /**
   * Agent mode triggers on:
   * - workflow_dispatch with prompt input
   * - Issue opened (auto-triggers with default prompt)
   * - Issue labeled with "agent-task"
   * - Any context with explicit prompt input
   */
  shouldTrigger(context: GitHubContext): boolean {
    // Explicit prompt always triggers agent mode
    if (context.inputs.prompt) {
      return true;
    }

    // workflow_dispatch with prompt
    if (context.eventName === 'workflow_dispatch') {
      return true;
    }

    // Issue opened - auto-trigger
    if (context.eventName === 'issues' && context.eventAction === 'opened') {
      return true;
    }

    // Issue labeled with "agent-task"
    if (context.eventName === 'issues' && context.eventAction === 'labeled') {
      const labels = context.payload?.issue?.labels || [];
      if (labels.some((l: any) => l.name === 'agent-task')) {
        return true;
      }
    }

    return false;
  },

  /**
   * Prepare mode context
   */
  prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
    const result: ModeContext = {
      mode: 'agent',
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
   * Agent mode allows all tools
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
   * No disallowed tools for agent mode
   */
  getDisallowedTools(): string[] {
    return [];
  },

  /**
   * Agent mode only creates tracking comment if there's an entity
   */
  shouldCreateTrackingComment(): boolean {
    return true;
  },

  /**
   * Generate prompt for agent mode
   */
  generatePrompt(context: ModeContext): string {
    const { githubContext } = context;

    // Use the explicit prompt if provided
    const promptInput = githubContext.inputs.prompt;

    let prompt = `You are duyetbot, an AI coding assistant.\n\n`;

    // Build the task description
    if (promptInput) {
      prompt += `## Task\n\n${promptInput}\n\n`;
    } else if (githubContext.eventName === 'issues' && githubContext.entityNumber) {
      // Use issue content as prompt
      const issue = githubContext.payload?.issue;
      prompt += `## Task\n\n`;
      prompt += `Process this issue:\n\n`;
      prompt += `**Title:** ${issue?.title}\n\n`;
      prompt += `**Body:**\n${issue?.body || '(No description)'}\n\n`;
    } else {
      prompt += `## Task\n\nHelp with this repository.\n\n`;
    }

    // Add context about the repository
    prompt += `## Repository Context\n\n`;
    prompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
    if (githubContext.entityNumber) {
      const entityType = githubContext.isPR ? 'Pull Request' : 'Issue';
      prompt += `- **${entityType}**: #${githubContext.entityNumber}\n`;
      prompt += `- **URL**: https://github.com/${githubContext.repository.fullName}/${githubContext.isPR ? 'pull' : 'issues'}/${githubContext.entityNumber}\n`;
    }

    // Add instructions
    prompt += `\n## Instructions\n\n`;
    prompt += `1. Understand the task and analyze the codebase\n`;
    prompt += `2. Create a plan for implementation\n`;
    prompt += `3. Implement the changes\n`;
    prompt += `4. Test and verify the changes\n`;
    prompt += `5. Report results\n`;

    return prompt;
  },

  /**
   * Get optional system prompt for agent mode
   */
  getSystemPrompt(context: ModeContext): string {
    const { githubContext } = context;

    let systemPrompt = '\n## GitHub Context\n\n';
    systemPrompt += `- **Actor**: ${githubContext.actor}\n`;
    systemPrompt += `- **Event**: ${githubContext.eventName}`;
    if (githubContext.eventAction) {
      systemPrompt += ` (${githubContext.eventAction})\n`;
    } else {
      systemPrompt += '\n';
    }
    systemPrompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
    systemPrompt += `- **Run ID**: ${githubContext.runId}\n`;

    return systemPrompt;
  },

  /**
   * Prepare the GitHub environment for agent mode
   */
  async prepare(options: ModeOptions): Promise<ModeResult> {
    const { context, octokit } = options;
    const { owner, repo } = context.repository;

    console.log(`\n🤖 Agent Mode Preparation`);
    console.log(`  Repository: ${owner}/${repo}`);

    let commentId: number | undefined;
    const taskId = `agent-${owner}-${repo}-${Date.now()}`;

    // Only create comment if there's an entity (issue/PR)
    if (context.entityNumber) {
      console.log(`  ${context.isPR ? 'PR' : 'Issue'}: #${context.entityNumber}`);

      // Import dynamically to avoid circular deps
      const CommentOps = await import('../../github/operations/comments.js');
      const LabelOps = await import('../../github/operations/labels.js');

      // Create tracking comment
      const progressComment = generateProgressComment({
        taskId,
        status: 'starting',
        message: '🤖 Starting agent task...',
      });

      const result = await CommentOps.createComment(octokit, {
        owner,
        repo,
        issueNumber: context.entityNumber,
        body: progressComment,
      });
      commentId = result.id;
      console.log(`  ✓ Created tracking comment #${result.id}`);

      // Add "in-progress" label
      try {
        await LabelOps.addLabels(octokit, owner, repo, context.entityNumber, ['agent:working']);
      } catch {
        // Label might not exist
      }
    } else {
      console.log(`  No entity - running in standalone mode`);
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
  taskId: string;
  status: 'starting' | 'running' | 'success' | 'error';
  message: string;
  output?: string;
  prUrl?: string;
}): string {
  const { taskId, status, message, output, prUrl } = options;

  const statusIcons = {
    starting: '🔄',
    running: '⚙️',
    success: '✅',
    error: '❌',
  };

  let comment = `## 🤖 Duyetbot Agent ${statusIcons[status]}\n\n`;
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

  comment += `\n<!-- duyetbot-agent-progress -->\n`;

  return comment;
}
