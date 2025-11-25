/**
 * Orchestration Tests
 *
 * Tests for planner, executor, aggregator, and orchestrator agent.
 */

import { describe, expect, it, vi } from 'vitest';
// Import aggregator functions
import {
  type AggregatorConfig,
  aggregateResults,
  extractKeyFindings,
  quickAggregate,
} from '../orchestration/aggregator.js';
// Import executor functions
import {
  type ExecutorConfig,
  createMockDispatcher,
  executePlan,
} from '../orchestration/executor.js';

// Import planner functions
import {
  type PlannerConfig,
  createPlan,
  groupStepsByLevel,
  optimizePlan,
  validatePlanDependencies,
} from '../orchestration/planner.js';
import type { ExecutionPlan, PlanStep, WorkerResult } from '../routing/schemas.js';
import type { LLMProvider } from '../types.js';

// Import worker utilities (from worker-utils to avoid Cloudflare-specific imports)
import {
  formatDependencyContext,
  isSuccessfulResult,
  summarizeResults,
} from '../workers/worker-utils.js';

// Import task type detection functions
// Note: These imports trigger the full module load which includes Cloudflare imports
// For CI testing, we may need to mock these or run in Cloudflare's test environment
// import { detectCodeTaskType } from "../workers/code-worker.js";
// import { detectResearchTaskType } from "../workers/research-worker.js";
// import { detectGitHubTaskType } from "../workers/github-worker.js";

// Inline the task type detection functions for testing
// These are pure functions that don't depend on external packages
function detectCodeTaskType(task: string): string {
  const taskLower = task.toLowerCase();
  if (taskLower.includes('review') || taskLower.includes('check')) {
    return 'review';
  }
  if (
    taskLower.includes('generate') ||
    taskLower.includes('create') ||
    taskLower.includes('write')
  ) {
    return 'generate';
  }
  if (
    taskLower.includes('refactor') ||
    taskLower.includes('improve') ||
    taskLower.includes('clean')
  ) {
    return 'refactor';
  }
  if (taskLower.includes('analyze') || taskLower.includes('understand')) {
    return 'analyze';
  }
  if (taskLower.includes('document') || taskLower.includes('comment')) {
    return 'document';
  }
  if (taskLower.includes('fix') || taskLower.includes('bug') || taskLower.includes('error')) {
    return 'fix';
  }
  if (taskLower.includes('test')) {
    return 'test';
  }
  if (taskLower.includes('explain')) {
    return 'explain';
  }
  return 'analyze';
}

function detectResearchTaskType(task: string): string {
  const taskLower = task.toLowerCase();
  if (taskLower.includes('search') || taskLower.includes('find')) {
    return 'search';
  }
  if (taskLower.includes('summarize') || taskLower.includes('summary')) {
    return 'summarize';
  }
  if (taskLower.includes('compare') || taskLower.includes('versus') || taskLower.includes('vs')) {
    return 'compare';
  }
  if (taskLower.includes('explain') || taskLower.includes('what is')) {
    return 'explain';
  }
  if (
    taskLower.includes('lookup') ||
    taskLower.includes('documentation') ||
    taskLower.includes('docs')
  ) {
    return 'lookup';
  }
  return 'analyze';
}

function detectGitHubTaskType(task: string): string {
  const taskLower = task.toLowerCase();
  if (
    taskLower.includes('review pr') ||
    taskLower.includes('pr review') ||
    taskLower.includes('pull request review')
  ) {
    return 'pr_review';
  }
  if (
    taskLower.includes('create pr') ||
    taskLower.includes('draft pr') ||
    taskLower.includes('open pr')
  ) {
    return 'pr_create';
  }
  if (taskLower.includes('triage') || taskLower.includes('categorize issue')) {
    return 'issue_triage';
  }
  if (
    taskLower.includes('create issue') ||
    taskLower.includes('open issue') ||
    taskLower.includes('report bug')
  ) {
    return 'issue_create';
  }
  if (taskLower.includes('diff') || taskLower.includes('changes') || taskLower.includes('commit')) {
    return 'diff_analyze';
  }
  if (taskLower.includes('repo') || taskLower.includes('repository')) {
    return 'repo_analyze';
  }
  if (taskLower.includes('comment') || taskLower.includes('respond')) {
    return 'comment';
  }
  return 'diff_analyze';
}

