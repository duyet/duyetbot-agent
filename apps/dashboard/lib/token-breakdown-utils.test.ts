import { describe, expect, test } from 'vitest';
import {
  calculatePercentages,
  calculateTotal,
  formatPercent,
  formatTokenWithPercent,
  hasTokens,
  percentToWidth,
  type TokenBreakdown,
} from './token-breakdown-utils';

describe('calculateTotal', () => {
  test('sums all token types', () => {
    const breakdown: TokenBreakdown = { input: 100, output: 200, cached: 50 };
    expect(calculateTotal(breakdown)).toBe(350);
  });

  test('handles zero values', () => {
    const breakdown: TokenBreakdown = { input: 0, output: 0, cached: 0 };
    expect(calculateTotal(breakdown)).toBe(0);
  });

  test('handles single non-zero value', () => {
    expect(calculateTotal({ input: 100, output: 0, cached: 0 })).toBe(100);
    expect(calculateTotal({ input: 0, output: 200, cached: 0 })).toBe(200);
    expect(calculateTotal({ input: 0, output: 0, cached: 50 })).toBe(50);
  });

  test('handles large numbers', () => {
    const breakdown: TokenBreakdown = { input: 1_000_000, output: 2_000_000, cached: 500_000 };
    expect(calculateTotal(breakdown)).toBe(3_500_000);
  });
});

describe('calculatePercentages', () => {
  test('calculates percentages correctly', () => {
    const breakdown: TokenBreakdown = { input: 100, output: 200, cached: 100 };
    const result = calculatePercentages(breakdown);

    expect(result.input).toBe(25);
    expect(result.output).toBe(50);
    expect(result.cached).toBe(25);
  });

  test('returns zeros for empty breakdown', () => {
    const breakdown: TokenBreakdown = { input: 0, output: 0, cached: 0 };
    const result = calculatePercentages(breakdown);

    expect(result.input).toBe(0);
    expect(result.output).toBe(0);
    expect(result.cached).toBe(0);
  });

  test('handles single token type', () => {
    expect(calculatePercentages({ input: 100, output: 0, cached: 0 })).toEqual({
      input: 100,
      output: 0,
      cached: 0,
    });
  });

  test('handles fractional percentages', () => {
    const breakdown: TokenBreakdown = { input: 1, output: 1, cached: 1 };
    const result = calculatePercentages(breakdown);

    expect(result.input).toBeCloseTo(33.33, 1);
    expect(result.output).toBeCloseTo(33.33, 1);
    expect(result.cached).toBeCloseTo(33.33, 1);
  });
});

describe('formatTokenWithPercent', () => {
  test('formats value with percentage', () => {
    expect(formatTokenWithPercent(1000, 25)).toBe('1,000 (25%)');
    expect(formatTokenWithPercent(500, 50)).toBe('500 (50%)');
  });

  test('formats large numbers with locale', () => {
    expect(formatTokenWithPercent(1_000_000, 75)).toBe('1,000,000 (75%)');
  });

  test('handles zero values', () => {
    expect(formatTokenWithPercent(0, 0)).toBe('0 (0%)');
  });

  test('rounds percentage to integer', () => {
    expect(formatTokenWithPercent(100, 33.333)).toBe('100 (33%)');
  });
});

describe('formatPercent', () => {
  test('formats with default 0 decimals', () => {
    expect(formatPercent(25.5)).toBe('26');
    expect(formatPercent(33.333)).toBe('33');
  });

  test('formats with custom decimals', () => {
    expect(formatPercent(25.5, 1)).toBe('25.5');
    expect(formatPercent(33.333, 2)).toBe('33.33');
  });

  test('handles zero', () => {
    expect(formatPercent(0)).toBe('0');
    expect(formatPercent(0, 2)).toBe('0.00');
  });

  test('handles 100%', () => {
    expect(formatPercent(100)).toBe('100');
  });
});

describe('percentToWidth', () => {
  test('converts percentage to CSS width string', () => {
    expect(percentToWidth(0)).toBe('0%');
    expect(percentToWidth(25)).toBe('25%');
    expect(percentToWidth(50)).toBe('50%');
    expect(percentToWidth(100)).toBe('100%');
  });

  test('handles decimal percentages', () => {
    expect(percentToWidth(33.33)).toBe('33.33%');
  });
});

describe('hasTokens', () => {
  test('returns true when any tokens exist', () => {
    expect(hasTokens({ input: 1, output: 0, cached: 0 })).toBe(true);
    expect(hasTokens({ input: 0, output: 1, cached: 0 })).toBe(true);
    expect(hasTokens({ input: 0, output: 0, cached: 1 })).toBe(true);
    expect(hasTokens({ input: 10, output: 20, cached: 30 })).toBe(true);
  });

  test('returns false when all zeros', () => {
    expect(hasTokens({ input: 0, output: 0, cached: 0 })).toBe(false);
  });
});

describe('Integration scenarios', () => {
  test('full breakdown calculation and formatting', () => {
    const breakdown: TokenBreakdown = { input: 1500, output: 3000, cached: 500 };
    const total = calculateTotal(breakdown);
    const percentages = calculatePercentages(breakdown);

    expect(total).toBe(5000);
    expect(percentages).toEqual({ input: 30, output: 60, cached: 10 });
    expect(formatTokenWithPercent(breakdown.input, percentages.input)).toBe('1,500 (30%)');
    expect(formatTokenWithPercent(breakdown.output, percentages.output)).toBe('3,000 (60%)');
    expect(formatTokenWithPercent(breakdown.cached, percentages.cached)).toBe('500 (10%)');
  });
});
