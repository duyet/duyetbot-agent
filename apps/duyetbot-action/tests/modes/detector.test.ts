/**
 * Detector Tests
 *
 * Tests for automatic mode detection based on GitHub context
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitHubContext } from '../../src/github/context.js';
import { detectMode } from '../../src/modes/detector.js';

describe('modes/detector', () => {
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
        labelTrigger: 'duyetbot',
        prompt: '',
        settings: '',
        claudeArgs: '',
        baseBranch: 'main',
        branchPrefix: 'duyetbot/',
        allowedBots: '',
        allowedNonWriteUsers: '',
        useStickyComment: 'true',
        useCommitSigning: 'false',
        botId: '41898282',
        botName: 'duyetbot[bot]',
      },
      runId: '123456',
      ...overrides,
    };
  }

  describe('continuous mode detection', () => {
    it('should detect continuous mode when enabled in settings', () => {
      const context = createBaseContext({
        inputs: {
          ...createBaseContext().inputs,
          settingsObject: {
            continuous: {
              enabled: true,
            },
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('continuous');
    });

    it('should prioritize continuous mode over other triggers', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        inputs: {
          ...createBaseContext().inputs,
          settingsObject: {
            continuous: {
              enabled: true,
            },
          },
          prompt: 'explicit prompt',
        },
        payload: {
          comment: {
            body: '@duyetbot help me',
          },
        },
        entityNumber: 123,
      });

      const mode = detectMode(context);
      expect(mode).toBe('continuous');
    });
  });

  describe('tag mode detection', () => {
    it('should detect tag mode on issue_comment with @mention', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: '@duyetbot please fix this bug',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode on pull_request_review_comment with @mention', () => {
      const context = createBaseContext({
        eventName: 'pull_request_review_comment',
        entityNumber: 456,
        payload: {
          comment: {
            body: '@duyetbot review this',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode on issues with @mention', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 789,
        payload: {
          issue: {
            body: '@duyetbot help with this',
            title: 'Help needed',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode on pull_request with @mention', () => {
      const context = createBaseContext({
        eventName: 'pull_request',
        eventAction: 'opened',
        entityNumber: 101,
        isPR: true,
        payload: {
          pull_request: {
            body: '@duyetbot review these changes',
            title: 'Feature PR',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode on pull_request_review with @mention', () => {
      const context = createBaseContext({
        eventName: 'pull_request_review',
        eventAction: 'submitted',
        entityNumber: 202,
        isPR: true,
        payload: {
          pull_request: {
            body: '@duyetbot address review comments',
            title: 'Feature PR',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode with custom trigger phrase', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          triggerPhrase: '@custombot',
        },
        payload: {
          comment: {
            body: '@custombot do something',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode with label trigger', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 123,
        payload: {
          issue: {
            labels: [{ name: 'duyetbot', color: 'ff0000' }],
            body: 'Please review',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect tag mode with custom label trigger', () => {
      const context = createBaseContext({
        eventName: 'pull_request',
        eventAction: 'labeled',
        entityNumber: 456,
        isPR: true,
        inputs: {
          ...createBaseContext().inputs,
          labelTrigger: 'bot-task',
        },
        payload: {
          pull_request: {
            labels: [{ name: 'bot-task', color: '00ff00' }],
            body: 'Review needed',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should be case-insensitive for triggers', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: '@DUYETBOT HELP ME',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should detect label trigger case-insensitively', () => {
      const context = createBaseContext({
        eventName: 'issues',
        entityNumber: 123,
        payload: {
          issue: {
            labels: [{ name: 'DuyetBot', color: 'ff0000' }],
            body: 'Help',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });
  });

  describe('agent mode detection', () => {
    it('should detect agent mode on issue opened', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 123,
        payload: {
          issue: {
            title: 'New feature request',
            body: 'Please add this feature',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should detect agent mode on issue labeled with agent-task', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 456,
        payload: {
          issue: {
            labels: [{ name: 'agent-task', color: '0000ff' }],
            body: 'Task for agent',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should detect agent mode with explicit prompt', () => {
      const context = createBaseContext({
        eventName: 'issues',
        entityNumber: 789,
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Fix this bug',
        },
        payload: {
          issue: {
            body: 'Bug description',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should detect agent mode on workflow_dispatch with prompt', () => {
      const context = createBaseContext({
        eventName: 'workflow_dispatch',
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'Run tests',
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should default to agent mode when no other mode matches', () => {
      const context = createBaseContext({
        eventName: 'push',
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });
  });

  describe('edge cases', () => {
    it('should handle empty issue body', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 123,
        payload: {
          issue: {
            body: undefined,
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should handle missing payload', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 123,
        payload: undefined,
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should handle empty labels array', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'labeled',
        entityNumber: 123,
        payload: {
          issue: {
            labels: [],
            body: 'Test',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should handle trigger at different positions in text', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: 'Can you help me with this? @duyetbot please review',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should not trigger on partial mention', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        payload: {
          comment: {
            body: '@duyetbo help me',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should handle workflow_dispatch without prompt', () => {
      const context = createBaseContext({
        eventName: 'workflow_dispatch',
        inputs: {
          ...createBaseContext().inputs,
          prompt: '',
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });

    it('should handle issue without entity number', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
      });

      const mode = detectMode(context);
      expect(mode).toBe('agent');
    });
  });

  describe('priority and precedence', () => {
    it('should prioritize tag mode over agent mode when both apply', () => {
      const context = createBaseContext({
        eventName: 'issue_comment',
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'explicit prompt',
        },
        payload: {
          comment: {
            body: '@duyetbot help',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });

    it('should check for trigger before checking for explicit prompt', () => {
      const context = createBaseContext({
        eventName: 'issues',
        eventAction: 'opened',
        entityNumber: 123,
        inputs: {
          ...createBaseContext().inputs,
          prompt: 'do this',
        },
        payload: {
          issue: {
            body: '@duyetbot do that',
          },
        },
      });

      const mode = detectMode(context);
      expect(mode).toBe('tag');
    });
  });
});
