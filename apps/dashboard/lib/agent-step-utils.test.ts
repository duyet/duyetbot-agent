import { describe, expect, test } from 'vitest';
import {
  type AgentStep,
  calculatePaddingLeft,
  formatDuration,
  formatTokenCount,
  getStatusBgClass,
  getStatusConfig,
  getStatusLabel,
  hasChildren,
  isFinalStatus,
  isRunning,
} from './agent-step-utils';

// Helper to create minimal agent step
function createAgentStep(overrides: Partial<AgentStep> = {}): AgentStep {
  return {
    id: 'step-1',
    name: 'Test Step',
    duration: 100,
    tokens: 1000,
    status: 'pending',
    children: [],
    ...overrides,
  };
}

describe('getStatusBgClass', () => {
  test('returns correct bg class for success status', () => {
    expect(getStatusBgClass('success')).toBe('bg-success/10 border-success/20');
  });

  test('returns correct bg class for error status', () => {
    expect(getStatusBgClass('error')).toBe('bg-destructive/10 border-destructive/20');
  });

  test('returns correct bg class for pending status', () => {
    expect(getStatusBgClass('pending')).toBe('bg-muted/50 border-muted');
  });

  test('returns correct bg class for running status', () => {
    expect(getStatusBgClass('running')).toBe('bg-primary/10 border-primary/20');
  });
});

describe('getStatusLabel', () => {
  test('returns correct label for success status', () => {
    expect(getStatusLabel('success')).toBe('Success');
  });

  test('returns correct label for error status', () => {
    expect(getStatusLabel('error')).toBe('Error');
  });

  test('returns correct label for pending status', () => {
    expect(getStatusLabel('pending')).toBe('Pending');
  });

  test('returns correct label for running status', () => {
    expect(getStatusLabel('running')).toBe('Running');
  });
});

describe('isFinalStatus', () => {
  test('returns true for success', () => {
    expect(isFinalStatus('success')).toBe(true);
  });

  test('returns true for error', () => {
    expect(isFinalStatus('error')).toBe(true);
  });

  test('returns false for pending', () => {
    expect(isFinalStatus('pending')).toBe(false);
  });

  test('returns false for running', () => {
    expect(isFinalStatus('running')).toBe(false);
  });
});

describe('isRunning', () => {
  test('returns true only for running status', () => {
    expect(isRunning('running')).toBe(true);
    expect(isRunning('pending')).toBe(false);
    expect(isRunning('success')).toBe(false);
    expect(isRunning('error')).toBe(false);
  });
});

describe('hasChildren', () => {
  test('returns true when step has children', () => {
    const step = createAgentStep({
      children: [createAgentStep({ id: 'child-1' }), createAgentStep({ id: 'child-2' })],
    });
    expect(hasChildren(step)).toBe(true);
  });

  test('returns false when step has no children', () => {
    const step = createAgentStep();
    expect(hasChildren(step)).toBe(false);
  });

  test('returns false for empty children array', () => {
    const step = createAgentStep({ children: [] });
    expect(hasChildren(step)).toBe(false);
  });
});

describe('calculatePaddingLeft', () => {
  test('calculates padding with default unit', () => {
    expect(calculatePaddingLeft(0)).toBe('0rem');
    expect(calculatePaddingLeft(1)).toBe('1.5rem');
    expect(calculatePaddingLeft(2)).toBe('3rem');
    expect(calculatePaddingLeft(3)).toBe('4.5rem');
  });

  test('calculates padding with custom unit', () => {
    expect(calculatePaddingLeft(1, 1)).toBe('1rem');
    expect(calculatePaddingLeft(2, 2)).toBe('4rem');
    expect(calculatePaddingLeft(3, 0.5)).toBe('1.5rem');
  });

  test('handles zero level', () => {
    expect(calculatePaddingLeft(0)).toBe('0rem');
    expect(calculatePaddingLeft(0, 2)).toBe('0rem');
  });
});

describe('formatDuration', () => {
  test('formats duration in milliseconds', () => {
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(1000)).toBe('1000ms');
    expect(formatDuration(0)).toBe('0ms');
  });

  test('handles large durations', () => {
    expect(formatDuration(60000)).toBe('60000ms');
  });
});

describe('formatTokenCount', () => {
  test('formats token count with locale', () => {
    expect(formatTokenCount(1000)).toBe('1,000');
    expect(formatTokenCount(1000000)).toBe('1,000,000');
    expect(formatTokenCount(0)).toBe('0');
  });

  test('handles small numbers', () => {
    expect(formatTokenCount(1)).toBe('1');
    expect(formatTokenCount(42)).toBe('42');
  });
});

describe('getStatusConfig', () => {
  test('returns complete config for success', () => {
    const config = getStatusConfig('success');
    expect(config).toEqual({
      bgClass: 'bg-success/10 border-success/20',
      label: 'Success',
    });
  });

  test('returns complete config for error', () => {
    const config = getStatusConfig('error');
    expect(config).toEqual({
      bgClass: 'bg-destructive/10 border-destructive/20',
      label: 'Error',
    });
  });

  test('returns complete config for pending', () => {
    const config = getStatusConfig('pending');
    expect(config).toEqual({
      bgClass: 'bg-muted/50 border-muted',
      label: 'Pending',
    });
  });

  test('returns complete config for running', () => {
    const config = getStatusConfig('running');
    expect(config).toEqual({
      bgClass: 'bg-primary/10 border-primary/20',
      label: 'Running',
    });
  });
});

describe('Integration scenarios', () => {
  test('handles nested step structure', () => {
    const child1 = createAgentStep({ id: 'child-1', status: 'success', duration: 50 });
    const child2 = createAgentStep({ id: 'child-2', status: 'error', duration: 75 });
    const parent = createAgentStep({
      id: 'parent',
      status: 'success',
      duration: 200,
      children: [child1, child2],
    });

    expect(hasChildren(parent)).toBe(true);
    expect(hasChildren(child1)).toBe(false);
    expect(isFinalStatus(parent.status)).toBe(true);
    expect(formatDuration(parent.duration)).toBe('200ms');
  });

  test('calculates padding for deeply nested structure', () => {
    expect(calculatePaddingLeft(0)).toBe('0rem');
    expect(calculatePaddingLeft(1)).toBe('1.5rem');
    expect(calculatePaddingLeft(5)).toBe('7.5rem');
  });
});
