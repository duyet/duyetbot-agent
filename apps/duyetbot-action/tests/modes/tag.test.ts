/**
 * Tag Mode Tests
 *
 * Tests for tag mode implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { tagMode } from '../../src/modes/tag/index.js';
import type { ModeResult } from '../../src/modes/types.js';

// Mock GitHub operations
vi.mock('../../src/github/operations/comments.js', () => ({
  createComment: vi.fn(() => Promise.resolve({ id: 12345 })),
  updateComment: vi.fn(() => Promise.resolve()),
  findBotComment: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../src/github/operations/labels.js', () => ({
  addLabels: vi.fn(() => Promise.resolve()),
}));

describe('modes/tag', () => {
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
      expect(tagMode.name).toBe('tag');
    });

    it('should have description', () => {
      expect(tagMode.description).toBeDefined();
      expect(typeof tagMode.description).toBe('string');
      expect(tagMode.description.length).toBeGreaterThan(0);
    });
  });

  describe('shouldTrigger', () => {
    it('should return false when entityNumber is undefined', () => {
      const context = createBaseContext();
      expect(tagMode.shouldTrigger(context)).toBe(false);
    });

    it('should trigger on @mention in issue body', () => {
      const context = createBaseContext({
        entityNumber: 123,
        payload: {
          issue: {
            body: '@duyetbot please help',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on @mention in PR body', () => {
      const context = createBaseContext({
        entityNumber: 456,
        isPR: true,
        eventName: 'pull_request',
        payload: {
          pull_request: {
            body: '@duyetbot review this',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on @mention in comment', () => {
      const context = createBaseContext({
        entityNumber: 789,
        eventName: 'issue_comment',
        payload: {
          comment: {
            body: '@duyetbot fix this bug',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on label match', () => {
      const context = createBaseContext({
        entityNumber: 101,
        payload: {
          issue: {
            labels: [{ name: 'duyetbot', color: 'ff0000' }],
            body: 'Help needed',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should trigger on assignee match', () => {
      const context = createBaseContext({
        entityNumber: 202,
        payload: {
          issue: {
            assignees: [{ login: 'duyetbot' }],
            body: 'Task assigned',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should not trigger without mention, label, or assignee', () => {
      const context = createBaseContext({
        entityNumber: 303,
        payload: {
          issue: {
            labels: [],
            assignees: [],
            body: 'Just a regular issue',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(false);
    });

    it('should be case-insensitive for mention trigger', () => {
      const context = createBaseContext({
        entityNumber: 404,
        payload: {
          issue: {
            body: '@DUYETBOT HELP',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should use custom trigger phrase from inputs', () => {
      const context = createBaseContext({
        entityNumber: 505,
        inputs: {
          ...createBaseContext().inputs,
          triggerPhrase: '@custombot',
        },
        payload: {
          issue: {
            body: '@custombot do something',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should use custom label trigger from inputs', () => {
      const context = createBaseContext({
        entityNumber: 606,
        inputs: {
          ...createBaseContext().inputs,
          labelTrigger: 'bot-task',
        },
        payload: {
          issue: {
            labels: [{ name: 'bot-task', color: '00ff00' }],
            body: 'Task',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should use custom assignee trigger from inputs', () => {
      const context = createBaseContext({
        entityNumber: 707,
        inputs: {
          ...createBaseContext().inputs,
          assigneeTrigger: 'bot-assistant',
        },
        payload: {
          issue: {
            assignees: [{ login: 'bot-assistant' }],
            body: 'Task',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(true);
    });

    it('should handle missing payload gracefully', () => {
      const context = createBaseContext({
        entityNumber: 808,
        payload: undefined,
      });

      expect(tagMode.shouldTrigger(context)).toBe(false);
    });

    it('should handle empty body', () => {
      const context = createBaseContext({
        entityNumber: 909,
        payload: {
          issue: {
            body: '',
          },
        },
      });

      expect(tagMode.shouldTrigger(context)).toBe(false);
    });
  });

  describe('prepareContext', () => {
    it('should create basic mode context', () => {
      const context = createBaseContext();
      const modeContext = tagMode.prepareContext(context);

      expect(modeContext.mode).toBe('tag');
      expect(modeContext.githubContext).toBe(context);
      expect(modeContext.commentId).toBeUndefined();
      expect(modeContext.taskId).toBeUndefined();
    });

    it('should include commentId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { commentId: 123 };
      const modeContext = tagMode.prepareContext(context, data);

      expect(modeContext.commentId).toBe(123);
    });

    it('should include taskId when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = { taskId: 'task-123' };
      const modeContext = tagMode.prepareContext(context, data);

      expect(modeContext.taskId).toBe('task-123');
    });

    it('should include baseBranch when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = {
        branchInfo: { baseBranch: 'develop', claudeBranch: undefined, currentBranch: 'main' },
      };
      const modeContext = tagMode.prepareContext(context, data);

      expect(modeContext.baseBranch).toBe('develop');
    });

    it('should include claudeBranch when provided', () => {
      const context = createBaseContext();
      const data: Partial<ModeResult> = {
        branchInfo: { baseBranch: 'main', claudeBranch: 'claude/main', currentBranch: 'main' },
      };
      const modeContext = tagMode.prepareContext(context, data);

      expect(modeContext.claudeBranch).toBe('claude/main');
    });
  });

  describe('getAllowedTools', () => {
    it('should return array of allowed tools', () => {
      const tools = tagMode.getAllowedTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include essential tools', () => {
      const tools = tagMode.getAllowedTools();

      expect(tools).toContain('bash');
      expect(tools).toContain('git');
      expect(tools).toContain('github');
      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
    });

    it('should not include continuous_mode tool', () => {
      const tools = tagMode.getAllowedTools();
      expect(tools).not.toContain('continuous_mode');
    });
  });

  describe('getDisallowedTools', () => {
    it('should return array of disallowed tools', () => {
      const tools = tagMode.getDisallowedTools();

      expect(Array.isArray(tools)).toBe(true);
    });

    it('should include continuous_mode', () => {
      const tools = tagMode.getDisallowedTools();
      expect(tools).toContain('continuous_mode');
    });
  });

  describe('shouldCreateTrackingComment', () => {
    it('should return true', () => {
      expect(tagMode.shouldCreateTrackingComment()).toBe(true);
    });
  });

  describe('generatePrompt', () => {
    it('should generate prompt with request after trigger', () => {
      const context = createBaseContext({
        entityNumber: 123,
        payload: {
          issue: {
            body: '@duyetbot please fix this bug',
            labels: [],
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('please fix this bug');
      expect(prompt).toContain('You are duyetbot');
      expect(prompt).toContain('## Task');
    });

    it('should use default message when request is empty', () => {
      const context = createBaseContext({
        entityNumber: 123,
        payload: {
          issue: {
            body: '@duyetbot',
            labels: [],
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('Help with this issue');
    });

    it('should include issue context', () => {
      const context = createBaseContext({
        entityNumber: 456,
        payload: {
          issue: {
            body: '@duyetbot help',
            labels: [
              { name: 'bug', color: 'ff0000' },
              { name: 'high-priority', color: '0000ff' },
            ],
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('#456');
      expect(prompt).toContain('duyet/test-repo');
      expect(prompt).toContain('bug');
      expect(prompt).toContain('high-priority');
    });

    it('should include PR context', () => {
      const context = createBaseContext({
        entityNumber: 789,
        isPR: true,
        payload: {
          pull_request: {
            body: '@duyetbot review',
            labels: [],
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('Pull Request');
      expect(prompt).toContain('#789');
      expect(prompt).toContain('pull/789');
    });

    it('should include instructions section', () => {
      const context = createBaseContext({
        entityNumber: 123,
        payload: {
          issue: {
            body: '@duyetbot help',
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('Analyze the request');
      expect(prompt).toContain('Create a plan');
      expect(prompt).toContain('Implement the changes');
    });

    it('should include additional context from inputs.prompt', () => {
      const context = createBaseContext({
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Focus on performance',
        },
        payload: {
          issue: {
            body: '@duyetbot optimize',
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('## Additional Context');
      expect(prompt).toContain('Focus on performance');
    });

    it('should handle comment body when issue body is missing', () => {
      const context = createBaseContext({
        entityNumber: 456,
        eventName: 'issue_comment',
        payload: {
          comment: {
            body: '@duyetbot help with this',
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('help with this');
    });

    it('should handle missing entity number gracefully', () => {
      const context = createBaseContext({
        payload: {
          issue: {
            body: '@duyetbot help',
          },
        },
      });

      const modeContext = tagMode.prepareContext(context);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('You are duyetbot');
    });
  });

  describe('getSystemPrompt', () => {
    it('should generate system prompt with GitHub context', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        eventAction: 'created',
        actor: 'testuser',
        runId: '123456',
      });

      const modeContext = tagMode.prepareContext(context);
      const systemPrompt = tagMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('## GitHub Context');
      expect(systemPrompt).toContain('testuser');
      expect(systemPrompt).toContain('issue_comment');
      expect(systemPrompt).toContain('duyet/test-repo');
      expect(systemPrompt).toContain('123456');
    });

    it('should include event action when present', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
      });

      const modeContext = tagMode.prepareContext(context);
      const systemPrompt = tagMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toContain('(labeled)');
    });

    it('should handle missing event action', () => {
      const context = createBaseContext({
        eventAction: undefined,
      });

      const modeContext = tagMode.prepareContext(context);
      const systemPrompt = tagMode.getSystemPrompt!(modeContext);

      expect(systemPrompt).toBeDefined();
    });
  });

  describe('prepare', () => {
    it('should prepare environment with comment creation', async () => {
      const context = createBaseContext({
        entityNumber: 123,
      });

      const octokit = {} as any;

      const result = await tagMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.shouldExecute).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(result.taskId).toBeDefined();
      expect(result.branchInfo.baseBranch).toBe('main');
      expect(result.branchInfo.currentBranch).toBe('main');
    });

    it('should use custom baseBranch from inputs', async () => {
      const context = createBaseContext({
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          baseBranch: 'develop',
        },
      });

      const octokit = {} as any;

      const result = await tagMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.branchInfo.baseBranch).toBe('develop');
    });

    it('should log preparation steps', async () => {
      const context = createBaseContext({
        entityNumber: 123,
      });

      const octokit = {} as any;

      await tagMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tag Mode Preparation'));
    });

    it('should handle context without entity', async () => {
      const context = createBaseContext();

      const octokit = {} as any;

      // Tag mode requires an entity to function (creates comments on issues/PRs)
      // The mock operations allow the test to pass even without entityNumber
      // In production, this would fail at the GitHub API level
      const result = await tagMode.prepare({ context, octokit, githubToken: 'ghp_test' });

      expect(result.shouldExecute).toBe(true);
      expect(result.commentId).toBeDefined();
      expect(result.taskId).toContain('undefined'); // entityNumber is undefined

      // Verify shouldTrigger returns false for context without entity
      expect(tagMode.shouldTrigger(context)).toBe(false);
    });
  });
});