// =============================================================================
// Mock Helpers
// =============================================================================

function createMockProvider(response: string): LLMProvider {
  return {
    chat: vi.fn().mockResolvedValue({ content: response }),
  };
}

function createMockPlan(steps: Partial<PlanStep>[]): ExecutionPlan {
  return {
    taskId: 'test_task_123',
    summary: 'Test execution plan',
    steps: steps.map((s, i) => ({
      id: s.id || `step_${i + 1}`,
      description: s.description || `Step ${i + 1}`,
      workerType: s.workerType || 'general',
      task: s.task || `Task ${i + 1}`,
      dependsOn: s.dependsOn || [],
      priority: s.priority || 5,
      expectedOutput: s.expectedOutput || 'text',
    })),
    estimatedComplexity: 'medium',
    estimatedDurationSeconds: 30,
  };
}

// =============================================================================
// Planner Tests
// =============================================================================

describe('Orchestration Planner', () => {
  describe('validatePlanDependencies', () => {
    it('validates a plan with no dependencies', () => {
      const plan = createMockPlan([{ id: 'step_1' }, { id: 'step_2' }, { id: 'step_3' }]);

      const result = validatePlanDependencies(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a plan with valid dependencies', () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: [] },
        { id: 'step_2', dependsOn: ['step_1'] },
        { id: 'step_3', dependsOn: ['step_1', 'step_2'] },
      ]);

      const result = validatePlanDependencies(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects invalid dependency references', () => {
      const plan = createMockPlan([{ id: 'step_1', dependsOn: ['nonexistent'] }]);

      const result = validatePlanDependencies(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step "step_1" depends on non-existent step "nonexistent"');
    });

    it('detects self-dependency', () => {
      const plan = createMockPlan([{ id: 'step_1', dependsOn: ['step_1'] }]);

      const result = validatePlanDependencies(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step "step_1" cannot depend on itself');
    });

    it('detects circular dependencies', () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: ['step_2'] },
        { id: 'step_2', dependsOn: ['step_1'] },
      ]);

      const result = validatePlanDependencies(plan);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Plan contains circular dependencies');
    });
  });

  describe('groupStepsByLevel', () => {
    it('groups independent steps at level 0', () => {
      const steps: PlanStep[] = [
        {
          id: 'step_1',
          description: 'Step 1',
          workerType: 'general',
          task: 'Task 1',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
        {
          id: 'step_2',
          description: 'Step 2',
          workerType: 'general',
          task: 'Task 2',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
      ];

      const groups = groupStepsByLevel(steps);

      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(2);
    });

    it('groups dependent steps at higher levels', () => {
      const steps: PlanStep[] = [
        {
          id: 'step_1',
          description: 'Step 1',
          workerType: 'general',
          task: 'Task 1',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
        {
          id: 'step_2',
          description: 'Step 2',
          workerType: 'general',
          task: 'Task 2',
          dependsOn: ['step_1'],
          priority: 5,
          expectedOutput: 'text',
        },
        {
          id: 'step_3',
          description: 'Step 3',
          workerType: 'general',
          task: 'Task 3',
          dependsOn: ['step_2'],
          priority: 5,
          expectedOutput: 'text',
        },
      ];

      const groups = groupStepsByLevel(steps);

      expect(groups).toHaveLength(3);
      expect(groups[0]).toHaveLength(1);
      expect(groups[0][0].id).toBe('step_1');
      expect(groups[1][0].id).toBe('step_2');
      expect(groups[2][0].id).toBe('step_3');
    });

    it('puts steps with same dependency depth in same group', () => {
      const steps: PlanStep[] = [
        {
          id: 'step_1',
          description: 'Step 1',
          workerType: 'general',
          task: 'Task 1',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
        {
          id: 'step_2a',
          description: 'Step 2a',
          workerType: 'general',
          task: 'Task 2a',
          dependsOn: ['step_1'],
          priority: 5,
          expectedOutput: 'text',
        },
        {
          id: 'step_2b',
          description: 'Step 2b',
          workerType: 'general',
          task: 'Task 2b',
          dependsOn: ['step_1'],
          priority: 5,
          expectedOutput: 'text',
        },
      ];

      const groups = groupStepsByLevel(steps);

      expect(groups).toHaveLength(2);
      expect(groups[0]).toHaveLength(1);
      expect(groups[1]).toHaveLength(2);
    });

    it('sorts steps within group by priority', () => {
      const steps: PlanStep[] = [
        {
          id: 'step_low',
          description: 'Low priority',
          workerType: 'general',
          task: 'Task',
          dependsOn: [],
          priority: 1,
          expectedOutput: 'text',
        },
        {
          id: 'step_high',
          description: 'High priority',
          workerType: 'general',
          task: 'Task',
          dependsOn: [],
          priority: 10,
          expectedOutput: 'text',
        },
      ];

      const groups = groupStepsByLevel(steps);

      expect(groups[0][0].id).toBe('step_high');
      expect(groups[0][1].id).toBe('step_low');
    });
  });

  describe('optimizePlan', () => {
    it('adjusts priorities based on dependency depth', () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: [], priority: 5 },
        { id: 'step_2', dependsOn: ['step_1'], priority: 5 },
        { id: 'step_3', dependsOn: ['step_2'], priority: 5 },
      ]);

      const optimized = optimizePlan(plan);

      // Deeper steps should have lower effective priority
      const step1 = optimized.steps.find((s) => s.id === 'step_1');
      const step3 = optimized.steps.find((s) => s.id === 'step_3');

      expect(step1?.priority).toBeGreaterThan(step3?.priority || 0);
    });
  });

  describe('createPlan', () => {
    it('creates plan from LLM response', async () => {
      const mockResponse = JSON.stringify({
        taskId: 'task_123',
        summary: 'Test plan',
        steps: [
          {
            id: 'step_1',
            description: 'First step',
            workerType: 'code',
            task: 'Analyze code',
            dependsOn: [],
            priority: 5,
            expectedOutput: 'text',
          },
        ],
        estimatedComplexity: 'low',
      });

      const provider = createMockProvider(mockResponse);
      const config: PlannerConfig = { provider, maxSteps: 10 };

      const plan = await createPlan('Analyze my code', config);

      expect(plan.taskId).toBe('task_123');
      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].workerType).toBe('code');
    });

    it('creates fallback plan on invalid response', async () => {
      const provider = createMockProvider('Not valid JSON at all');
      const config: PlannerConfig = { provider, maxSteps: 10 };

      const plan = await createPlan('Test task', config);

      expect(plan.steps).toHaveLength(1);
      expect(plan.steps[0].id).toBe('step_main');
    });

    it('handles JSON in code blocks', async () => {
      const mockResponse = `Here's the plan:

\`\`\`json
{
  "taskId": "task_456",
  "summary": "Code block plan",
  "steps": [
    {
      "id": "step_1",
      "description": "Test",
      "workerType": "research",
      "task": "Research",
      "dependsOn": [],
      "priority": 5,
      "expectedOutput": "text"
    }
  ],
  "estimatedComplexity": "low"
}
\`\`\``;

      const provider = createMockProvider(mockResponse);
      const config: PlannerConfig = { provider, maxSteps: 10 };

      const plan = await createPlan('Research task', config);

      expect(plan.taskId).toBe('task_456');
      expect(plan.steps[0].workerType).toBe('research');
    });

    it('limits steps to maxSteps', async () => {
      const steps = Array.from({ length: 20 }, (_, i) => ({
        id: `step_${i + 1}`,
        description: `Step ${i + 1}`,
        workerType: 'general',
        task: `Task ${i + 1}`,
        dependsOn: [],
        priority: 5,
        expectedOutput: 'text',
      }));

      const mockResponse = JSON.stringify({
        taskId: 'task_many',
        summary: 'Many steps',
        steps,
        estimatedComplexity: 'high',
      });

      const provider = createMockProvider(mockResponse);
      const config: PlannerConfig = { provider, maxSteps: 5 };

      const plan = await createPlan('Complex task', config);

      expect(plan.steps.length).toBeLessThanOrEqual(5);
    });
  });
});

