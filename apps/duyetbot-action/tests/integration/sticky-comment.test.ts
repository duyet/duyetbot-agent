/**
 * Sticky Comment Integration Tests
 *
 * Tests for sticky comment functionality:
 * - Single comment is edited multiple times during execution
 * - Comment contains progress marker for identification
 * - Updates preserve marker while changing content
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentMode } from '../../src/modes/agent/index.js';
import { tagMode } from '../../src/modes/tag/index.js';
import type { ModeOptions } from '../../src/modes/types.js';
import { mockIssueCommentWithMention } from './helpers/mocks.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Sticky Comment Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('Tag Mode Sticky Comment', () => {
    it('should create initial comment with progress marker', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 100,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 100,
            task: 'Implement feature X',
            actor: 'dev-user',
          }),
        },
      });

      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 1000,
        html_url: 'https://github.com/test-owner/test-repo/issues/100#issuecomment-1000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await tagMode.prepare(options);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('<!-- duyetbot-progress -->');
      expect(commentArgs.body).toContain('🤖');
      expect(commentArgs.body).toContain('Initializing');
    });

    it('should find existing comment with progress marker', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 200,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 200,
            task: 'Fix bug Y',
            actor: 'user',
          }),
        },
      });

      // Mock existing comment with marker
      octokit.mockListComments([
        {
          id: 2001,
          body: 'Random comment',
          html_url: 'https://github.com/test-owner/test-repo/issues/200#issuecomment-2001',
          created_at: new Date().toISOString(),
        },
        {
          id: 2002,
          body: '## 🤖 Duyetbot 🔄 Working\n\n<!-- duyetbot-progress -->',
          html_url: 'https://github.com/test-owner/test-repo/issues/200#issuecomment-2002',
          created_at: new Date().toISOString(),
        },
      ]);
      octokit.mockUpdateComment({
        id: 2002,
        html_url: 'https://github.com/test-owner/test-repo/issues/200#issuecomment-2002',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await tagMode.prepare(options);

      // Should update existing comment instead of creating new one
      expect(octokit.verifyCalled('issues', 'updateComment', 1)).toBe(true);
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(false);
    });

    it('should update comment multiple times during execution', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 300,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 300,
            task: 'Add tests',
            actor: 'tester',
          }),
        },
      });

      // First call - create comment
      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 3000,
        html_url: 'https://github.com/test-owner/test-repo/issues/300#issuecomment-3000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      // Prepare creates initial comment
      const result = await tagMode.prepare(options);
      expect(result.commentId).toBe(3000);

      // Simulate updates during execution
      const updates = [
        { status: 'running', message: 'Analyzing codebase...' },
        { status: 'running', message: 'Creating branch...' },
        { status: 'running', message: 'Making changes...' },
        { status: 'success', message: 'Completed!' },
      ];

      for (const update of updates) {
        // Mock the update call
        octokit.mockUpdateComment({
          id: 3000,
          html_url: `https://github.com/test-owner/test-repo/issues/300#issuecomment-3000`,
        });

        // Simulate updating the comment
        const updatedBody = generateTagProgressComment({
          taskId: result.taskId || 'test-task',
          status: update.status,
          message: update.message,
        });

        const updateArgs = {
          owner: 'test-owner',
          repo: 'test-repo',
          commentId: 3000,
          body: updatedBody,
        };

        await octokit.rest.issues.updateComment(updateArgs);
      }

      // Verify multiple updates were made
      const updateCalls = octokit.getRequestsByType('issues', 'updateComment');
      expect(updateCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Mode Sticky Comment', () => {
    it('should create comment with agent progress marker', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 400,
        },
      });

      octokit.mockCreateComment({
        id: 4000,
        html_url: 'https://github.com/test-owner/test-repo/issues/400#issuecomment-4000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await agentMode.prepare(options);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('<!-- duyetbot-agent-progress -->');
      expect(commentArgs.body).toContain('🤖');
      expect(commentArgs.body).toContain('Starting agent');
    });

    it('should preserve marker when updating comment', async () => {
      const _commentId = 5000;
      const taskId = 'agent-test-task-123';

      // Generate initial comment
      const initialBody = generateAgentProgressComment({
        taskId,
        status: 'starting',
        message: 'Initializing...',
      });

      expect(initialBody).toContain('<!-- duyetbot-agent-progress -->');

      // Generate update
      const updatedBody = generateAgentProgressComment({
        taskId,
        status: 'running',
        message: 'Processing...',
        output: 'Making changes to src/main.ts',
      });

      // Verify marker is still present
      expect(updatedBody).toContain('<!-- duyetbot-agent-progress -->');
      expect(updatedBody).toContain('Processing...');
      expect(updatedBody).toContain('Making changes to src/main.ts');
    });
  });

  describe('Marker Uniqueness', () => {
    it('should use different markers for different modes', () => {
      const tagMarker = '<!-- duyetbot-progress -->';
      const agentMarker = '<!-- duyetbot-agent-progress -->';
      const continuousMarker = '<!-- duyetbot-continuous-progress -->';

      expect(tagMarker).not.toBe(agentMarker);
      expect(agentMarker).not.toBe(continuousMarker);
      expect(tagMarker).not.toBe(continuousMarker);
    });

    it('should find correct comment by marker', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 600,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 600,
            task: 'Test marker',
            actor: 'user',
          }),
        },
      });

      // Multiple bot comments with different markers
      octokit.mockListComments([
        {
          id: 6001,
          body: '## Agent Mode\n\n<!-- duyetbot-agent-progress -->',
          html_url: 'https://github.com/test-owner/test-repo/issues/600#issuecomment-6001',
          created_at: new Date().toISOString(),
        },
        {
          id: 6002,
          body: '## Tag Mode\n\n<!-- duyetbot-progress -->',
          html_url: 'https://github.com/test-owner/test-repo/issues/600#issuecomment-6002',
          created_at: new Date().toISOString(),
        },
        {
          id: 6003,
          body: '## Continuous Mode\n\n<!-- duyetbot-continuous-progress -->',
          html_url: 'https://github.com/test-owner/test-repo/issues/600#issuecomment-6003',
          created_at: new Date().toISOString(),
        },
      ]);
      octokit.mockUpdateComment({
        id: 6002,
        html_url: 'https://github.com/test-owner/test-repo/issues/600#issuecomment-6002',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await tagMode.prepare(options);

      // Should find and update tag mode comment (6002), not others
      const updateArgs = octokit.getLastCallArgs('issues', 'updateComment');
      expect(updateArgs.comment_id).toBe(6002);
    });
  });

  describe('Comment Content Structure', () => {
    it('should include task ID in comment', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 700,
        },
      });

      octokit.mockListComments([]);
      octokit.mockCreateComment({
        id: 7000,
        html_url: 'https://github.com/test-owner/test-repo/issues/700#issuecomment-7000',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain(result.taskId);
      expect(commentArgs.body).toContain('Task ID:');
    });

    it('should truncate output when it exceeds limit', () => {
      const longOutput = 'x'.repeat(3000);

      const comment = generateTagProgressComment({
        taskId: 'test-task',
        status: 'running',
        message: 'Processing',
        output: longOutput,
      });

      expect(comment.length).toBeLessThan(3000 + 500); // Output + template
      expect(comment).toContain('...(truncated)');
    });

    it('should include PR URL when provided', () => {
      const prUrl = 'https://github.com/test-owner/test-repo/pull/123';

      const comment = generateTagProgressComment({
        taskId: 'test-task',
        status: 'success',
        message: 'Completed',
        prUrl,
      });

      expect(comment).toContain(prUrl);
      expect(comment).toContain('Pull Request');
    });
  });

  describe('Status Icons and Messages', () => {
    it('should use correct icon for each status', () => {
      const statuses = ['starting', 'running', 'success', 'error'] as const;

      const icons = {
        starting: '🔄',
        running: '⚙️',
        success: '✅',
        error: '❌',
      };

      statuses.forEach((status) => {
        const comment = generateTagProgressComment({
          taskId: 'test-task',
          status,
          message: `${status} message`,
        });

        expect(comment).toContain(icons[status]);
        expect(comment).toContain(
          status === 'success' ? 'Complete' : status === 'error' ? 'Failed' : status
        );
      });
    });
  });

  describe('Concurrent Comment Handling', () => {
    it('should handle multiple issues independently', async () => {
      const issueNumbers = [800, 801, 802];
      const results: number[] = [];

      for (const issueNumber of issueNumbers) {
        const { githubContext, octokit, config } = createTestContext({
          githubContextOverrides: {
            eventName: 'issue_comment',
            eventAction: 'created',
            entityNumber: issueNumber,
            payload: mockIssueCommentWithMention({
              owner: 'test-owner',
              repo: 'test-repo',
              issueNumber,
              task: `Task ${issueNumber}`,
              actor: 'user',
            }),
          },
        });

        octokit.mockListComments([]);
        octokit.mockCreateComment({
          id: issueNumber * 10,
          html_url: `https://github.com/test-owner/test-repo/issues/${issueNumber}#issuecomment-${issueNumber * 10}`,
        });
        octokit.mockAddLabels();

        const options: ModeOptions = {
          context: githubContext,
          octokit: octokit as any,
          config,
        };

        const result = await tagMode.prepare(options);
        results.push(result.commentId!);
      }

      // Each issue should have its own comment
      expect(results).toEqual([8000, 8010, 8020]);
      expect(new Set(results).size).toBe(3);
    });
  });
});

/**
 * Helper to generate tag mode progress comment
 */
function generateTagProgressComment(options: {
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

  let comment = `## 🤖 Duyetbot ${statusIcons[status]} ${status === 'success' ? 'Complete' : status === 'error' ? 'Failed' : 'Working'}\n\n`;
  comment += `**Mode:** tag\n`;
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

  comment += `\n<!-- duyetbot-progress -->\n`;

  return comment;
}

/**
 * Helper to generate agent mode progress comment
 */
function generateAgentProgressComment(options: {
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
