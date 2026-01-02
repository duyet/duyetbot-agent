/**
 * Tag Mode Integration Tests
 *
 * End-to-end tests for tag mode workflow:
 * - Issue comment triggers tag mode
 * - Tracking comment is created
 * - Agent processes the task
 * - PR is created
 * - Progress comment is updated
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { tagMode } from '../../src/modes/tag/index.js';
import type { ModeOptions } from '../../src/modes/types.js';
import {
  mockIssueCommentWithMention,
  mockIssueLabeledEvent,
  mockPullRequestEvent,
} from './helpers/mocks.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Tag Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('Issue Comment Trigger', () => {
    it('should trigger on @duyetbot mention in issue comment', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 123,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 123,
            task: 'Fix the login bug',
            actor: 'test-user',
          }),
        },
      });

      // Verify shouldTrigger returns true
      expect(tagMode.shouldTrigger(githubContext)).toBe(true);

      // Setup mock responses
      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 999,
        html_url: 'https://github.com/test-owner/test-repo/issues/123#issuecomment-999',
      });
      octokit.mockAddLabels();

      // Run prepare
      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      // Verify tracking comment was created
      expect(result.commentId).toBe(999);
      expect(result.taskId).toBeDefined();
      expect(result.shouldExecute).toBe(true);
      expect(result.branchInfo?.baseBranch).toBe('main');

      // Verify API calls
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(true);
      expect(octokit.verifyCalled('issues', 'addLabels', 1)).toBe(true);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('<!-- duyetbot-progress -->');
      expect(commentArgs.body).toContain('🤖');
    });

    it('should find and reuse existing tracking comment', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 456,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 456,
            task: 'Add unit tests',
            actor: 'dev-user',
          }),
        },
      });

      // Setup mock responses with existing comment
      octokit.mockListComments([
        {
          id: 888,
          body: 'Some previous comment',
          html_url: 'https://github.com/test-owner/test-repo/issues/456#issuecomment-888',
          created_at: new Date().toISOString(),
        },
        {
          id: 889,
          body: 'Previous duyetbot comment <!-- duyetbot-progress -->',
          html_url: 'https://github.com/test-owner/test-repo/issues/456#issuecomment-889',
          created_at: new Date().toISOString(),
        },
      ]);
      octokit.mockUpdateComment({
        id: 889,
        html_url: 'https://github.com/test-owner/test-repo/issues/456#issuecomment-889',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      // Verify existing comment was reused
      expect(result.commentId).toBe(889);

      // Verify API calls - update instead of create
      expect(octokit.verifyCalled('issues', 'updateComment', 1)).toBe(true);
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(false);
    });
  });

  describe('Label Trigger', () => {
    it('should trigger on issue labeled with "duyetbot"', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'labeled',
          entityNumber: 789,
          payload: mockIssueLabeledEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 789,
            label: 'duyetbot',
            actor: 'test-user',
          }),
        },
      });

      // Verify shouldTrigger returns true
      expect(tagMode.shouldTrigger(githubContext)).toBe(true);

      // Setup mock responses
      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 1000,
        html_url: 'https://github.com/test-owner/test-repo/issues/789#issuecomment-1000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      // Verify preparation succeeded
      expect(result.commentId).toBe(1000);
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe('Prompt Generation', () => {
    it('should extract task from comment after @duyetbot mention', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          entityNumber: 1,
          payload: {
            comment: {
              body: '@duyetbot Fix the authentication bug in the login form',
            },
          },
        },
      });

      const modeContext = tagMode.prepareContext(githubContext);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('authentication bug');
      expect(prompt).toContain('login form');
      expect(prompt).toContain('Task');
      expect(prompt).toContain('Issue Context');
    });

    it('should include issue/PR context in prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          entityNumber: 42,
          repository: {
            owner: 'myorg',
            repo: 'myrepo',
            fullName: 'myorg/myrepo',
          },
          payload: {
            issue: {
              number: 42,
              labels: [{ name: 'bug' }, { name: 'high-priority' }],
            },
          },
        },
      });

      const modeContext = tagMode.prepareContext(githubContext);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('#42');
      expect(prompt).toContain('myorg/myrepo');
      expect(prompt).toContain('bug');
      expect(prompt).toContain('high-priority');
    });
  });

  describe('Tool Restrictions', () => {
    it('should allow most tools but disallow continuous_mode', () => {
      const allowedTools = tagMode.getAllowedTools();
      const disallowedTools = tagMode.getDisallowedTools();

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

      expect(allowedTools).not.toContain('continuous_mode');
      expect(disallowedTools).toContain('continuous_mode');
    });
  });

  describe('PR Context', () => {
    it('should work with pull request comments', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'pull_request_review_comment',
          eventAction: 'created',
          entityNumber: 101,
          isPR: true,
          payload: mockPullRequestEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            prNumber: 101,
            title: 'Feature request',
            body: '@duyetbot Implement new API endpoint',
            actor: 'dev-user',
          }),
        },
      });

      // Verify shouldTrigger returns true
      expect(tagMode.shouldTrigger(githubContext)).toBe(true);

      // Setup mock responses
      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 1111,
        html_url: 'https://github.com/test-owner/test-repo/pull/101#issuecomment-1111',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      expect(result.shouldExecute).toBe(true);

      const modeContext = tagMode.prepareContext(githubContext);
      const prompt = tagMode.generatePrompt(modeContext);

      expect(prompt).toContain('Pull Request');
      expect(prompt).toContain('#101');
    });
  });

  describe('Base Branch Configuration', () => {
    it('should use base branch from input when provided', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          entityNumber: 1,
          inputs: {
            ...createTestContext().githubContext.inputs,
            baseBranch: 'develop',
          },
        },
      });

      octokit.mockListComments([]);
      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      expect(result.branchInfo?.baseBranch).toBe('develop');
    });

    it('should default to main branch when not specified', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          entityNumber: 1,
          inputs: {
            ...createTestContext().githubContext.inputs,
            baseBranch: '',
          },
        },
      });

      octokit.mockListComments([]);
      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      expect(result.branchInfo?.baseBranch).toBe('main');
    });
  });

  describe('Custom Trigger Phrase', () => {
    it('should use custom trigger phrase from input', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          inputs: {
            ...createTestContext().githubContext.inputs,
            triggerPhrase: '@mybot',
          },
          payload: {
            comment: {
              body: '@mybot Please fix this bug',
            },
          },
        },
      });

      expect(tagMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should not trigger with default phrase when custom is set', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          inputs: {
            ...createTestContext().githubContext.inputs,
            triggerPhrase: '@mybot',
          },
          payload: {
            comment: {
              body: '@duyetbot Please fix this bug',
            },
          },
        },
      });

      expect(tagMode.shouldTrigger(githubContext)).toBe(false);
    });
  });

  describe('No Trigger Conditions', () => {
    it('should not trigger without mention, label, or assignee', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 1,
          payload: {
            comment: {
              body: 'This is a regular comment without bot mention',
            },
            issue: {
              labels: [],
              assignees: [],
            },
          },
        },
      });

      expect(tagMode.shouldTrigger(githubContext)).toBe(false);
    });

    it('should not trigger without entity number', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          entityNumber: undefined,
          payload: {
            comment: {
              body: '@duyetbot Do something',
            },
          },
        },
      });

      expect(tagMode.shouldTrigger(githubContext)).toBe(false);
    });
  });
});