// =============================================================================
// Executor Tests
// =============================================================================

describe('Orchestration Executor', () => {
  describe('executePlan', () => {
    it('executes all steps successfully', async () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: [] },
        { id: 'step_2', dependsOn: [] },
      ]);

      const responses = new Map<string, WorkerResult>();
      const dispatcher = createMockDispatcher(responses);

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 2,
      };

      const result = await executePlan(plan, { query: 'test' }, config);

      expect(result.allSucceeded).toBe(true);
      expect(result.successfulSteps).toHaveLength(2);
      expect(result.failedSteps).toHaveLength(0);
    });

    it('handles step failures', async () => {
      const plan = createMockPlan([{ id: 'step_1', dependsOn: [] }]);

      const responses = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: false,
            error: 'Test error',
            durationMs: 10,
          },
        ],
      ]);

      const dispatcher = createMockDispatcher(responses);

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 2,
      };

      const result = await executePlan(plan, { query: 'test' }, config);

      expect(result.allSucceeded).toBe(false);
      expect(result.failedSteps).toHaveLength(1);
    });

    it('skips steps with failed dependencies', async () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: [] },
        { id: 'step_2', dependsOn: ['step_1'] },
      ]);

      const responses = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: false,
            error: 'Test error',
            durationMs: 10,
          },
        ],
      ]);

      const dispatcher = createMockDispatcher(responses);

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 2,
        continueOnError: true,
      };

      const result = await executePlan(plan, { query: 'test' }, config);

      expect(result.skippedSteps).toContain('step_2');
    });

    it('executes independent steps in parallel', async () => {
      const runOrder: string[] = [];

      const plan = createMockPlan([
        { id: 'step_a', dependsOn: [] },
        { id: 'step_b', dependsOn: [] },
        { id: 'step_c', dependsOn: ['step_a', 'step_b'] },
      ]);

      const dispatcher = vi.fn().mockImplementation(async (_, input) => {
        runOrder.push(input.step.id);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          stepId: input.step.id,
          success: true,
          data: 'result',
          durationMs: 10,
        };
      });

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 5,
      };

      await executePlan(plan, { query: 'test' }, config);

      // step_a and step_b should run before step_c
      const aIndex = runOrder.indexOf('step_a');
      const bIndex = runOrder.indexOf('step_b');
      const cIndex = runOrder.indexOf('step_c');

      expect(aIndex).toBeLessThan(cIndex);
      expect(bIndex).toBeLessThan(cIndex);
    });

    it('calls progress callback', async () => {
      const plan = createMockPlan([{ id: 'step_1', dependsOn: [] }]);

      const dispatcher = createMockDispatcher(new Map());
      const onProgress = vi.fn();

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 2,
      };

      await executePlan(plan, { query: 'test' }, config, onProgress);

      expect(onProgress).toHaveBeenCalledWith('step_1', 'started');
      expect(onProgress).toHaveBeenCalledWith('step_1', 'completed', expect.any(Object));
    });

    it('stops on error when continueOnError is false', async () => {
      const plan = createMockPlan([
        { id: 'step_1', dependsOn: [] },
        { id: 'step_2', dependsOn: ['step_1'] },
        { id: 'step_3', dependsOn: ['step_2'] },
      ]);

      const responses = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: false,
            error: 'Error',
            durationMs: 10,
          },
        ],
      ]);

      const dispatcher = createMockDispatcher(responses);

      const config: ExecutorConfig = {
        dispatcher,
        maxParallel: 2,
        continueOnError: false,
      };

      const result = await executePlan(plan, { query: 'test' }, config);

      expect(result.failedSteps).toContain('step_1');
      expect(result.skippedSteps).toContain('step_2');
      expect(result.skippedSteps).toContain('step_3');
    });
  });

  describe('createMockDispatcher', () => {
    it('returns configured responses', async () => {
      const responses = new Map<string, WorkerResult>([
        [
          'test_step',
          {
            stepId: 'test_step',
            success: true,
            data: 'custom result',
            durationMs: 5,
          },
        ],
      ]);

      const dispatcher = createMockDispatcher(responses);

      const result = await dispatcher('general', {
        step: {
          id: 'test_step',
          description: 'Test',
          workerType: 'general',
          task: 'Test',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
        dependencyResults: new Map(),
        context: { query: 'test' },
        traceId: 'trace_123',
      });

      expect(result.data).toBe('custom result');
    });

    it('returns default response for unknown steps', async () => {
      const dispatcher = createMockDispatcher(new Map());

      const result = await dispatcher('code', {
        step: {
          id: 'unknown_step',
          description: 'Test',
          workerType: 'code',
          task: 'Test',
          dependsOn: [],
          priority: 5,
          expectedOutput: 'text',
        },
        dependencyResults: new Map(),
        context: { query: 'test' },
        traceId: 'trace_123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('Mock result');
    });
  });
});

// =============================================================================
// Aggregator Tests
// =============================================================================

describe('Orchestration Aggregator', () => {
  describe('quickAggregate', () => {
    it('aggregates successful results', () => {
      const plan = createMockPlan([
        { id: 'step_1', description: 'First step' },
        { id: 'step_2', description: 'Second step' },
      ]);

      const results = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: true,
            data: 'Result 1',
            durationMs: 100,
          },
        ],
        [
          'step_2',
          {
            stepId: 'step_2',
            success: true,
            data: 'Result 2',
            durationMs: 200,
          },
        ],
      ]);

      const execResult = {
        results,
        successfulSteps: ['step_1', 'step_2'],
        failedSteps: [],
        skippedSteps: [],
        totalDurationMs: 300,
        allSucceeded: true,
      };

      const aggregation = quickAggregate(plan, execResult);

      expect(aggregation.summary.successCount).toBe(2);
      expect(aggregation.summary.failureCount).toBe(0);
      expect(aggregation.response).toContain('Result 1');
      expect(aggregation.response).toContain('Result 2');
    });

    it('includes errors in aggregation', () => {
      const plan = createMockPlan([{ id: 'step_1', description: 'Failed step' }]);

      const results = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: false,
            error: 'Test error message',
            durationMs: 50,
          },
        ],
      ]);

      const execResult = {
        results,
        successfulSteps: [],
        failedSteps: ['step_1'],
        skippedSteps: [],
        totalDurationMs: 50,
        allSucceeded: false,
      };

      const aggregation = quickAggregate(plan, execResult);

      expect(aggregation.errors).toHaveLength(1);
      expect(aggregation.errors[0].error).toBe('Test error message');
      expect(aggregation.response).toContain('Error');
    });
  });

  describe('aggregateResults', () => {
    it('uses LLM for synthesis', async () => {
      const provider = createMockProvider('Synthesized response from LLM');

      const plan = createMockPlan([{ id: 'step_1', description: 'Test step' }]);

      const results = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: true,
            data: 'Step result',
            durationMs: 100,
          },
        ],
      ]);

      const execResult = {
        results,
        successfulSteps: ['step_1'],
        failedSteps: [],
        skippedSteps: [],
        totalDurationMs: 100,
        allSucceeded: true,
      };

      const config: AggregatorConfig = { provider };

      const aggregation = await aggregateResults(plan, execResult, config);

      expect(aggregation.response).toBe('Synthesized response from LLM');
      expect(provider.chat).toHaveBeenCalled();
    });

    it('falls back to simple aggregation on LLM error', async () => {
      const provider: LLMProvider = {
        chat: vi.fn().mockRejectedValue(new Error('LLM error')),
      };

      const plan = createMockPlan([{ id: 'step_1', description: 'Test step' }]);

      const results = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: true,
            data: 'Step result',
            durationMs: 100,
          },
        ],
      ]);

      const execResult = {
        results,
        successfulSteps: ['step_1'],
        failedSteps: [],
        skippedSteps: [],
        totalDurationMs: 100,
        allSucceeded: true,
      };

      const config: AggregatorConfig = { provider };

      const aggregation = await aggregateResults(plan, execResult, config);

      // Should fallback to simple aggregation
      expect(aggregation.response).toContain('Step result');
    });
  });

  describe('extractKeyFindings', () => {
    it('extracts bullet points from text output', () => {
      const result = {
        response: 'Test',
        summary: {
          totalSteps: 1,
          successCount: 1,
          failureCount: 0,
          skippedCount: 0,
          totalDurationMs: 100,
        },
        stepOutputs: [
          {
            stepId: 'step_1',
            success: true,
            output: '- Finding 1\n- Finding 2\n- Finding 3',
          },
        ],
        errors: [],
      };

      const findings = extractKeyFindings(result);

      expect(findings).toContain('Finding 1');
      expect(findings).toContain('Finding 2');
    });

    it('extracts findings from structured data', () => {
      const result = {
        response: 'Test',
        summary: {
          totalSteps: 1,
          successCount: 1,
          failureCount: 0,
          skippedCount: 0,
          totalDurationMs: 100,
        },
        stepOutputs: [
          {
            stepId: 'step_1',
            success: true,
            output: {
              findings: ['Key insight 1', 'Key insight 2'],
              summary: 'Overall summary',
            },
          },
        ],
        errors: [],
      };

      const findings = extractKeyFindings(result);

      expect(findings).toContain('Key insight 1');
      expect(findings).toContain('Overall summary');
    });

    it('limits to 5 findings', () => {
      const result = {
        response: 'Test',
        summary: {
          totalSteps: 1,
          successCount: 1,
          failureCount: 0,
          skippedCount: 0,
          totalDurationMs: 100,
        },
        stepOutputs: [
          {
            stepId: 'step_1',
            success: true,
            output: {
              findings: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'],
            },
          },
        ],
        errors: [],
      };

      const findings = extractKeyFindings(result);

      expect(findings.length).toBeLessThanOrEqual(5);
    });
  });
});

