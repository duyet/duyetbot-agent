/**
 * Agent Mode Tests
 *
 * Tests for agent mode implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { agentMode } from '../../src/modes/agent/index.js';
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

describe('modes/agent', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function createBaseContext(overrides: Partial<GitHubContext> = {}): GitHubContext {
    return {
      eventName: 'issues',
      eventAction: 'opened',
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
        continuousMode: 'false',
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
      expect(agentMode.name).toBe('agent');
    });

    it('should have description', () => {
      expect(agentMode.description).toBeDefined();
      expect(typeof agentMode.description).toBe('string');
      expect(agentMode.description.length).toBeGreaterThan(0);
    });
  });

  describe('shouldTrigger', () => {
    it('should trigger when prompt input is provided', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'do something',
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on workflow_dispatch event', () => {
      const context = createBaseContext({
        eventName: 'workflow_dispatch',
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on issue opened event', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 123,
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on issue labeled with agent-task', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 456,
        payload: {
          issue: {
            labels: [{ name: 'agent-task', color: '0000ff' }],
          },
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);
    });

    it('should not trigger on issue labeled without agent-task', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 789,
        payload: {
          issue: {
            labels: [{ name: 'bug', color: 'ff0000' }],
          },
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(false);
    });

    it('should not trigger without prompt or valid event', () => {
      const context = createBaseContext({
        eventName: 'push',
      });

      expect(agentMode.shouldTrigger(context)).toBe(false);
    });

    it('should not trigger on issue_comment without prompt', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        eventAction: 'created',
        entityNumber: 101,
      });

      expect(agentMode.shouldTrigger(context)).toBe(false);
    });

    it('should handle missing payload in labeled event', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
      });

      expect(agentMode.shouldTrigger(context)).toBe(false);
    });

    it('should handle empty labels array', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        payload: {
          issue: {
            labels: [],
          },
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(false);
    });
  });

  describe('prepareContext', () => {
    it('should create basic mode context', () => {
      const context = createBaseContext();
      const modeContext = agentMode.prepareContext(context);

      expect(modeContext.mode).toBe('agent');
      expect(modeContext.githubContext).toBe(context);
    });

    it('should include commentId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { commentId: 123 };
      const modeContext = agentMode.prepareContext(context, data);

      expect(modeContext.commentId).toBe(123);
    });

    it('should include taskId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { taskId: 'task-456' };
      const modeContext = agentMode.prepareContext(context, data);

      expect(modeContext.taskId).toBe('task-456');
    });

    it('should include branch info when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = {
        branchInfo: { baseBranch: 'develop', claudeBranch: undefined, currentBranch: 'main' },
      };
      const modeContext = agentMode.prepareContext(context, data);

      expect(modeContext.baseBranch).toBe('develop');
    });
  });

  describe('getAllowedTools', () => {
    it('should return array of allowed tools', () => {
      const tools = agentMode.getAllowedTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include all essential tools', () => {
      const tools = agentMode.getAllowedTools();

      expect(tools).toContain('bash');
      expect(tools).toContain('git');
      expect(tools).toContain('github');
      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
      expect(tools).toContain('search');
      expect(tools).toContain('research');
      expect(tools).toContain('plan');
      expect(tools).toContain('run_tests');
    });

    it('should allow all tools including continuous_mode', () => {
      const tools = agentMode.getAllowedTools();
      // Agent mode allows everything
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('getDisallowedTools', () => {
    it('should return empty array', () => {
      const tools = agentMode.getDisallowedTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
  });

  describe('shouldCreateTrackingComment', () => {
    it('should return true', () => {
      expect(agentMode.shouldCreateTrackingComment()).toBe(true);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt with explicit prompt input', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Fix the authentication bug',
        },
      });

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Fix the authentication bug');
      expect(prompt).toContain('## Task');
      expect(prompt).toContain('You are duyetbot');
    });

    it('should use issue content when no prompt input', () => {
      const context = createBaseContext({
        eventName: 'issues',
        entityNumber: 123,
        payload: {
          issue: {
            title: 'Bug in login',
            body: 'Users cannot login',
          },
        },
      });

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Bug in login');
      expect(prompt).toContain('Users cannot login');
      expect(prompt).toContain('Process this issue');
    });

    it('should handle missing issue body', () => {
      const context = createBaseContext({
        eventName: 'issues',
        entityNumber: 456,
        payload: {
          issue: {
            title: 'No description issue',
            body: undefined,
          },
        },
      });

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('No description issue');
      expect(prompt).toContain('(No description)');
    });

    it('should use default task when no prompt or issue', () => {
      const context = createBaseContext();

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Help with this repository');
    });

    it('should include repository context', () => {
      const context = createBaseContext();

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Repository Context');
      expect(prompt).toContain('duyet/test-repo');
    });

    it('should include issue/PR context when available', () => {
      const context = createBaseContext({
        eventName: 'issues',
        entityNumber: 789,
      });

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Issue**: #789');
      expect(prompt).toContain('https://github.com/duyet/test-repo/issues/789');
    });

    it('should include PR context for PR events', () => {
      const context = createBaseContext({
        eventName: 'pull_request',
        entityNumber: 101,
        isPR: true,
      });

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('**Pull Request**: #101');
      expect(prompt).toContain('pull/101');
    });

    it('should include instructions section', () => {
      const context = createBaseContext();

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('Understand the task');
      expect(prompt).toContain('Create a plan');
      expect(prompt).toContain('Implement the changes');
      expect(prompt).toContain('Test and verify');
      expect(prompt).toContain('Report results');
    });
  });

  describe('getSystemPrompt', () => {
    it('should generate system prompt with GitHub context', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        actor: 'testuser',
        runId: '123456',
      });

      const modeContext = agentMode.prepareContext(context);
      const systemPrompt = agentMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('## GitHub Context');
      expect(systemPrompt).toContain('testuser');
      expect(systemPrompt).toContain('issues');
      expect(systemPrompt).toContain('(opened)');
      expect(systemPrompt).toContain('duyet/test-repo');
      expect(systemPrompt).toContain('123456');
    });

    it('should handle missing event action', () => {
      const context = createBaseContext({
        eventAction: undefined,
      });

      const modeContext = agentMode.prepareContext(context);
      const systemPrompt = agentMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toBeDefined();
      expect(systemPrompt).toContain('## GitHub Context');
    });
  });

  describe('prepare', () => {
    it('should prepare environment without comment when no entity', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      const result = await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

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

      const result = await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

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

      const result = await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.branchInfo.baseBranch).toBe('develop');
    });

    it('should log preparation steps', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Agent Mode Preparation'));
    });

    it('should log entity info when present', async () => {
      const context = createBaseContext({
        entityNumber: 456,
      });
      const octokit = {} as any;

      await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('#456'));
    });

    it('should log standalone mode when no entity', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('standalone mode'));
    });

    it('should generate task ID with correct format', async () => {
      const context = createBaseContext();
      const octokit = {} as any;

      const result = await agentMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.taskId).toMatch(/^agent-duyet-test-repo-\d+$/);
    });
  });

  describe('integration scenarios', () => {
    it('should handle workflow_dispatch with prompt', () => {
      const context = createBaseContext({
        eventName: 'workflow_dispatch',
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Run all tests',
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);

      const modeContext = agentMode.prepareContext(context);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Run all tests');
    });

    it('should handle new issue with @mention', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 789,
        payload: {
          issue: {
            title: 'Feature request',
            body: 'Please add this feature @duyetbot',
          },
        },
      });

      // Both modes could trigger, but agent mode should trigger for opened event
      expect(agentMode.shouldTrigger(context)).toBe(true);
    });

    it('should handle issue labeled as agent-task', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 999,
        payload: {
          issue: {
            title: 'Task for agent',
            body: 'Automate this',
            labels: [{ name: 'agent-task', color: '0000ff' }],
          },
        },
      });

      expect(agentMode.shouldTrigger(context)).toBe(true);
    });
  });
});
