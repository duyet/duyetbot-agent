import { beforeEach, describe, expect, it } from 'vitest';
import { TokenTracker } from '../token-tracker.js';

describe('TokenTracker', () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker();
  });

  it('should have initial usage as zeros', () => {
    const usage = tracker.getUsage();

    expect(usage).toEqual({
      input: 0,
      output: 0,
      total: 0,
    });
  });

  it('should accumulate input tokens', () => {
    tracker.addUsage({ input: 100 });
    tracker.addUsage({ input: 50 });

    const usage = tracker.getUsage();
    expect(usage.input).toBe(150);
  });

  it('should accumulate output tokens', () => {
    tracker.addUsage({ output: 200 });
    tracker.addUsage({ output: 100 });

    const usage = tracker.getUsage();
    expect(usage.output).toBe(300);
  });

  it('should accumulate total tokens', () => {
    tracker.addUsage({ total: 300 });
    tracker.addUsage({ total: 150 });

    const usage = tracker.getUsage();
    expect(usage.total).toBe(450);
  });

  it('should handle cached tokens', () => {
    tracker.addUsage({ cached: 50 });
    tracker.addUsage({ cached: 25 });

    const usage = tracker.getUsage();
    expect(usage.cached).toBe(75);
  });

  it('should handle reasoning tokens', () => {
    tracker.addUsage({ reasoning: 100 });
    tracker.addUsage({ reasoning: 50 });

    const usage = tracker.getUsage();
    expect(usage.reasoning).toBe(150);
  });

  it('should handle costUsd', () => {
    tracker.addUsage({ costUsd: 0.05 });
    tracker.addUsage({ costUsd: 0.03 });

    const usage = tracker.getUsage();
    expect(usage.costUsd).toBeCloseTo(0.08, 5);
  });

  it('should set model', () => {
    tracker.setModel('anthropic/claude-3-5-sonnet');

    expect(tracker.getModel()).toBe('anthropic/claude-3-5-sonnet');
  });

  it('should return undefined for model initially', () => {
    expect(tracker.getModel()).toBeUndefined();
  });

  it('should reset usage and model', () => {
    tracker.addUsage({ input: 100, output: 200, total: 300 });
    tracker.setModel('anthropic/claude-3-5-sonnet');

    tracker.reset();

    expect(tracker.getUsage()).toEqual({
      input: 0,
      output: 0,
      total: 0,
    });
    expect(tracker.getModel()).toBeUndefined();
  });
});
