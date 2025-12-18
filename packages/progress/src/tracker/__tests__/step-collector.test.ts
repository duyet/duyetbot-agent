import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepCollector } from '../step-collector.js';

describe('StepCollector', () => {
  let collector: StepCollector;

  beforeEach(() => {
    collector = new StepCollector();
  });

  it('should add steps and accumulate them', () => {
    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    collector.addStep({
      type: 'tool_start',
      iteration: 1,
      durationMs: 0,
      toolName: 'get_posts',
      args: { limit: 10 },
    });

    const steps = collector.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('thinking');
    expect(steps[1].type).toBe('tool_start');
  });

  it('should auto-generate timestamp for added steps', () => {
    const beforeAdd = new Date().toISOString();

    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    const afterAdd = new Date().toISOString();
    const steps = collector.getSteps();

    expect(steps[0].timestamp).toBeDefined();
    expect(steps[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(steps[0].timestamp >= beforeAdd).toBe(true);
    expect(steps[0].timestamp <= afterAdd).toBe(true);
  });

  it('should return a copy of steps (immutable)', () => {
    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    const steps1 = collector.getSteps();
    const steps2 = collector.getSteps();

    expect(steps1).not.toBe(steps2); // Different array instances
    expect(steps1).toEqual(steps2); // Same content
  });

  it('should return max iteration from steps', () => {
    expect(collector.getCurrentIteration()).toBe(0);

    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    expect(collector.getCurrentIteration()).toBe(1);

    collector.addStep({
      type: 'tool_start',
      iteration: 2,
      durationMs: 0,
      toolName: 'get_posts',
      args: {},
    });

    expect(collector.getCurrentIteration()).toBe(2);
  });

  it('should generate execution path for thinking step', () => {
    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
      thinking: 'analyzing input',
    });

    expect(collector.getExecutionPath()).toEqual(['thinking']);
  });

  it('should generate execution path for routing step', () => {
    collector.addStep({
      type: 'routing',
      iteration: 1,
      durationMs: 50,
      agentName: 'SimpleAgent',
    });

    expect(collector.getExecutionPath()).toEqual(['routing:SimpleAgent']);
  });

  it('should generate execution path for tool_start step', () => {
    collector.addStep({
      type: 'tool_start',
      iteration: 1,
      durationMs: 0,
      toolName: 'get_posts',
      args: { limit: 10 },
    });

    expect(collector.getExecutionPath()).toEqual(['tool:get_posts:start']);
  });

  it('should generate execution path for tool_complete step', () => {
    collector.addStep({
      type: 'tool_complete',
      iteration: 1,
      durationMs: 200,
      toolName: 'get_posts',
      args: { limit: 10 },
      result: '[{"id": 1}]',
    });

    expect(collector.getExecutionPath()).toEqual(['tool:get_posts:complete']);
  });

  it('should generate execution path for tool_error step', () => {
    collector.addStep({
      type: 'tool_error',
      iteration: 1,
      durationMs: 150,
      toolName: 'get_posts',
      args: { limit: 10 },
      error: 'API timeout',
    });

    expect(collector.getExecutionPath()).toEqual(['tool:get_posts:error']);
  });

  it('should generate execution path for llm_iteration step', () => {
    collector.addStep({
      type: 'llm_iteration',
      iteration: 1,
      durationMs: 0,
      maxIterations: 5,
    });

    expect(collector.getExecutionPath()).toEqual(['llm_iteration']);
  });

  it('should generate execution path for preparing step', () => {
    collector.addStep({
      type: 'preparing',
      iteration: 0,
      durationMs: 10,
    });

    expect(collector.getExecutionPath()).toEqual(['preparing']);
  });

  it('should generate full execution path with multiple steps', () => {
    collector.addStep({
      type: 'preparing',
      iteration: 0,
      durationMs: 10,
    });

    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    collector.addStep({
      type: 'routing',
      iteration: 1,
      durationMs: 50,
      agentName: 'SimpleAgent',
    });

    collector.addStep({
      type: 'tool_start',
      iteration: 1,
      durationMs: 0,
      toolName: 'get_posts',
      args: {},
    });

    collector.addStep({
      type: 'tool_complete',
      iteration: 1,
      durationMs: 200,
      toolName: 'get_posts',
      args: {},
      result: '[]',
    });

    expect(collector.getExecutionPath()).toEqual([
      'preparing',
      'thinking',
      'routing:SimpleAgent',
      'tool:get_posts:start',
      'tool:get_posts:complete',
    ]);
  });

  it('should clear all steps on reset', () => {
    collector.addStep({
      type: 'thinking',
      iteration: 1,
      durationMs: 100,
    });

    collector.addStep({
      type: 'tool_start',
      iteration: 1,
      durationMs: 0,
      toolName: 'get_posts',
      args: {},
    });

    expect(collector.getSteps()).toHaveLength(2);

    collector.reset();

    expect(collector.getSteps()).toHaveLength(0);
    expect(collector.getCurrentIteration()).toBe(0);
    expect(collector.getExecutionPath()).toEqual([]);
  });

  it('should call onStep callback when step is added', () => {
    const onStep = vi.fn();
    collector = new StepCollector({ onStep });

    const stepData = {
      type: 'thinking' as const,
      iteration: 1,
      durationMs: 100,
    };

    collector.addStep(stepData);

    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it('should call onStep callback with correct step data', () => {
    const onStep = vi.fn();
    collector = new StepCollector({ onStep });

    const stepData = {
      type: 'routing' as const,
      iteration: 1,
      durationMs: 50,
      agentName: 'SimpleAgent',
    };

    collector.addStep(stepData);

    expect(onStep).toHaveBeenCalledWith(
      expect.objectContaining({
        ...stepData,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });
});
