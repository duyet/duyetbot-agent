import { Activity } from 'lucide-react';
import { describe, expect, test } from 'vitest';
import type { KPICard } from '@/types';
import {
  formatChange,
  formatChangeLabel,
  getTrendColorClass,
  hasNegativeChange,
  hasNeutralChange,
  hasPositiveChange,
  type TrendDirection,
} from './kpi-card-utils';

// Helper to create minimal KPI card for testing
function createKPICard(overrides: Partial<KPICard> = {}): KPICard {
  return {
    title: 'Test Metric',
    value: '100',
    change: 10,
    changeLabel: 'vs last week',
    icon: Activity,
    trend: 'up',
    ...overrides,
  };
}

describe('getTrendColorClass', () => {
  test('returns green for up trend', () => {
    expect(getTrendColorClass('up')).toBe('text-green-500');
  });

  test('returns red for down trend', () => {
    expect(getTrendColorClass('down')).toBe('text-red-500');
  });

  test('returns gray for neutral trend', () => {
    expect(getTrendColorClass('neutral')).toBe('text-gray-500');
  });

  test('handles all trend types', () => {
    const trends: TrendDirection[] = ['up', 'down', 'neutral'];
    const results = trends.map(getTrendColorClass);
    expect(results).toEqual(['text-green-500', 'text-red-500', 'text-gray-500']);
  });
});

describe('formatChange', () => {
  test('adds + prefix for positive values', () => {
    expect(formatChange(5)).toBe('+5');
    expect(formatChange(0.1)).toBe('+0.1');
    expect(formatChange(100)).toBe('+100');
  });

  test('does not add prefix for negative values', () => {
    expect(formatChange(-5)).toBe('-5');
    expect(formatChange(-0.1)).toBe('-0.1');
    expect(formatChange(-100)).toBe('-100');
  });

  test('handles zero', () => {
    expect(formatChange(0)).toBe('0');
  });

  test('handles decimal values', () => {
    expect(formatChange(12.5)).toBe('+12.5');
    expect(formatChange(-3.14)).toBe('-3.14');
  });

  test('handles very large values', () => {
    expect(formatChange(1000)).toBe('+1000');
    expect(formatChange(-9999)).toBe('-9999');
  });
});

describe('formatChangeLabel', () => {
  test('formats positive change with context', () => {
    const result = formatChangeLabel(15, 'vs last week');
    expect(result).toEqual({
      formattedChange: '+15%',
      label: 'vs last week',
    });
  });

  test('formats negative change with context', () => {
    const result = formatChangeLabel(-8, 'vs yesterday');
    expect(result).toEqual({
      formattedChange: '-8%',
      label: 'vs yesterday',
    });
  });

  test('formats zero change with context', () => {
    const result = formatChangeLabel(0, 'vs last month');
    expect(result).toEqual({
      formattedChange: '0%',
      label: 'vs last month',
    });
  });

  test('handles decimal changes', () => {
    const result = formatChangeLabel(2.5, 'vs baseline');
    expect(result).toEqual({
      formattedChange: '+2.5%',
      label: 'vs baseline',
    });
  });
});

describe('hasPositiveChange', () => {
  test('returns true for positive change', () => {
    expect(hasPositiveChange(createKPICard({ change: 1 }))).toBe(true);
    expect(hasPositiveChange(createKPICard({ change: 100 }))).toBe(true);
    expect(hasPositiveChange(createKPICard({ change: 0.1 }))).toBe(true);
  });

  test('returns false for negative change', () => {
    expect(hasPositiveChange(createKPICard({ change: -1 }))).toBe(false);
    expect(hasPositiveChange(createKPICard({ change: -100 }))).toBe(false);
  });

  test('returns false for zero change', () => {
    expect(hasPositiveChange(createKPICard({ change: 0 }))).toBe(false);
  });
});

describe('hasNegativeChange', () => {
  test('returns true for negative change', () => {
    expect(hasNegativeChange(createKPICard({ change: -1 }))).toBe(true);
    expect(hasNegativeChange(createKPICard({ change: -100 }))).toBe(true);
    expect(hasNegativeChange(createKPICard({ change: -0.1 }))).toBe(true);
  });

  test('returns false for positive change', () => {
    expect(hasNegativeChange(createKPICard({ change: 1 }))).toBe(false);
    expect(hasNegativeChange(createKPICard({ change: 100 }))).toBe(false);
  });

  test('returns false for zero change', () => {
    expect(hasNegativeChange(createKPICard({ change: 0 }))).toBe(false);
  });
});

describe('hasNeutralChange', () => {
  test('returns true for zero change', () => {
    expect(hasNeutralChange(createKPICard({ change: 0 }))).toBe(true);
  });

  test('returns false for positive change', () => {
    expect(hasNeutralChange(createKPICard({ change: 1 }))).toBe(false);
    expect(hasNeutralChange(createKPICard({ change: 100 }))).toBe(false);
  });

  test('returns false for negative change', () => {
    expect(hasNeutralChange(createKPICard({ change: -1 }))).toBe(false);
    expect(hasNeutralChange(createKPICard({ change: -100 }))).toBe(false);
  });
});

describe('Integration scenarios', () => {
  test('correctly identifies card with positive up trend', () => {
    const card = createKPICard({ change: 15, trend: 'up' });
    expect(hasPositiveChange(card)).toBe(true);
    expect(hasNegativeChange(card)).toBe(false);
    expect(hasNeutralChange(card)).toBe(false);
    expect(getTrendColorClass(card.trend)).toBe('text-green-500');
  });

  test('correctly identifies card with negative down trend', () => {
    const card = createKPICard({ change: -8, trend: 'down' });
    expect(hasPositiveChange(card)).toBe(false);
    expect(hasNegativeChange(card)).toBe(true);
    expect(hasNeutralChange(card)).toBe(false);
    expect(getTrendColorClass(card.trend)).toBe('text-red-500');
  });

  test('correctly identifies card with neutral trend', () => {
    const card = createKPICard({ change: 0, trend: 'neutral' });
    expect(hasPositiveChange(card)).toBe(false);
    expect(hasNegativeChange(card)).toBe(false);
    expect(hasNeutralChange(card)).toBe(true);
    expect(getTrendColorClass(card.trend)).toBe('text-gray-500');
  });
});
