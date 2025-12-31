import { describe, expect, test } from 'vitest';
import {
  chartColorArray,
  chartColors,
  createGradient,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercentage,
  getChartColor,
} from './chart-theme';

describe('getChartColor', () => {
  test('returns colors in order for valid indices', () => {
    expect(getChartColor(0)).toBe(chartColorArray[0]);
    expect(getChartColor(1)).toBe(chartColorArray[1]);
    expect(getChartColor(2)).toBe(chartColorArray[2]);
  });

  test('wraps around when index exceeds array length', () => {
    expect(getChartColor(10)).toBe(chartColorArray[0]);
    expect(getChartColor(11)).toBe(chartColorArray[1]);
    expect(getChartColor(20)).toBe(chartColorArray[0]);
  });

  test('returns same color for multiples of array length', () => {
    const length = chartColorArray.length;
    expect(getChartColor(0)).toBe(getChartColor(length));
    expect(getChartColor(0)).toBe(getChartColor(length * 2));
  });
});

describe('formatNumber', () => {
  test('returns locale string for small numbers', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(5)).toBe('5');
    expect(formatNumber(999)).toBe('999');
  });

  test('formats thousands with K suffix', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  test('formats millions with M suffix', () => {
    expect(formatNumber(1_000_000)).toBe('1.0M');
    expect(formatNumber(2_500_000)).toBe('2.5M');
    expect(formatNumber(999_999_999)).toBe('1000.0M');
  });

  test('formats billions with B suffix', () => {
    expect(formatNumber(1_000_000_000)).toBe('1.0B');
    expect(formatNumber(2_500_000_000)).toBe('2.5B');
    expect(formatNumber(999_999_999_999)).toBe('1000.0B');
  });

  test('handles negative numbers', () => {
    // The implementation doesn't handle negative numbers specially
    // It just uses toLocaleString() which adds the negative sign
    expect(formatNumber(-1000)).toBe('-1,000');
    expect(formatNumber(-1_000_000)).toBe('-1,000,000');
  });

  test('handles decimal values', () => {
    expect(formatNumber(1234)).toBe('1.2K');
    expect(formatNumber(1567)).toBe('1.6K');
  });
});

describe('formatCurrency', () => {
  test('formats USD currency with default decimals', () => {
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  test('formats with custom decimals', () => {
    expect(formatCurrency(100, 0)).toBe('$100');
    expect(formatCurrency(100.123, 1)).toBe('$100.1');
    expect(formatCurrency(100.456, 3)).toBe('$100.456');
  });

  test('handles negative values', () => {
    expect(formatCurrency(-100)).toBe('-$100.00');
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  test('formats large numbers with proper grouping', () => {
    expect(formatCurrency(1_000_000)).toBe('$1,000,000.00');
    expect(formatCurrency(1_234_567.89)).toBe('$1,234,567.89');
  });
});

describe('formatPercentage', () => {
  test('formats percentage with default decimals', () => {
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(50)).toBe('50.0%');
    expect(formatPercentage(100)).toBe('100.0%');
  });

  test('formats with custom decimals', () => {
    expect(formatPercentage(50.123, 0)).toBe('50%');
    expect(formatPercentage(50.123, 1)).toBe('50.1%');
    expect(formatPercentage(50.123, 2)).toBe('50.12%');
    expect(formatPercentage(50.123, 3)).toBe('50.123%');
  });

  test('handles negative percentages', () => {
    expect(formatPercentage(-25)).toBe('-25.0%');
    expect(formatPercentage(-25.567, 2)).toBe('-25.57%');
  });

  test('handles very small decimals', () => {
    expect(formatPercentage(0.001)).toBe('0.0%');
    expect(formatPercentage(0.099, 2)).toBe('0.10%');
  });
});

describe('formatDuration', () => {
  test('formats milliseconds for sub-second durations', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  test('formats seconds with decimal for sub-minute durations', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  test('formats minutes and seconds for sub-hour durations', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(3599000)).toBe('59m 59s');
  });

  test('formats hours and minutes for longer durations', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m');
    expect(formatDuration(3_660_000)).toBe('1h 1m');
    expect(formatDuration(7_260_000)).toBe('2h 1m');
  });

  test('handles edge cases', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(3_600_000)).toBe('1h 0m');
  });
});

describe('createGradient', () => {
  test('creates gradient definition with default opacity', () => {
    const gradient = createGradient('myGradient', '#FF0000');

    expect(gradient.id).toBe('myGradient');
    expect(gradient.stops).toHaveLength(2);
    expect(gradient.stops[0]).toEqual({ offset: '0%', color: '#FF0000', opacity: 0.3 });
    expect(gradient.stops[1]).toEqual({ offset: '100%', color: '#FF0000', opacity: 0 });
  });

  test('creates gradient definition with custom opacity', () => {
    const gradient = createGradient('myGradient', '#00FF00', 0.5);

    expect(gradient.id).toBe('myGradient');
    expect(gradient.stops[0]).toEqual({ offset: '0%', color: '#00FF00', opacity: 0.5 });
    expect(gradient.stops[1]).toEqual({ offset: '100%', color: '#00FF00', opacity: 0 });
  });

  test('handles opacity of 1 (fully opaque start)', () => {
    const gradient = createGradient('test', '#0000FF', 1);

    expect(gradient.stops[0]).toEqual({ offset: '0%', color: '#0000FF', opacity: 1 });
    expect(gradient.stops[1]).toEqual({ offset: '100%', color: '#0000FF', opacity: 0 });
  });

  test('handles opacity of 0 (fully transparent)', () => {
    const gradient = createGradient('test', '#FFFF00', 0);

    expect(gradient.stops[0]).toEqual({ offset: '0%', color: '#FFFF00', opacity: 0 });
    expect(gradient.stops[1]).toEqual({ offset: '100%', color: '#FFFF00', opacity: 0 });
  });
});

describe('chartColors', () => {
  test('has expected color values', () => {
    expect(chartColors.primary).toBe('#1D9BF0');
    expect(chartColors.success).toBe('#00BA7C');
    expect(chartColors.warning).toBe('#FFAD1F');
    expect(chartColors.error).toBe('#F4212E');
  });

  test('has neutral tones', () => {
    expect(chartColors.muted).toBe('#71767B');
    expect(chartColors.border).toBe('#2F3336');
    expect(chartColors.background).toBe('#000000');
  });
});

describe('chartColorArray', () => {
  test('has 10 colors in order', () => {
    expect(chartColorArray).toHaveLength(10);
    expect(chartColorArray[0]).toBe(chartColors.primary);
    expect(chartColorArray[1]).toBe(chartColors.success);
  });

  test('contains all palette colors', () => {
    expect(chartColorArray).toContain(chartColors.primary);
    expect(chartColorArray).toContain(chartColors.success);
    expect(chartColorArray).toContain(chartColors.purple);
    expect(chartColorArray).toContain(chartColors.warning);
    expect(chartColorArray).toContain(chartColors.error);
  });
});
