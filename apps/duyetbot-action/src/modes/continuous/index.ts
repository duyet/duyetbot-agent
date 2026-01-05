/**
 * Continuous Mode
 *
 * Processes multiple tasks until none remain.
 * Loops through tasks from configured sources.
 */

import type { GitHubContext } from '../../github/context.js';
import type { Mode, ModeContext, ModeOptions, ModeResult } from '../types.js';

/**
 * Continuous mode implementation
 */
export const continuousMode: Mode = {
  name: 'continuous',
  description: 'Continuous mode - process all tasks until done',

  /**
   * Continuous mode triggers when continuous_mode input is true
   */
  shouldTrigger(context: GitHubContext): boolean {
    return context.inputs.continuousMode === 'true';
  },

  /**
   * Prepare mode context
   */
  prepareContext(context: GitHubContext, data?: Partial<ModeResult>): ModeContext {
    const result: ModeContext = {
      mode: 'continuous',
      githubContext: context,
    };
    if (data?.commentId !== undefined) {
      result.commentId = data.commentId;
    }
    if (data?.taskId !== undefined) {
      result.taskId = data.taskId;
    }
    if (data?.branchInfo?.baseBranch !== undefined) {
      result.baseBranch = data.branchInfo.baseBranch;
    }
    if (data?.branchInfo?.claudeBranch !== undefined) {
      result.claudeBranch = data.branchInfo.claudeBranch;
    }
    return result;
  },

  /**
   * Continuous mode allows all tools including continuous-mode specific ones
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
      'continuous_mode',
    ];
  },

  /**
   * No disallowed tools for continuous mode
   */
  getDisallowedTools(): string[] {
    return [];
  },

  /**
   * Continuous mode creates a tracking comment if there's an entity
   */
  shouldCreateTrackingComment(): boolean {
    return true;
  },

  /**
   * Generate prompt for continuous mode
   */
  generatePrompt(context: ModeContext): string {
    const { githubContext } = context;

    const maxTasks = parseInt(githubContext.inputs.maxTasks || '100', 10);
    const taskSource = githubContext.inputs.taskSource || 'github-issues';

    let prompt = `You are duyetbot, an AI coding assistant in continuous mode.\n\n`;
    prompt += `## Continuous Mode Configuration\n\n`;
    prompt += `- **Task Source**: ${taskSource}\n`;
    prompt += `- **Max Tasks**: ${maxTasks}\n`;
    prompt += `- **Auto-Merge**: ${githubContext.inputs.autoMerge || 'true'}\n`;
    prompt += `- **Close Issues**: ${githubContext.inputs.closeIssues || 'true'}\n`;

    // Add any prompt input as initial task context
    if (githubContext.inputs.prompt) {
      prompt += `\n## Initial Context\n\n${githubContext.inputs.prompt}\n`;
    }

    prompt += `\n## Instructions\n\n`;
    prompt += `1. Fetch pending tasks from the configured source\n`;
    prompt += `2. Process each task sequentially:\n`;
    prompt += `   - Analyze the task\n`;
    prompt += `   - Create a plan\n`;
    prompt += `   - Implement changes on a new branch\n`;
    prompt += `   - Create a pull request\n`;
    prompt += `   - Optionally auto-merge if checks pass\n`;
    prompt += `   - Mark task as complete\n`;
    prompt += `3. Continue until no tasks remain or max_tasks is reached\n`;
    prompt += `4. Report final summary\n`;

    return prompt;
  },

  /**
   * Get optional system prompt for continuous mode
   */
  getSystemPrompt(context: ModeContext): string {
    const { githubContext } = context;

    let systemPrompt = '\n## GitHub Context\n\n';
    systemPrompt += `- **Actor**: ${githubContext.actor}\n`;
    systemPrompt += `- **Event**: ${githubContext.eventName}\n`;
    systemPrompt += `- **Repository**: ${githubContext.repository.fullName}\n`;
    systemPrompt += `- **Run ID**: ${githubContext.runId}\n`;

    // Add continuous mode settings
    systemPrompt += `\n## Continuous Mode Settings\n\n`;
    systemPrompt += `- **Max Tasks**: ${githubContext.inputs.maxTasks || '100'}\n`;
    systemPrompt += `- **Delay Between Tasks**: ${githubContext.inputs.delayBetweenTasks || '5'}s\n`;
    systemPrompt += `- **Auto-Merge**: ${githubContext.inputs.autoMerge || 'true'}\n`;
    systemPrompt += `- **Close Issues**: ${githubContext.inputs.closeIssues || 'true'}\n`;

    return systemPrompt;
  },

  /**
   * Prepare the GitHub environment for continuous mode
   */
  async prepare(options: ModeOptions): Promise<ModeResult> {
    const { context, octokit } = options;
    const { owner, repo } = context.repository;

    console.log(`\n🔄 Continuous Mode Preparation`);
    console.log(`  Repository: ${owner}/${repo}`);
    console.log(`  Max Tasks: ${context.inputs.maxTasks || '100'}`);
    console.log(`  Task Source: ${context.inputs.taskSource || 'github-issues'}`);

    let commentId: number | undefined;
    const taskId = `continuous-${owner}-${repo}-${Date.now()}`;

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
        message: '🔄 Starting continuous mode...',
        maxTasks: parseInt(context.inputs.maxTasks || '100', 10),
      });

      const result = await CommentOps.createComment(octokit, {
        owner,
        repo,
        issueNumber: context.entityNumber,
        body: progressComment,
      });
      commentId = result.id;
      console.log(`  ✓ Created tracking comment #${result.id}`);

      // Add continuous mode label
      try {
        await LabelOps.addLabels(octokit, owner, repo, context.entityNumber, ['agent:continuous']);
      } catch {
        // Label might not exist
      }
    } else {
      console.log(`  Running continuous mode on repository`);
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
 * Generate progress tracking comment body for continuous mode
 */
function generateProgressComment(options: {
  taskId: string;
  status: 'starting' | 'running' | 'success' | 'error';
  message: string;
  maxTasks: number;
  tasksProcessed?: number;
  output?: string;
}): string {
  const { taskId, status, message, maxTasks, tasksProcessed, output } = options;

  const statusIcons = {
    starting: '🔄',
    running: '⚙️',
    success: '✅',
    error: '❌',
  };

  let comment = `## 🔄 Duyetbot Continuous Mode ${statusIcons[status]}\n\n`;
  comment += `**Session ID:** \`${taskId}\`\n`;
  comment += `**Max Tasks:** ${maxTasks}\n`;
  if (tasksProcessed !== undefined) {
    comment += `**Tasks Processed:** ${tasksProcessed}/${maxTasks}\n`;
  }
  comment += `\n### Status\n\n${message}\n`;

  if (output && output.length > 0) {
    comment += `\n### Recent Output\n\n`;
    const truncated = output.slice(0, 1500);
    comment += `\`\`\`\n${truncated}${output.length > 1500 ? '\n...(truncated)' : ''}\n\`\`\`\n`;
  }

  comment += `\n<!-- duyetbot-continuous-progress -->\n`;

  return comment;
}
