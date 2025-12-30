import { describe, expect, test } from 'vitest';
import { formatCompactNumber, getGridClass, getTrendDirection } from './dashboard-utils';

describe('getGridClass', () => {
  test('returns correct grid class for 1 column', () => {
    expect(getGridClass(1)).toBe('grid-cols-1');
  });

  test('returns correct grid class for 2 columns', () => {
    expect(getGridClass(2)).toBe('grid-cols-2');
  });

  test('returns correct grid class for 3 columns', () => {
    expect(getGridClass(3)).toBe('grid-cols-3');
  });

  test('returns correct grid class for 4 columns', () => {
    expect(getGridClass(4)).toBe('grid-cols-4');
  });

  test('clamps values greater than 4 to 4 columns', () => {
    expect(getGridClass(5)).toBe('grid-cols-4');
    expect(getGridClass(10)).toBe('grid-cols-4');
    expect(getGridClass(100)).toBe('grid-cols-4');
  });

  test('defaults to grid-cols-3 for zero or negative values', () => {
    expect(getGridClass(0)).toBe('grid-cols-3');
    expect(getGridClass(-1)).toBe('grid-cols-3');
    expect(getGridClass(-10)).toBe('grid-cols-3');
  });

  test('handles non-integer values by flooring after clamping', () => {
    expect(getGridClass(2.5)).toBe('grid-cols-2');
    expect(getGridClass(3.9)).toBe('grid-cols-3');
  });
});

describe('getTrendDirection', () => {
  test('returns "up" for positive changes', () => {
    expect(getTrendDirection(1)).toBe('up');
    expect(getTrendDirection(100)).toBe('up');
    expect(getTrendDirection(0.1)).toBe('up');
  });

  test('returns "down" for negative changes', () => {
    expect(getTrendDirection(-1)).toBe('down');
    expect(getTrendDirection(-100)).toBe('down');
    expect(getTrendDirection(-0.1)).toBe('down');
  });

  test('returns "neutral" for zero change', () => {
    expect(getTrendDirection(0)).toBe('neutral');
  });
});

describe('formatCompactNumber', () => {
  test('returns string representation for small numbers', () => {
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(5)).toBe('5');
    expect(formatCompactNumber(999)).toBe('999');
  });

  test('formats thousands with K suffix', () => {
    expect(formatCompactNumber(1000)).toBe('1.0K');
    expect(formatCompactNumber(1500)).toBe('1.5K');
    expect(formatCompactNumber(9999)).toBe('10.0K');
    expect(formatCompactNumber(999999)).toBe('1000.0K');
  });

  test('formats millions with M suffix', () => {
    expect(formatCompactNumber(1000000)).toBe('1.0M');
    expect(formatCompactNumber(2500000)).toBe('2.5M');
    expect(formatCompactNumber(99999999)).toBe('100.0M');
  });

  test('handles negative numbers', () => {
    expect(formatCompactNumber(-1000)).toBe('-1.0K');
    expect(formatCompactNumber(-1500)).toBe('-1.5K');
    expect(formatCompactNumber(-1000000)).toBe('-1.0M');
  });

  test('handles decimal values', () => {
    expect(formatCompactNumber(1234)).toBe('1.2K'); // 1.234 rounds to 1.2
    expect(formatCompactNumber(1567)).toBe('1.6K'); // 1.567 rounds to 1.6
  });
});