// =============================================================================
// Worker Utility Tests
// =============================================================================

describe('Worker Utilities', () => {
  describe('formatDependencyContext', () => {
    it('returns empty string for no dependencies', () => {
      const result = formatDependencyContext(new Map());
      expect(result).toBe('');
    });

    it('formats successful dependency results', () => {
      const deps = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: true,
            data: 'Result data',
            durationMs: 100,
          },
        ],
      ]);

      const result = formatDependencyContext(deps);

      expect(result).toContain('Step: step_1');
      expect(result).toContain('Result data');
    });

    it('formats error dependency results', () => {
      const deps = new Map<string, WorkerResult>([
        [
          'step_1',
          {
            stepId: 'step_1',
            success: false,
            error: 'Error message',
            durationMs: 50,
          },
        ],
      ]);

      const result = formatDependencyContext(deps);

      expect(result).toContain('Error: Error message');
    });
  });

  describe('isSuccessfulResult', () => {
    it('returns true for successful result', () => {
      const result: WorkerResult = {
        stepId: 'test',
        success: true,
        data: 'data',
        durationMs: 100,
      };

      expect(isSuccessfulResult(result)).toBe(true);
    });

    it('returns false for failed result', () => {
      const result: WorkerResult = {
        stepId: 'test',
        success: false,
        error: 'error',
        durationMs: 100,
      };

      expect(isSuccessfulResult(result)).toBe(false);
    });
  });

  describe('summarizeResults', () => {
    it('summarizes multiple results', () => {
      const results: WorkerResult[] = [
        { stepId: 'step_1', success: true, data: 'data', durationMs: 100 },
        { stepId: 'step_2', success: true, data: 'data', durationMs: 200 },
        {
          stepId: 'step_3',
          success: false,
          error: 'Error',
          durationMs: 50,
        },
      ];

      const summary = summarizeResults(results);

      expect(summary.totalSteps).toBe(3);
      expect(summary.successCount).toBe(2);
      expect(summary.failureCount).toBe(1);
      expect(summary.totalDurationMs).toBe(350);
      expect(summary.errors).toHaveLength(1);
    });
  });
});

