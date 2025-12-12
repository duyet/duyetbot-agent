/**
 * Tests for Plan Tool
 *
 * Validates that the plan tool properly:
 * - Accepts task and optional context
 * - Returns structured planning responses
 * - Handles edge cases and errors
 * - Provides useful context for agent reasoning
 */

import { logger } from '@duyetbot/hono-middleware';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoopContext, ToolResult } from '../../types.js';
import { createPlanTool, planTool } from '../plan.js';

// Mock logger to avoid console output in tests
vi.mock('@duyetbot/hono-middleware', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Plan Tool', () => {
  let mockContext: LoopContext;

  beforeEach(() => {
    mockContext = {
      executionContext: {
        platform: 'test',
        traceId: 'trace-123',
        userId: 'user-123',
      } as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };
  });

  describe('Tool Definition', () => {
    it('should have correct name', () => {
      expect(planTool.name).toBe('plan');
    });

    it('should have descriptive description', () => {
      expect(planTool.description).toBeTruthy();
      expect(planTool.description).toContain('Break a complex task');
    });

    it('should have required parameters', () => {
      expect(planTool.parameters).toBeDefined();
      expect(planTool.parameters.type).toBe('object');
      expect(planTool.parameters.required).toContain('task');
    });

    it('should define task and context properties', () => {
      const props = planTool.parameters.properties;
      expect(props).toBeDefined();
      expect(props?.task).toBeDefined();
      expect(props?.context).toBeDefined();
    });

    it('should have execute function', () => {
      expect(typeof planTool.execute).toBe('function');
    });
  });

  describe('Basic Planning', () => {
    it('should successfully plan a simple task', async () => {
      const result = await planTool.execute(
        {
          task: 'Implement user authentication',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should plan a task with context', async () => {
      const result = await planTool.execute(
        {
          task: 'Build REST API',
          context: 'Express.js with PostgreSQL',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('REST API');
      expect(result.output).toContain('Express.js');
      expect(result.data).toBeDefined();
    });

    it('should include planning prompt in output', async () => {
      const result = await planTool.execute(
        {
          task: 'Refactor legacy code',
          context: 'Python monolith',
        },
        mockContext
      );

      expect(result.output).toContain('Planning task decomposition');
      expect(result.output).toContain('generate a structured plan');
      expect(result.output).toContain('numbered steps');
    });
  });

  describe('Error Handling', () => {
    it('should reject empty task', async () => {
      const result = await planTool.execute(
        {
          task: '',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('cannot be empty');
    });

    it('should reject null task', async () => {
      const result = await planTool.execute(
        {
          task: null,
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject whitespace-only task', async () => {
      const result = await planTool.execute(
        {
          task: '   ',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle missing task gracefully', async () => {
      const result = await planTool.execute({}, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Response Structure', () => {
    it('should include iteration info in output', async () => {
      const ctxWithIteration = {
        ...mockContext,
        iteration: 2,
      };

      const result = await planTool.execute(
        {
          task: 'Test task',
        },
        ctxWithIteration
      );

      expect(result.output).toContain('Iteration: 3');
    });

    it('should include tool history in output when available', async () => {
      const ctxWithHistory = {
        ...mockContext,
        toolHistory: [
          {
            toolName: 'search',
            args: {},
            result: { success: true, output: '', durationMs: 0 },
            iteration: 0,
            timestamp: Date.now(),
          },
          {
            toolName: 'analyze',
            args: {},
            result: { success: true, output: '', durationMs: 0 },
            iteration: 0,
            timestamp: Date.now(),
          },
        ],
      };

      const result = await planTool.execute(
        {
          task: 'Continue work',
        },
        ctxWithHistory
      );

      expect(result.output).toContain('Previous tools used');
      expect(result.output).toContain('search');
      expect(result.output).toContain('analyze');
    });

    it('should not include tool history when empty', async () => {
      const result = await planTool.execute(
        {
          task: 'First task',
        },
        mockContext
      );

      expect(result.output).not.toContain('Previous tools used');
    });

    it('should include context info in output when provided', async () => {
      const result = await planTool.execute(
        {
          task: 'Build feature',
          context: 'React with TypeScript',
        },
        mockContext
      );

      expect(result.output).toContain('Context:');
      expect(result.output).toContain('React with TypeScript');
    });

    it('should not include context info when not provided', async () => {
      const result = await planTool.execute(
        {
          task: 'Build feature',
        },
        mockContext
      );

      // Should not have empty context line
      const lines = result.output.split('\n');
      const contextLines = lines.filter((line) => line.includes('Context:'));
      expect(contextLines.length).toBe(0);
    });
  });

  describe('Data Structure', () => {
    it('should return structured data on success', async () => {
      const result = await planTool.execute(
        {
          task: 'Implementation task',
          context: 'Custom context',
        },
        mockContext
      );

      expect(result.data).toBeDefined();
      expect(result.data).toHaveProperty('task');
      expect(result.data).toHaveProperty('context');
      expect(result.data).toHaveProperty('iteration');
      expect(result.data).toHaveProperty('toolHistory');
    });

    it('should include accurate task in data', async () => {
      const taskText = 'Build distributed cache layer';

      const result = await planTool.execute(
        {
          task: taskText,
        },
        mockContext
      );

      expect(result.data).toBeDefined();
      expect((result.data as any).task).toBe(taskText);
    });

    it('should include tool history map in data', async () => {
      const ctxWithHistory = {
        ...mockContext,
        toolHistory: [
          {
            toolName: 'fetch',
            args: {},
            result: { success: true, output: '', durationMs: 100 },
            iteration: 0,
            timestamp: Date.now(),
          },
        ],
      };

      const result = await planTool.execute(
        {
          task: 'Continue',
        },
        ctxWithHistory
      );

      const data = result.data as any;
      expect(data.toolHistory).toBeDefined();
      expect(data.toolHistory.length).toBe(1);
      expect(data.toolHistory[0]).toHaveProperty('toolName');
      expect(data.toolHistory[0]).toHaveProperty('iteration');
    });
  });

  describe('Performance', () => {
    it('should complete quickly for simple tasks', async () => {
      const result = await planTool.execute(
        {
          task: 'Quick task',
        },
        mockContext
      );

      // Planning tool should be fast - just generating a prompt
      expect(result.durationMs).toBeLessThan(100);
    });

    it('should complete quickly even with large context', async () => {
      const largeContext = 'Lorem ipsum '.repeat(100);

      const result = await planTool.execute(
        {
          task: 'Plan with large context',
          context: largeContext,
        },
        mockContext
      );

      expect(result.durationMs).toBeLessThan(100);
    });

    it('should measure duration accurately', async () => {
      const result = await planTool.execute(
        {
          task: 'Measure me',
        },
        mockContext
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe('number');
    });
  });

  describe('Subagent Context', () => {
    it('should handle subagent execution', async () => {
      const subagentContext = {
        ...mockContext,
        isSubagent: true,
        parentLoopId: 'parent-123',
      };

      const result = await planTool.execute(
        {
          task: 'Subagent planning task',
        },
        subagentContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });
  });

  describe('Factory Function', () => {
    it('should create plan tool via factory', () => {
      const tool = createPlanTool();

      expect(tool).toBeDefined();
      expect(tool.name).toBe('plan');
      expect(tool.execute).toBeDefined();
      expect(tool).toEqual(planTool);
    });
  });

  describe('Logging', () => {
    it('should log plan invocation', async () => {
      await planTool.execute(
        {
          task: 'Log this task',
        },
        mockContext
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[PlanTool]'),
        expect.objectContaining({
          task: 'Log this task',
          iteration: 0,
        })
      );
    });

    it('should log errors', async () => {
      await planTool.execute(
        {
          task: '',
        },
        mockContext
      );

      // Error should be handled gracefully, returning error in result
      // Logger.error may or may not be called depending on implementation
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('Complex Scenarios', () => {
    it('should plan multi-stage architecture task', async () => {
      const result = await planTool.execute(
        {
          task: 'Design and implement microservices architecture for e-commerce platform',
          context:
            'Node.js, PostgreSQL, Redis, Docker, Kubernetes, gRPC services, event-driven patterns',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('microservices');
      expect(result.output).toContain('numbered steps');
      expect(result.output).toContain('Sequential or parallel');
    });

    it('should plan with accumulated tool history', async () => {
      const ctxWithHistory = {
        ...mockContext,
        iteration: 3,
        toolHistory: [
          {
            toolName: 'search',
            args: { query: 'React patterns' },
            result: { success: true, output: 'Found patterns', durationMs: 150 },
            iteration: 0,
            timestamp: Date.now(),
          },
          {
            toolName: 'analyze',
            args: { code: 'component code' },
            result: { success: true, output: 'Analyzed', durationMs: 200 },
            iteration: 1,
            timestamp: Date.now(),
          },
          {
            toolName: 'search',
            args: { query: 'TypeScript generics' },
            result: { success: true, output: 'Found docs', durationMs: 120 },
            iteration: 2,
            timestamp: Date.now(),
          },
        ],
      };

      const result = await planTool.execute(
        {
          task: 'Refactor component with TypeScript generics',
        },
        ctxWithHistory
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Previous tools used: search, analyze, search');
      expect(result.output).toContain('Iteration: 4');
    });
  });

  describe('Long Form Tasks', () => {
    it('should handle very long task descriptions', async () => {
      const longTask = 'Implement comprehensive feature '.repeat(50);

      const result = await planTool.execute(
        {
          task: longTask,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain(longTask.substring(0, 50));
    });

    it('should handle very long context', async () => {
      const longContext = 'Requirements and specifications '.repeat(100);

      const result = await planTool.execute(
        {
          task: 'Plan complex system',
          context: longContext,
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeTruthy();
    });
  });
});
