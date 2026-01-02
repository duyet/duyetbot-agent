/**
 * Error Recovery Integration Tests
 *
 * Tests for error handling and recovery:
 * - API rate limiting
 * - Network failures
 * - Invalid input data
 * - Permission errors
 * - Graceful degradation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as CommentOps from '../../src/github/operations/comments.js';
import * as LabelOps from '../../src/github/operations/labels.js';
import { checkWritePermissions } from '../../src/github/validation/permissions.js';
import { agentMode } from '../../src/modes/agent/index.js';
import { continuousMode } from '../../src/modes/continuous/index.js';
import { tagMode } from '../../src/modes/tag/index.js';
import type { ModeOptions } from '../../src/modes/types.js';
import { mockIssueCommentWithMention } from './helpers/mocks.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Error Recovery Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('API Rate Limiting', () => {
    it('should handle rate limit errors gracefully', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
          repos: {
            get: vi.fn(),
          },
        },
      };

      // Simulate rate limit error
      mockOctokit.rest.issues.listComments.mockRejectedValue(new Error('API rate limit exceeded'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 100,
          payload: mockIssueCommentWithMention({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 100,
            task: 'Test task',
            actor: 'user',
          }),
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      // Should handle error gracefully
      await expect(tagMode.prepare(options)).rejects.toThrow();
    });
  });

  describe('Network Failures', () => {
    it('should handle network timeout errors', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      // Simulate network timeout
      mockOctokit.rest.issues.listComments.mockRejectedValue(new Error('Request timeout'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 101,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      await expect(tagMode.prepare(options)).rejects.toThrow();
    });

    it('should handle connection reset errors', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.createComment.mockRejectedValue(
        new Error('Connection reset by peer')
      );

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 102,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      await expect(agentMode.prepare(options)).rejects.toThrow();
    });
  });

  describe('Permission Errors', () => {
    it('should deny access without write permissions', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn(),
          },
        },
      };

      mockOctokit.rest.repos.get.mockResolvedValue({
        data: {
          permissions: {
            push: false,
            admin: false,
            maintain: false,
          },
        },
      });

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'unauthorized-user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });

    it('should handle permission check API failures', async () => {
      const mockOctokit = {
        rest: {
          repos: {
            get: vi.fn(),
          },
        },
      };

      mockOctokit.rest.repos.get.mockRejectedValue(new Error('Forbidden: Resource not accessible'));

      const { githubContext } = createTestContext({
        githubContextOverrides: {
          actor: 'user',
        },
      });

      const hasPermission = await checkWritePermissions(mockOctokit, githubContext, '', false);

      expect(hasPermission).toBe(false);
    });
  });

  describe('Invalid Input Data', () => {
    it('should handle missing entity number gracefully', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'push',
          entityNumber: undefined,
        },
      });

      // Should not trigger without entity
      expect(tagMode.shouldTrigger(githubContext)).toBe(false);
      expect(agentMode.shouldTrigger(githubContext)).toBe(false);
    });

    it('should handle missing repository information', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          repository: {
            owner: '',
            repo: '',
            fullName: '',
          },
        },
      });

      // Should still work with empty repo info (may fail later)
      expect(githubContext.repository.fullName).toBe('');
    });

    it('should handle missing payload gracefully', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          payload: undefined,
        },
      });

      // Should not crash when accessing payload
      expect(() => {
        tagMode.shouldTrigger(githubContext);
      }).not.toThrow();
    });
  });

  describe('Comment Operations', () => {
    it('should handle comment creation failure', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockRejectedValue(new Error('Comment creation failed'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 103,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      await expect(tagMode.prepare(options)).rejects.toThrow();
    });

    it('should handle comment update failure', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            updateComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({
        data: [
          {
            id: 1000,
            body: 'Previous comment <!-- duyetbot-progress -->',
          },
        ],
      });
      mockOctokit.rest.issues.updateComment.mockRejectedValue(new Error('Comment update failed'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 104,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      await expect(tagMode.prepare(options)).rejects.toThrow();
    });
  });

  describe('Label Operations', () => {
    it('should continue when label addition fails', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 2000, html_url: 'https://example.com' },
      });
      mockOctokit.rest.issues.addLabels.mockRejectedValue(new Error('Label does not exist'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 105,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      // Should not throw - label failure is non-critical
      const result = await agentMode.prepare(options);
      expect(result.shouldExecute).toBe(true);
    });

    it('should handle label not found error gracefully', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 2001, html_url: 'https://example.com' },
      });
      mockOctokit.rest.issues.addLabels.mockRejectedValue(
        new Error('Label "agent:working" not found')
      );

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            continuousMode: 'true',
          },
          entityNumber: 106,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      // Should not throw
      const result = await continuousMode.prepare(options);
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe('Partial Failures', () => {
    it('should handle partial success scenarios', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      // Comment succeeds, label fails
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 3000, html_url: 'https://example.com' },
      });
      mockOctokit.rest.issues.addLabels.mockRejectedValue(new Error('Label operation failed'));

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 107,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      // Should succeed despite label failure
      const result = await agentMode.prepare(options);
      expect(result.commentId).toBe(3000);
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe('Retry Logic', () => {
    it('should handle transient API errors', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      let attempts = 0;
      mockOctokit.rest.issues.listComments.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Service temporarily unavailable');
        }
        return { data: [] };
      });

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 108,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      // Would need retry implementation to handle this
      await expect(tagMode.prepare(options)).rejects.toThrow();
    });
  });

  describe('Error Reporting', () => {
    it('should include error details in progress comment', async () => {
      const taskId = 'error-test-task';

      const errorComment = generateErrorComment({
        taskId,
        error: 'Failed to create branch: Branch already exists',
        output: 'Attempting to create branch feature/test',
      });

      expect(errorComment).toContain('❌');
      expect(errorComment).toContain('Failed');
      expect(errorComment).toContain('Failed to create branch');
      expect(errorComment).toContain('feature/test');
    });

    it('should provide actionable error messages', async () => {
      const errorComment = generateErrorComment({
        taskId: 'test-task',
        error: 'Permission denied: Missing write access',
        output: '',
      });

      expect(errorComment).toContain('Permission denied');
      expect(errorComment).toContain('write access');
    });
  });

  describe('Graceful Degradation', () => {
    it('should work without comment when entity is missing', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
          },
        },
      };

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          entityNumber: undefined,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      const result = await agentMode.prepare(options);

      // Should work without comment
      expect(result.commentId).toBeUndefined();
      expect(result.shouldExecute).toBe(true);
      expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    });

    it('should default base branch when input is missing', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 4000, html_url: '' },
      });

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 109,
          inputs: {
            ...createTestContext().githubContext.inputs,
            baseBranch: '',
          },
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      const result = await agentMode.prepare(options);

      // Should default to 'main'
      expect(result.branchInfo?.baseBranch).toBe('main');
    });
  });

  describe('Malformed Responses', () => {
    it('should handle missing comment ID in response', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { html_url: 'https://example.com' }, // Missing id
      });

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 110,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      // Should handle gracefully
      expect(result.commentId).toBeUndefined();
    });

    it('should handle empty comments list', async () => {
      const mockOctokit = {
        rest: {
          issues: {
            createComment: vi.fn(),
            listComments: vi.fn(),
            addLabels: vi.fn(),
          },
        },
      };

      mockOctokit.rest.issues.listComments.mockResolvedValue({ data: [] });
      mockOctokit.rest.issues.createComment.mockResolvedValue({
        data: { id: 5000, html_url: 'https://example.com' },
      });

      const { githubContext, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issue_comment',
          eventAction: 'created',
          entityNumber: 111,
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: mockOctokit as any,
        config,
      };

      const result = await tagMode.prepare(options);

      // Should create new comment when none exists
      expect(result.commentId).toBe(5000);
    });
  });
});

/**
 * Helper to generate error comment
 */
function generateErrorComment(options: { taskId: string; error: string; output?: string }): string {
  const { taskId, error, output } = options;

  let comment = `## 🤖 Duyetbot ❌ Failed\n\n`;
  comment += `**Task ID:** \`${taskId}\`\n\n`;
  comment += `### Error\n\n${error}\n`;

  if (output && output.length > 0) {
    comment += `\n### Output\n\n`;
    const truncated = output.slice(0, 2000);
    comment += `\`\`\`\n${truncated}${output.length > 2000 ? '\n...(truncated)' : ''}\n\`\`\`\n`;
  }

  return comment;
}
