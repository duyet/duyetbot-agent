import { describe, expect, test } from 'vitest';
import type { TokenHeatmapData } from '@/types';
import {
  getDayLabels,
  getHeatmapColor,
  getHeatmapColorScale,
  getHourLabel,
  getMaxTokens,
  groupHeatmapByGrid,
} from './token-heatmap-utils';

describe('getHeatmapColor', () => {
  test('returns lightest color for values under 25%', () => {
    expect(getHeatmapColor(0, 100)).toBe('#e0e7ff');
    expect(getHeatmapColor(10, 100)).toBe('#e0e7ff');
    expect(getHeatmapColor(24, 100)).toBe('#e0e7ff');
  });

  test('returns second lightest color for values 25-50%', () => {
    expect(getHeatmapColor(25, 100)).toBe('#a5b4fc');
    expect(getHeatmapColor(35, 100)).toBe('#a5b4fc');
    expect(getHeatmapColor(49, 100)).toBe('#a5b4fc');
  });

  test('returns medium color for values 50-75%', () => {
    expect(getHeatmapColor(50, 100)).toBe('#6366f1');
    expect(getHeatmapColor(60, 100)).toBe('#6366f1');
    expect(getHeatmapColor(74, 100)).toBe('#6366f1');
  });

  test('returns darkest color for values 75% and above', () => {
    expect(getHeatmapColor(75, 100)).toBe('#4f46e5');
    expect(getHeatmapColor(90, 100)).toBe('#4f46e5');
    expect(getHeatmapColor(100, 100)).toBe('#4f46e5');
  });

  test('handles edge cases', () => {
    expect(getHeatmapColor(0, 0)).toBe('#4f46e5'); // ratio = 0/0 = NaN, falls through to default
    expect(getHeatmapColor(1, 1)).toBe('#4f46e5'); // 100%
  });
});

describe('getHeatmapColorScale', () => {
  test('returns array of 4 colors from lightest to darkest', () => {
    const scale = getHeatmapColorScale();
    expect(scale).toEqual(['#e0e7ff', '#a5b4fc', '#6366f1', '#4f46e5']);
  });

  test('returns consistent colors on multiple calls', () => {
    const scale1 = getHeatmapColorScale();
    const scale2 = getHeatmapColorScale();
    expect(scale1).toEqual(scale2);
  });
});

describe('groupHeatmapByGrid', () => {
  test('groups data by day and hour into 7x24 grid', () => {
    const data: TokenHeatmapData[] = [
      { day: 0, hour: 0, tokens: 100 },
      { day: 0, hour: 1, tokens: 200 },
      { day: 1, hour: 5, tokens: 300 },
      { day: 6, hour: 23, tokens: 400 },
    ];

    const grid = groupHeatmapByGrid(data);

    expect(grid).toHaveLength(7);
    expect(grid[0]).toHaveLength(24);
    expect(grid[0]![0]).toBe(100);
    expect(grid[0]![1]).toBe(200);
    expect(grid[1]![5]).toBe(300);
    expect(grid[6]![23]).toBe(400);
  });

  test('fills missing data with zeros', () => {
    const data: TokenHeatmapData[] = [{ day: 0, hour: 0, tokens: 100 }];

    const grid = groupHeatmapByGrid(data);

    expect(grid[0]![0]).toBe(100);
    expect(grid[0]![1]).toBe(0);
    expect(grid[6]![23]).toBe(0);
  });

  test('handles empty data', () => {
    const data: TokenHeatmapData[] = [];
    const grid = groupHeatmapByGrid(data);

    expect(grid).toHaveLength(7);
    expect(grid.every((day) => day.length === 24)).toBe(true);
    expect(grid.every((day) => day.every((hour) => hour === 0))).toBe(true);
  });

  test('handles all hours for a single day', () => {
    const data: TokenHeatmapData[] = Array.from({ length: 24 }, (_, hour) => ({
      day: 0,
      hour,
      tokens: (hour + 1) * 10,
    }));

    const grid = groupHeatmapByGrid(data);

    for (let hour = 0; hour < 24; hour++) {
      expect(grid[0]![hour]).toBe((hour + 1) * 10);
    }
  });
});

describe('getDayLabels', () => {
  test('returns 7 day abbreviations starting with Sunday', () => {
    expect(getDayLabels()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  test('returns consistent labels on multiple calls', () => {
    const labels1 = getDayLabels();
    const labels2 = getDayLabels();
    expect(labels1).toEqual(labels2);
  });
});

describe('getHourLabel', () => {
  test('returns hour string for every 6 hours', () => {
    expect(getHourLabel(0)).toBe('0');
    expect(getHourLabel(6)).toBe('6');
    expect(getHourLabel(12)).toBe('12');
    expect(getHourLabel(18)).toBe('18');
  });

  test('returns empty string for non-multiple-of-6 hours', () => {
    expect(getHourLabel(1)).toBe('');
    expect(getHourLabel(5)).toBe('');
    expect(getHourLabel(7)).toBe('');
    expect(getHourLabel(23)).toBe('');
  });

  test('handles edge hours', () => {
    expect(getHourLabel(0)).toBe('0');
    expect(getHourLabel(24)).toBe('24'); // 24 % 6 = 0, returns hour as string
  });
});

describe('getMaxTokens', () => {
  test('returns maximum token value from data', () => {
    const data: TokenHeatmapData[] = [
      { day: 0, hour: 0, tokens: 100 },
      { day: 0, hour: 1, tokens: 500 },
      { day: 0, hour: 2, tokens: 250 },
    ];

    expect(getMaxTokens(data)).toBe(500);
  });

  test('returns 1 for empty data', () => {
    expect(getMaxTokens([])).toBe(1);
  });

  test('returns 1 when all tokens are zero', () => {
    const data: TokenHeatmapData[] = [
      { day: 0, hour: 0, tokens: 0 },
      { day: 0, hour: 1, tokens: 0 },
    ];

    expect(getMaxTokens(data)).toBe(1);
  });

  test('handles single data point', () => {
    const data: TokenHeatmapData[] = [{ day: 0, hour: 0, tokens: 42 }];
    expect(getMaxTokens(data)).toBe(42);
  });

  test('handles negative values (returns fallback 1)', () => {
    const data: TokenHeatmapData[] = [
      { day: 0, hour: 0, tokens: -100 },
      { day: 0, hour: 1, tokens: -50 },
    ];

    // Math.max(-100, -50, 1) = 1, because fallback 1 is greater
    expect(getMaxTokens(data)).toBe(1);
  });
});
