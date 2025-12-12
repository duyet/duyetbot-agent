/**
 * GitHub Tool Tests
 *
 * Tests for the GitHub tool integration in the agentic loop.
 * Verifies tool definition, parameter validation, and stub execution.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LoopContext } from '../../types.js';
import { createGitHubTool, githubTool } from '../github.js';

// Mock logger to avoid console noise
vi.mock('@duyetbot/hono-middleware', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GitHub Tool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(githubTool.name).toBe('github');
    });

    it('should have descriptive description', () => {
      expect(githubTool.description).toContain('GitHub operations');
      expect(githubTool.description).toContain('list PRs');
      expect(githubTool.description).toContain('issues');
    });

    it('should have correct parameter structure', () => {
      expect(githubTool.parameters.type).toBe('object');
      expect(githubTool.parameters.properties).toBeDefined();
      expect(githubTool.parameters.required).toContain('action');
    });

    it('should support all GitHub actions', () => {
      const actionEnum = (githubTool.parameters.properties?.action as any)?.enum;
      expect(actionEnum).toContain('list_prs');
      expect(actionEnum).toContain('get_pr');
      expect(actionEnum).toContain('list_issues');
      expect(actionEnum).toContain('get_issue');
      expect(actionEnum).toContain('get_repo');
      expect(actionEnum).toContain('list_workflows');
      expect(actionEnum).toContain('search');
    });
  });

  describe('tool execution', () => {
    const mockContext: LoopContext = {
      executionContext: {
        traceId: 'test-trace',
        spanId: 'test-span',
        platform: 'api',
        userId: 'test-user',
        chatId: 'test-chat',
        userMessageId: 'msg-1',
        provider: 'claude',
        model: 'claude-3-sonnet',
        query: 'test query',
        conversationHistory: [],
        debug: {
          agentChain: [],
          toolCalls: [],
          warnings: [],
          errors: [],
        },
        startedAt: Date.now(),
        deadline: Date.now() + 30000,
      },
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };

    it('should execute list_prs action', async () => {
      const result = await githubTool.execute(
        {
          action: 'list_prs',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Listing open PRs');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute get_pr action with number', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_pr',
          number: 123,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Getting details for PR #123');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail get_pr without number', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_pr',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PR number');
    });

    it('should execute list_issues action', async () => {
      const result = await githubTool.execute(
        {
          action: 'list_issues',
          query: 'bug',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Listing open issues');
      expect(result.output).toContain('bug');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute get_issue action with number', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_issue',
          number: 456,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Getting details for issue #456');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail get_issue without number', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_issue',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('issue number');
    });

    it('should execute get_repo action', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_repo',
          repo: 'owner/repo-name',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Getting repository information');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute list_workflows action', async () => {
      const result = await githubTool.execute(
        {
          action: 'list_workflows',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Listing workflow runs');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute search action', async () => {
      const result = await githubTool.execute(
        {
          action: 'search',
          query: 'authentication',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Searching GitHub for');
      expect(result.output).toContain('authentication');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should fail search without query', async () => {
      const result = await githubTool.execute(
        {
          action: 'search',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('search query');
    });

    it('should fail with unknown action', async () => {
      const result = await githubTool.execute(
        {
          action: 'invalid_action' as any,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('action');
    });

    it('should fail without action', async () => {
      const result = await githubTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required argument');
    });

    it('should use default repo when not specified', async () => {
      const result = await githubTool.execute(
        {
          action: 'list_prs',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('duyetbot-agent');
    });

    it('should use custom default repo from config', async () => {
      const customTool = createGitHubTool({
        defaultRepo: 'my-custom-repo',
      });

      const result = await customTool.execute(
        {
          action: 'list_prs',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('my-custom-repo');
    });

    it('should override default repo with provided repo', async () => {
      const customTool = createGitHubTool({
        defaultRepo: 'default-repo',
      });

      const result = await customTool.execute(
        {
          action: 'list_prs',
          repo: 'override-repo',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('override-repo');
      expect(result.output).not.toContain('default-repo');
    });
  });

  describe('tool factory', () => {
    it('should create tool with custom timeout', () => {
      const tool = createGitHubTool({ timeoutMs: 3000 });
      expect(tool.name).toBe('github');
    });

    it('should create tool with custom default repo', () => {
      const tool = createGitHubTool({ defaultRepo: 'my-org/my-repo' });
      expect(tool.name).toBe('github');
    });

    it('should create tool with all options', () => {
      const tool = createGitHubTool({
        timeoutMs: 2000,
        defaultRepo: 'custom-owner/custom-repo',
      });
      expect(tool.name).toBe('github');
    });
  });

  describe('error handling', () => {
    const mockContext: LoopContext = {
      executionContext: {
        traceId: 'test-trace',
        spanId: 'test-span',
        platform: 'api',
        userId: 'test-user',
        chatId: 'test-chat',
        userMessageId: 'msg-1',
        provider: 'claude',
        model: 'claude-3-sonnet',
        query: 'test query',
        conversationHistory: [],
        debug: {
          agentChain: [],
          toolCalls: [],
          warnings: [],
          errors: [],
        },
        startedAt: Date.now(),
        deadline: Date.now() + 30000,
      },
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };

    it('should handle execution gracefully', async () => {
      const result = await githubTool.execute(
        {
          action: 'list_prs',
        },
        mockContext
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('durationMs');
    });

    it('should provide helpful error messages', async () => {
      const result = await githubTool.execute(
        {
          action: 'get_pr',
          // missing number
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe('string');
    });
  });
});
