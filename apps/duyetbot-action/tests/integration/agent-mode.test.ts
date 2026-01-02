/**
 * Agent Mode Integration Tests
 *
 * End-to-end tests for agent mode workflow:
 * - workflow_dispatch triggers agent mode
 * - Issue opened triggers agent mode
 * - Explicit prompt input
 * - Tracking comment creation
 * - Task execution and PR creation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { agentMode } from '../../src/modes/agent/index.js';
import type { ModeOptions } from '../../src/modes/types.js';
import {
  mockIssueLabeledEvent,
  mockIssuesOpenedEvent,
  mockWorkflowDispatchEvent,
} from './helpers/mocks.js';
import { cleanupTestContext, createTestContext } from './helpers/test-context.js';

describe('Agent Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestContext();
  });

  describe('workflow_dispatch Trigger', () => {
    it('should trigger on workflow_dispatch event', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          eventAction: undefined,
          payload: mockWorkflowDispatchEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            inputs: {
              prompt: 'Add unit tests for auth module',
            },
            actor: 'dev-user',
          }),
        },
      });

      expect(agentMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should prepare context for workflow_dispatch', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          entityNumber: undefined,
          payload: mockWorkflowDispatchEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            inputs: {
              prompt: 'Refactor database layer',
            },
            actor: 'test-user',
          }),
        },
      });

      octokit.mockCreateComment({
        id: 1001,
        html_url: 'https://github.com/test-owner/test-repo/issues/1#issuecomment-1001',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await agentMode.prepare(options);

      // Without entity, no comment should be created
      expect(result.commentId).toBeUndefined();
      expect(result.taskId).toBeDefined();
      expect(result.shouldExecute).toBe(true);
      expect(result.branchInfo?.baseBranch).toBe('main');
    });

    it('should use prompt from input', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            prompt: 'Implement OAuth2 authentication',
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('OAuth2 authentication');
      expect(prompt).toContain('Task');
    });
  });

  describe('Issue Opened Trigger', () => {
    it('should trigger on issue opened event', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 1,
          payload: mockIssuesOpenedEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 1,
            title: 'Bug: Login fails with special characters',
            body: 'When I enter special characters in password field, login fails',
            actor: 'user123',
          }),
        },
      });

      expect(agentMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should create tracking comment when issue is opened', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 202,
          payload: mockIssuesOpenedEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 202,
            title: 'Feature: Add dark mode',
            body: 'Please add dark mode support to the application',
            actor: 'designer-user',
          }),
        },
      });

      octokit.mockCreateComment({
        id: 2002,
        html_url: 'https://github.com/test-owner/test-repo/issues/202#issuecomment-2002',
      });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await agentMode.prepare(options);

      expect(result.commentId).toBe(2002);
      expect(result.shouldExecute).toBe(true);

      // Verify comment was created
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(true);
      expect(octokit.verifyCalled('issues', 'addLabels', 1)).toBe(true);

      const commentArgs = octokit.getLastCallArgs('issues', 'createComment');
      expect(commentArgs.body).toContain('<!-- duyetbot-agent-progress -->');
    });

    it('should extract issue title and body for prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 5,
          payload: {
            issue: {
              number: 5,
              title: 'Performance issue in database queries',
              body: 'Database queries are taking too long on the dashboard page',
            },
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Performance issue in database queries');
      expect(prompt).toContain('dashboard page');
    });
  });

  describe('Issue Labeled Trigger', () => {
    it('should trigger on issue labeled with agent-task', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'labeled',
          entityNumber: 303,
          payload: mockIssueLabeledEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 303,
            label: 'agent-task',
            actor: 'maintainer-user',
          }),
        },
      });

      expect(agentMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should not trigger on other labels', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'labeled',
          entityNumber: 404,
          payload: mockIssueLabeledEvent({
            owner: 'test-owner',
            repo: 'test-repo',
            issueNumber: 404,
            label: 'bug',
            actor: 'user',
          }),
        },
      });

      expect(agentMode.shouldTrigger(githubContext)).toBe(false);
    });
  });

  describe('Explicit Prompt Input', () => {
    it('should trigger when prompt input is provided', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'push',
          inputs: {
            ...createTestContext().githubContext.inputs,
            prompt: 'Fix the failing tests',
          },
        },
      });

      expect(agentMode.shouldTrigger(githubContext)).toBe(true);
    });

    it('should prioritize prompt input over event content', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 1,
          inputs: {
            ...createTestContext().githubContext.inputs,
            prompt: 'Ignore the issue and update documentation',
          },
          payload: {
            issue: {
              title: 'Fix login bug',
              body: 'Login is broken',
            },
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Ignore the issue and update documentation');
      expect(prompt).not.toContain('login bug');
    });
  });

  describe('Prompt Generation', () => {
    it('should include repository context in prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          repository: {
            owner: 'mycompany',
            repo: 'myproject',
            fullName: 'mycompany/myproject',
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('mycompany/myproject');
    });

    it('should include issue URL when entity exists', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 123,
          repository: {
            owner: 'org',
            repo: 'repo',
            fullName: 'org/repo',
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('https://github.com/org/repo/issues/123');
    });

    it('should include instructions for implementation', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          inputs: {
            ...createTestContext().githubContext.inputs,
            prompt: 'Add caching',
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const prompt = agentMode.generatePrompt(modeContext);

      expect(prompt).toContain('Understand the task');
      expect(prompt).toContain('Create a plan');
      expect(prompt).toContain('Implement');
      expect(prompt).toContain('Test and verify');
      expect(prompt).toContain('Report results');
    });
  });

  describe('Tool Permissions', () => {
    it('should allow all tools in agent mode', () => {
      const allowedTools = agentMode.getAllowedTools();
      const disallowedTools = agentMode.getDisallowedTools();

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

      expect(disallowedTools).toHaveLength(0);
    });
  });

  describe('Standalone Mode', () => {
    it('should work without entity (standalone mode)', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
          entityNumber: undefined,
          inputs: {
            ...createTestContext().githubContext.inputs,
            prompt: 'Run database migration',
          },
        },
      });

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result = await agentMode.prepare(options);

      // No comment should be created in standalone mode
      expect(result.commentId).toBeUndefined();
      expect(result.taskId).toBeDefined();
      expect(result.shouldExecute).toBe(true);

      // Verify no comment API calls
      expect(octokit.verifyCalled('issues', 'createComment', 1)).toBe(false);
    });
  });

  describe('System Prompt', () => {
    it('should include GitHub context in system prompt', () => {
      const { githubContext } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          actor: 'alice',
          runId: 'run-123',
          repository: {
            owner: 'org',
            repo: 'repo',
            fullName: 'org/repo',
          },
        },
      });

      const modeContext = agentMode.prepareContext(githubContext);
      const systemPrompt = agentMode.getSystemPrompt(modeContext);

      expect(systemPrompt).toContain('alice');
      expect(systemPrompt).toContain('issues (opened)');
      expect(systemPrompt).toContain('org/repo');
      expect(systemPrompt).toContain('run-123');
    });
  });

  describe('Base Branch Handling', () => {
    it('should respect baseBranch input', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 1,
          inputs: {
            ...createTestContext().githubContext.inputs,
            baseBranch: 'production',
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

      const result = await agentMode.prepare(options);

      expect(result.branchInfo?.baseBranch).toBe('production');
    });
  });

  describe('Label Operations', () => {
    it('should add agent:working label when processing starts', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 777,
        },
      });

      octokit.mockCreateComment({ id: 777, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      await agentMode.prepare(options);

      const labelArgs = octokit.getLastCallArgs('issues', 'addLabels');
      expect(labelArgs.labels).toContain('agent:working');
    });

    it('should continue if label addition fails', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'issues',
          eventAction: 'opened',
          entityNumber: 888,
        },
      });

      octokit.mockCreateComment({ id: 888, html_url: '' });
      octokit.rest.issues.addLabels.mockRejectedValue(new Error('Label does not exist'));

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      // Should not throw
      const result = await agentMode.prepare(options);
      expect(result.shouldExecute).toBe(true);
    });
  });

  describe('Task ID Generation', () => {
    it('should generate unique task IDs', async () => {
      const { githubContext, octokit, config } = createTestContext({
        githubContextOverrides: {
          eventName: 'workflow_dispatch',
        },
      });

      octokit.mockCreateComment({ id: 1, html_url: '' });
      octokit.mockAddLabels();

      const options: ModeOptions = {
        context: githubContext,
        octokit: octokit as any,
        config,
      };

      const result1 = await agentMode.prepare(options);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const result2 = await agentMode.prepare(options);

      expect(result1.taskId).not.toBe(result2.taskId);
      expect(result1.taskId).toContain('agent-');
      expect(result2.taskId).toContain('agent-');
    });
  });
});
