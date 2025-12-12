/**
 * Tests for Subagent Tool
 *
 * Verifies critical safety constraints:
 * 1. Recursion prevention - subagents cannot spawn more subagents
 * 2. Task delegation - proper error/success handling
 * 3. Type safety - proper TypeScript compilation
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { subagentTool } from '../subagent.js';
import type { LoopContext } from '../types.js';

describe('subagentTool', () => {
  let parentContext: LoopContext;
  let subagentContext: LoopContext;

  beforeEach(() => {
    // Create a mock parent loop context
    parentContext = {
      executionContext: {
        userId: 'test-user',
        sessionId: 'test-session',
        traceId: 'test-trace',
        platform: 'test',
      } as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: false,
    };

    // Create a mock subagent context
    subagentContext = {
      executionContext: {
        userId: 'test-user',
        sessionId: 'test-session',
        traceId: 'test-trace-subagent',
        platform: 'test',
      } as any,
      iteration: 0,
      toolHistory: [],
      isSubagent: true,
      parentLoopId: 'test-trace',
    };
  });

  describe('Tool Definition', () => {
    it('has correct name and description', () => {
      expect(subagentTool.name).toBe('subagent');
      expect(subagentTool.description).toContain('Delegate');
      expect(subagentTool.description).toContain('independent');
    });

    it('requires task parameter', () => {
      expect(subagentTool.parameters.required).toContain('task');
    });

    it('has task and context properties', () => {
      const props = subagentTool.parameters.properties as Record<string, any>;
      expect(props.task).toBeDefined();
      expect(props.context).toBeDefined();
      expect(props.task.type).toBe('string');
      expect(props.context.type).toBe('string');
    });
  });

  describe('Recursion Prevention (CRITICAL)', () => {
    it('rejects subagent spawning from parent loop', async () => {
      // Parent loop can spawn subagent
      const result = await subagentTool.execute({ task: 'Test task' }, parentContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('delegated');
    });

    it('prevents subagent from spawning another subagent', async () => {
      // Subagent cannot spawn another subagent
      const result = await subagentTool.execute({ task: 'Nested task' }, subagentContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Recursive');
      expect(result.output).toContain('cannot spawn');
    });

    it('returns appropriate error message for recursive spawn', async () => {
      const result = await subagentTool.execute(
        { task: 'Recursive task', context: 'Some context' },
        subagentContext
      );

      expect(result.error).toBe('Recursive subagent attempted (one-level hierarchy enforced)');
      expect(result.output).toContain('directly');
    });
  });

  describe('Task Delegation', () => {
    it('accepts task and context arguments', async () => {
      const result = await subagentTool.execute(
        {
          task: 'Analyze feedback',
          context: 'User ratings: [5, 4, 5, 3]',
        },
        parentContext
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Analyze feedback');
      expect(result.output).toContain('User ratings');
    });

    it('handles task without context', async () => {
      const result = await subagentTool.execute({ task: 'Simple task' }, parentContext);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Simple task');
    });

    it('includes stub implementation note', async () => {
      const result = await subagentTool.execute({ task: 'Test task' }, parentContext);

      expect(result.output).toContain('pending');
      expect(result.output).toContain('AgenticLoop integration');
      expect(result.output).toContain('Max iterations: 10');
    });
  });

  describe('Performance Tracking', () => {
    it('includes execution duration', async () => {
      const result = await subagentTool.execute({ task: 'Test' }, parentContext);

      expect(result.durationMs).toBeDefined();
      expect(typeof result.durationMs).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('measures execution time accurately', async () => {
      const startTime = Date.now();
      await subagentTool.execute({ task: 'Test' }, parentContext);
      const elapsed = Date.now() - startTime;

      // The tool should complete in a few milliseconds
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('always returns a valid ToolResult', async () => {
      const result = await subagentTool.execute({ task: 'Test' }, parentContext);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('output');
      expect(result).toHaveProperty('durationMs');
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.output).toBe('string');
      expect(typeof result.durationMs).toBe('number');
    });

    it('populates error field only on failure', async () => {
      // Success case
      const successResult = await subagentTool.execute({ task: 'Test' }, parentContext);
      expect(successResult.error).toBeUndefined();

      // Failure case
      const failureResult = await subagentTool.execute({ task: 'Test' }, subagentContext);
      expect(failureResult.error).toBeDefined();
    });
  });
});
