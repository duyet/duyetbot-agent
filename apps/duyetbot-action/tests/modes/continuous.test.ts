/**
 * Continuous Mode Tests
 *
 * Tests for continuous mode implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { continuousMode } from '../../src/modes/continuous/index.js';
import type { ModeResult } from '../../src/modes/types.js';

// Mock GitHub operations with conditional logic for integration tests
vi.mock('../../src/github/operations/comments.js', () => {
  const createComment = vi.fn((octokit: any, options: any) => {
    // Check if this is MockOctokit (has requests array and rest.issues.createComment)
    if (octokit?.requests !== undefined && octokit?.rest?.issues?.createComment) {
      return octokit.rest.issues.createComment(options).then((response: any) => ({
        id: response.data.id,
        htmlUrl: response.data.html_url,
      }));
    }
    return Promise.resolve({ id: 12345, htmlUrl: 'https://example.com' });
  });

  const updateComment = vi.fn((octokit: any, options: any) => {
    if (octokit?.requests !== undefined && octokit?.rest?.issues?.updateComment) {
      return octokit.rest.issues.updateComment(options).then((response: any) => ({
        id: response.data.id,
        htmlUrl: response.data.html_url,
      }));
    }
    return Promise.resolve();
  });

  const findBotComment = vi.fn(async (octokit: any, owner: string, repo: string, issueNumber: number, botUsername: string, marker: string) => {
    if (octokit?.requests !== undefined && octokit?.rest?.issues?.listComments) {
      const response = await octokit.rest.issues.listComments({ owner, repo, issue_number: issueNumber });
      const comments = response.data;
      for (const comment of comments) {
        if (comment.body.includes(marker)) {
          return { id: comment.id, body: comment.body };
        }
      }
      return null;
    }
    return Promise.resolve(null);
  });

  return {
    createComment,
    updateComment,
    findBotComment,
  };
});

vi.mock('../../src/github/operations/labels.js', () => {
  const addLabels = vi.fn((octokit: any, owner: string, repo: string, issueNumber: number, labels: string[]) => {
    if (octokit?.requests !== undefined && octokit?.rest?.issues?.addLabels) {
      return octokit.rest.issues.addLabels({ owner, repo, issue_number: issueNumber, labels });
    }
    return Promise.resolve();
  });

  return {
    addLabels,
  };
});

describe('modes/continuous', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function createBaseContext(overrides: Partial<GitHubContext> = {}): GitHubContext {
    return {
      eventName: 'workflow_dispatch',
      eventAction: undefined,
      actor: 'testuser',
      repository: {
        owner: 'duyet',
        repo: 'test-repo',
        fullName: 'duyet/test-repo',
      },
      isPR: false,
      inputs: {
        triggerPhrase: '@duyetbot',
        assigneeTrigger: 'duyetbot',
        labelTrigger: 'duyetbot',
        prompt: '',
        settings: '',
        continuousMode: 'true',
        maxTasks: '100',
        autoMerge: 'true',
        closeIssues: 'true',
        delayBetweenTasks: '5',
        dryRun: 'false',
        taskSource: 'github-issues',
        taskId: '',
        baseBranch: 'main',
        branchPrefix: 'duyetbot/',
        allowedBots: '',
        allowedNonWriteUsers: '',
        useStickyComment: 'true',
        useCommitSigning: 'false',
        botId: '41898282',
        botName: 'duyetbot[bot]',
        memoryMcpUrl: '',
      },
      runId: '123456',
      ...overrides,
    };
  }

  describe('mode metadata', () => {
    it('should have correct name', () => {
      expect(continuousMode.name).toBe('continuous');
    });

    it('should have description', () => {
      expect(continuousMode.description).toBeDefined();
      expect(typeof continuousMode.description).toBe('string');
      expect(continuousMode.description.length).toBeGreaterThan(0);
    });
  });

  describe('shouldTrigger', () => {
    it('should trigger when continuousMode input is "true"', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: 'true',
        },
      });

      expect(continuousMode.shouldTrigger(context)).toBe(true);
    });

    it('should not trigger when continuousMode input is "false"', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: 'false',
        },
      });

      expect(continuousMode.shouldTrigger(context)).toBe(false);
    });

    it('should not trigger when continuousMode input is empty', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: '',
        },
      });

      expect(continuousMode.shouldTrigger(context)).toBe(false);
    });

    it('should be case-sensitive for "true"', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: 'TRUE',
        },
      });

      expect(continuousMode.shouldTrigger(context)).toBe(false);
    });

    it('should not depend on other triggers', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          continuousMode: 'true',
          prompt: 'explicit prompt',
        },
        payload: {
          comment: {
            body: '@duyetbot help',
          },
        },
      });

      expect(continuousMode.shouldTrigger(context)).toBe(true);
    });
  });

  describe('prepareContext', () => {
    it('should create basic mode context', () => {
      const context = createBaseContext();
      const modeContext = continuousMode.prepareContext(context);

      expect(modeContext.mode).toBe('continuous');
      expect(modeContext.githubContext).toBe(context);
    });

    it('should include commentId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { commentId: 123 };
      const modeContext = continuousMode.prepareContext(context, data);

      expect(modeContext.commentId).toBe(123);
    });

    it('should include taskId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { taskId: 'continuous-task-123' };
      const modeContext = continuousMode.prepareContext(context, data);

      expect(modeContext.taskId).toBe('continuous-task-123');
    });

    it('should include baseBranch when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = {
        branchInfo: { baseBranch: 'develop', claudeBranch: undefined, currentBranch: 'main' },
      };
      const modeContext = continuousMode.prepareContext(context, data);

      expect(modeContext.baseBranch).toBe('develop');
    });

    it('should include claudeBranch when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = {
        branchInfo: { baseBranch: 'main', claudeBranch: 'claude/main', currentBranch: 'main' },
      };
      const modeContext = continuousMode.prepareContext(context, data);

      expect(modeContext.claudeBranch).toBe('claude/main');
    });
  });

  describe('getAllowedTools', () => {
    it('should return array of allowed tools', () => {
      const tools = continuousMode.getAllowedTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include all standard tools', () => {
      const tools = continuousMode.getAllowedTools();

      expect(tools).toContain('bash');
      expect(tools).toContain('git');
      expect(tools).toContain('github');
      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
    });

    it('should include continuous_mode tool', () => {
      const tools = continuousMode.getAllowedTools();
      expect(tools).toContain('continuous_mode');
    });
  });

  describe('getDisallowedTools', () => {
    it('should return empty array', () => {
      const tools = continuousMode.getDisallowedTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('shouldCreateTrackingComment', () => {
    it('should return true', () => {
      expect(continuousMode.shouldCreateTrackingComment()).toBe(true);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt with continuous mode configuration', () => {
      const context = createBaseContext();

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('You are duyetbot');
      expect(prompt).toContain('continuous mode');
      expect(prompt).toContain('## Continuous Mode Configuration');
    });

    it('should include max tasks from inputs', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '50',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Max Tasks**: 50');
    });

    it('should include task source from inputs', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          taskSource: 'file',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Task Source**: file');
    });

    it('should include auto-merge setting', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          autoMerge: 'false',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Auto-Merge**: false');
    });

    it('should include close issues setting', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          closeIssues: 'false',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Close Issues**: false');
    });

    it('should include prompt input as initial context', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Focus on security issues',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Initial Context');
      expect(prompt).toContain('Focus on security issues');
    });

    it('should include continuous mode instructions', () => {
      const context = createBaseContext();

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('Fetch pending tasks');
      expect(prompt).toContain('Process each task sequentially');
      expect(prompt).toContain('Create a pull request');
      expect(prompt).toContain('Optionally auto-merge');
      expect(prompt).toContain('Mark task as complete');
      expect(prompt).toContain('Continue until no tasks remain');
    });

    it('should use default maxTasks when not specified', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Max Tasks**: 100');
    });

    it('should use default taskSource when not specified', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          taskSource: '',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Task Source**: github-issues');
    });
  });

  describe('getSystemPrompt', () => {
    it('should generate system prompt with GitHub context', () => {
      const context = createBaseContext({
        actor: 'testuser',
        eventName: 'workflow_dispatch',
        runId: '123456',
      });

      const modeContext = continuousMode.prepareContext(context);
      const systemPrompt = continuousMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('## GitHub Context');
      expect(systemPrompt).toContain('testuser');
      expect(systemPrompt).toContain('workflow_dispatch');
      expect(systemPrompt).toContain('duyet/test-repo');
      expect(systemPrompt).toContain('123456');
    });

    it('should include continuous mode settings', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '75',
          delayBetweenTasks: '10',
          autoMerge: 'true',
          closeIssues: 'false',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const systemPrompt = continuousMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('## Continuous Mode Settings');
      expect(systemPrompt).toContain('**Max Tasks**: 75');
      expect(systemPrompt).toContain('**Delay Between Tasks**: 10s');
      expect(systemPrompt).toContain('**Auto-Merge**: true');
      expect(systemPrompt).toContain('**Close Issues**: false');
    });

    it('should use default values when not specified', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '',
          delayBetweenTasks: '',
          autoMerge: '',
          closeIssues: '',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const systemPrompt = continuousMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('**Max Tasks**: 100');
      expect(systemPrompt).toContain('**Delay Between Tasks**: 5s');
      expect(systemPrompt).toContain('**Auto-Merge**: true');
      expect(systemPrompt).toContain('**Close Issues**: true');
    });
  });

  describe('prepare', () => {
    it('should prepare environment without comment when no entity', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      const result = await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.shouldExecute).toBe(true);
      expect(result.commentId).toBeUndefined();
      expect(result.taskId).toBeDefined();
      expect(result.branchInfo.baseBranch).toBe('main');
    });

    it('should prepare environment with comment when entity exists', async () => {
      const context = createBaseContext({
        entityNumber: 123,
      });
      const octokit = {} as any;

      const result = await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.shouldExecute).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(result.taskId).toBeDefined();
    });

    it('should use custom baseBranch from inputs', async () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          baseBranch: 'develop',
        },
      });
      const octokit = {} as any;

      const result = await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.branchInfo.baseBranch).toBe('develop');
    });

    it('should log preparation steps', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Continuous Mode Preparation')
      );
    });

    it('should log max tasks', async () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '250',
        },
      });
      const octokit = {} as any;

      await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Max Tasks: 250'));
    });

    it('should log task source', async () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          taskSource: 'memory',
        },
      });
      const octokit = {} as any;

      await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Task Source: memory'));
    });

    it('should log entity info when present', async () => {
      const context = createBaseContext({
        entityNumber: 456,
      });
      const octokit = {} as any;

      await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('#456'));
    });

    it('should log repository mode when no entity', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Running continuous mode on repository')
      );
    });

    it('should generate task ID with correct format', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      const result = await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.taskId).toMatch(/^continuous-duyet-test-repo-\d+$/);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full continuous mode setup', async () => {
      const context = createBaseContext({
        entityNumber: 789,
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '25',
          taskSource: 'memory',
          autoMerge: 'true',
          closeIssues: 'true',
          delayBetweenTasks: '3',
        },
      });
      const octokit = {} as any;

      expect(continuousMode.shouldTrigger(context)).toBe(true);

      const modeContext = continuousMode.prepareContext(context);
      expect(modeContext.mode).toBe('continuous');

      const prompt = continuousMode.generatePrompt(modeContext);
      expect(prompt).toContain('**Max Tasks**: 25');
      expect(prompt).toContain('**Task Source**: memory');

      const systemPrompt = continuousMode.getSystemPrompt!(modeContext);
      expect(systemPrompt).toContain('**Max Tasks**: 25');
      expect(systemPrompt).toContain('**Delay Between Tasks**: 3s');

      const result = await continuousMode.prepare({ context, octokit, githubToken: 'ghp_test' });
      expect(result.shouldExecute).toBe(true);
    });

    it('should handle continuous mode with initial prompt context', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Process all high-priority bugs',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Initial Context');
      expect(prompt).toContain('Process all high-priority bugs');
    });

    it('should handle continuous mode without prompt', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: '',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).not.toContain('## Initial Context');
    });

    it('should allow all tools including continuous_mode', () => {
      const tools = continuousMode.getAllowedTools();
      expect(tools).toContain('continuous_mode');
      expect(continuousMode.getDisallowedTools().length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle zero max tasks', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '0',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Max Tasks**: 0');
    });

    it('should handle very large max tasks', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          maxTasks: '999999',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Max Tasks**: 999999');
    });

    it('should handle custom task source', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          taskSource: 'custom-source',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const prompt = continuousMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Task Source**: custom-source');
    });

    it('should handle delayBetweenTasks of zero', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          delayBetweenTasks: '0',
        },
      });

      const modeContext = continuousMode.prepareContext(context);
      const systemPrompt = continuousMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('**Delay Between Tasks**: 0s');
    });
  });
});
