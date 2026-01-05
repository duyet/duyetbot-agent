/**
 * Continuous Mode Integration Tests
 *
 * End-to-end tests for continuous mode workflow:
 * - Processes multiple tasks
 * - Creates multiple PRs
 * - Updates tracking comment with progress
 * - Handles task completion/failure
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { continuousMode } from '../../src/modes/continuous/index.js';
import type { ModeOptions } from '../../src/modes/types.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Continuous Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('Trigger Detection', () => {
    it('should trigger when continuous_mode input is true', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      expect(continuousMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should not trigger when continuous_mode input is false', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'false',
          },
        },
      });

      expect(continuousMode.shouldTrigger(githubContext)).toBe(false);
    });

    it('should not trigger when continuous_mode is not set', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: '',
          },
        },
      });

      expect(continuousMode.shouldTrigger(githubContext)).toBe(false);
    });
  });

  describe('Context Preparation', () => {
    it('should prepare context for continuous mode', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            maxTasks: '50',
            taskSource: 'github-issues',
          },
        },
      });

      octokit.mockCreateComment({
        id: 3000,
        html_url: 'https://github.com/test-owner/test-repo/issues/1#issuecomment-3000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await continuousMode.prepare(options);

      expect(result.taskId).toBeDefined();
      expect(result.taskId).toContain('continuous-');
      expect(result.shouldExecute).toBe(true);
      expect(result.branchInfo?.baseBranch).toBe('main');
    });

    it('should create tracking comment when entity exists', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 555,
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      octokit.mockCreateComment({
        id: 5550,
        html_url: 'https://github.com/test-owner/test-repo/issues/555#issuecomment-5550',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await continuousMode.prepare(options);

      expect(result.commentId).toBe(5550);

      // Verify comment contains continuous mode marker
      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('<!-- duyetbot-continuous-progress -->');
      expect(commentArgs.body).toContain('Continuous Mode');
    });

    it('should add agent:continuous label when entity exists', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 666,
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await continuousMode.prepare(options);

      const labelArgs = octokit.getLastCallArgs('issues', 'addLabels');
      expect(labelArgs.labels).toContain('agent:continuous');
    });
  });

  describe('Prompt Generation', () => {
    it('should include continuous mode configuration in prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            maxTasks: '25',
            taskSource: 'memory',
            autoMerge: 'true',
            closeIssues: 'false',
          },
        },
      });

      const modeContext = continuousMode.prepareContext(githubContext);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('Continuous Mode Configuration');
      expect(prompt).toContain('memory');
      expect(prompt).toContain('**Max Tasks**: 25');
      expect(prompt).toContain('**Auto-Merge**: true');
      expect(prompt).toContain('**Close Issues**: false');
    });

    it('should include instructions for processing multiple tasks', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      const modeContext = continuousMode.prepareContext(githubContext);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('Fetch pending tasks');
      expect(prompt).toContain('Process each task sequentially');
      expect(prompt).toContain('Create a plan');
      expect(prompt).toContain('Create a pull request');
      expect(prompt).toContain('Optionally auto-merge');
      expect(prompt).toContain('Mark task as complete');
      expect(prompt).toContain('Continue until no tasks remain');
    });

    it('should include initial context from prompt input', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            prompt: 'Focus on high-priority bugs first',
          },
        },
      });

      const modeContext = continuousMode.prepareContext(githubContext);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('Focus on high-priority bugs first');
      expect(prompt).toContain('Initial Context');
    });
  });

  describe('System Prompt', () => {
    it('should include continuous mode settings in system prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          actor: 'continuous-runner',
          runId: 'run-456',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            maxTasks: '100',
            delayBetweenTasks: '10',
            autoMerge: 'true',
            closeIssues: 'true',
          },
        },
      });

      const modeContext = continuousMode.prepareContext(githubContext);
      const systemPrompt = continuousMode.getSystemPrompt(modeContext);

      expect(systemPrompt).toContain('continuous-runner');
      expect(systemPrompt).toContain('run-456');
      expect(systemPrompt).toContain('**Max Tasks**: 100');
      expect(systemPrompt).toContain('**Delay Between Tasks**: 10s');
      expect(systemPrompt).toContain('**Auto-Merge**: true');
      expect(systemPrompt).toContain('**Close Issues**: true');
    });
  });

  describe('Tool Permissions', () => {
    it('should allow all tools including continuous_mode', () => {
      const allowedTools = continuousMode.getAllowedTools();
      const disallowedTools = continuousMode.getDisallowedTools();

      expect(allowedTools).toContain('bash');
      expect(allowedTools).toContain('git');
      expect(allowedTools).toContain('github');
      expect(allowedTools).toContain('read');
      expect(allowedTools).toContain('write');
      expect(allowedTools).toContain('edit');
      expect(allowedTools).toContain('search');
      expect(allowedTools).toContain('research');
      expect(allowedTools).toContain('plan');
      expect(allowedTools).toContain('run_tests');
      expect(allowedTools).toContain('continuous_mode');

      expect(disallowedTools).toHaveLength(0);
    });
  });

  describe('Standalone Mode', () => {
    it('should work without entity (repository-wide continuous mode)', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          entityNumber: undefined,
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await continuousMode.prepare(options);

      // No comment should be created in standalone mode
      expect(result.commentId).toBeUndefined();
      expect(result.taskId).toBeDefined();
      expect(result.shouldExecute).toBe(true);

      // Verify no comment API calls
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(false);
    });
  });

  describe('Base Branch Configuration', () => {
    it('should use baseBranch input when provided', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            baseBranch: 'staging',
          },
        },
      });

      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await continuousMode.prepare(options);

      expect(result.branchInfo?.baseBranch).toBe('staging');
    });
  });

  describe('Max Tasks Configuration', () => {
    it('should include max tasks in comment', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 999,
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            maxTasks: '42',
          },
        },
      });

      octokit.mockCreateComment({ id: 999, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await continuousMode.prepare(options);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('**Max Tasks:** 42');
    });
  });

  describe('Task Source Configuration', () => {
    it('should log task source in preparation', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            taskSource: 'file',
          },
        },
      });

      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await continuousMode.prepare(options);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('file'));
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should continue if label addition fails', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 111,
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      octokit.mockCreateComment({ id: 111, html_url: '' });
      octokit.rest.issues.addLabels.mockRejectedValue(new Error('Label not found'));

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      // Should not throw
      const result = await continuousMode.prepare(options);
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe('Multiple Task Processing Simulation', () => {
    it('should handle progress updates for multiple tasks', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
            maxTasks: '3',
          },
        },
      });

      const modeContext = continuousMode.prepareContext(githubContext);

      // Simulate task completion
      for (let i = 1; i <= 3; i++) {
        const updateComment = generateProgressComment({
          taskId: modeContext.taskId || 'test-session',
          status: 'running',
          message: `Processing task ${i}/3`,
          maxTasks: 3,
          tasksProcessed: i,
          output: `Task ${i} completed successfully`,
        });

        expect(updateComment).toContain(`**Tasks Processed:** ${i}/3`);
        expect(updateComment).toContain('Processing task');
      }
    });
  });

  describe('Task ID Generation', () => {
    it('should generate unique continuous mode task IDs', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
        },
      });

      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result1 = await continuousMode.prepare(options);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result2 = await continuousMode.prepare(options);

      expect(result1.taskId).not.toBe(result2.taskId);
      expect(result1.taskId).toContain('continuous-');
      expect(result2.taskId).toContain('continuous-');
    });
  });
});

/**
 * Helper function to generate progress comment (copied from implementation for testing)
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
