import { describe, expect, test } from 'vitest';

describe('formatNumber utility', () => {
  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  test('formats small numbers (< 1000)', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(5)).toBe('5');
    expect(formatNumber(999)).toBe('999');
  });

  test('formats thousands', () => {
    expect(formatNumber(1000)).toBe('1.0K');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(999999)).toBe('1000.0K');
  });

  test('formats millions', () => {
    expect(formatNumber(1000000)).toBe('1.0M');
    expect(formatNumber(2500000)).toBe('2.5M');
    expect(formatNumber(999999999)).toBe('1000.0M');
  });
});

describe('formatTimestamp utility', () => {
  const mockNow = 1704067200000; // 2024-01-01 00:00:00 UTC

  function formatTimestamp(ts: number | null | undefined): string {
    if (ts == null) {
      return 'Unknown';
    }
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown';
    }
    const now = new Date(mockNow);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  test('returns Unknown for null/undefined', () => {
    expect(formatTimestamp(null)).toBe('Unknown');
    expect(formatTimestamp(undefined)).toBe('Unknown');
  });

  test('returns "Just now" for very recent timestamps', () => {
    const oneSecondAgo = mockNow - 1000;
    expect(formatTimestamp(oneSecondAgo)).toBe('Just now');
  });

  test('returns minutes ago for recent timestamps', () => {
    const fiveMinutesAgo = mockNow - 5 * 60 * 1000;
    expect(formatTimestamp(fiveMinutesAgo)).toBe('5m ago');

    const thirtyMinutesAgo = mockNow - 30 * 60 * 1000;
    expect(formatTimestamp(thirtyMinutesAgo)).toBe('30m ago');
  });

  test('returns hours ago for same-day timestamps', () => {
    const twoHoursAgo = mockNow - 2 * 60 * 60 * 1000;
    expect(formatTimestamp(twoHoursAgo)).toBe('2h ago');

    const twelveHoursAgo = mockNow - 12 * 60 * 60 * 1000;
    expect(formatTimestamp(twelveHoursAgo)).toBe('12h ago');
  });

  test('returns days ago for recent week', () => {
    const twoDaysAgo = mockNow - 2 * 24 * 60 * 60 * 1000;
    expect(formatTimestamp(twoDaysAgo)).toBe('2d ago');

    const sixDaysAgo = mockNow - 6 * 24 * 60 * 60 * 1000;
    expect(formatTimestamp(sixDaysAgo)).toBe('6d ago');
  });

  test('returns formatted date for older timestamps', () => {
    const twoWeeksAgo = mockNow - 14 * 24 * 60 * 60 * 1000;
    const result = formatTimestamp(twoWeeksAgo);
    expect(result).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/);
  });
});