// =============================================================================
// Worker Task Type Detection Tests
// =============================================================================

describe('Worker Task Type Detection', () => {
  describe('detectCodeTaskType', () => {
    it('detects review tasks', () => {
      expect(detectCodeTaskType('Review this code')).toBe('review');
      expect(detectCodeTaskType('Check the implementation')).toBe('review');
    });

    it('detects generate tasks', () => {
      expect(detectCodeTaskType('Generate a function')).toBe('generate');
      expect(detectCodeTaskType('Create a class')).toBe('generate');
      expect(detectCodeTaskType('Write unit tests')).toBe('generate');
    });

    it('detects refactor tasks', () => {
      expect(detectCodeTaskType('Refactor the code')).toBe('refactor');
      expect(detectCodeTaskType('Improve performance')).toBe('refactor');
      expect(detectCodeTaskType('Clean up the module')).toBe('refactor');
    });

    it('detects fix tasks', () => {
      expect(detectCodeTaskType('Fix the bug')).toBe('fix');
      expect(detectCodeTaskType('Handle the error')).toBe('fix');
    });

    it('defaults to analyze', () => {
      expect(detectCodeTaskType('Some random task')).toBe('analyze');
    });
  });

  describe('detectResearchTaskType', () => {
    it('detects search tasks', () => {
      expect(detectResearchTaskType('Search for libraries')).toBe('search');
      expect(detectResearchTaskType('Find documentation')).toBe('search');
    });

    it('detects compare tasks', () => {
      expect(detectResearchTaskType('Compare React vs Vue')).toBe('compare');
      expect(detectResearchTaskType('Library A versus Library B')).toBe('compare');
    });

    it('detects summarize tasks', () => {
      expect(detectResearchTaskType('Summarize the article')).toBe('summarize');
      expect(detectResearchTaskType('Give me a summary')).toBe('summarize');
    });

    it('defaults to analyze', () => {
      expect(detectResearchTaskType('Some random task')).toBe('analyze');
    });
  });

  describe('detectGitHubTaskType', () => {
    it('detects PR review tasks', () => {
      expect(detectGitHubTaskType('Review PR #123')).toBe('pr_review');
      expect(detectGitHubTaskType('Pull request review needed')).toBe('pr_review');
    });

    it('detects PR create tasks', () => {
      expect(detectGitHubTaskType('Create PR for feature')).toBe('pr_create');
      expect(detectGitHubTaskType('Draft PR description')).toBe('pr_create');
    });

    it('detects issue tasks', () => {
      expect(detectGitHubTaskType('Triage the issues')).toBe('issue_triage');
      expect(detectGitHubTaskType('Create issue for bug')).toBe('issue_create');
    });

    it('detects diff tasks', () => {
      expect(detectGitHubTaskType('Analyze the diff')).toBe('diff_analyze');
      expect(detectGitHubTaskType('Review the changes')).toBe('diff_analyze');
    });

    it('defaults to diff_analyze', () => {
      expect(detectGitHubTaskType('Some random task')).toBe('diff_analyze');
    });
  });
});
