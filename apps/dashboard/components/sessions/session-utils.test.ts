import { describe, expect, test, vi } from 'vitest';
import { formatSessionNumber, formatSessionTimestamp } from './session-utils';

describe('formatSessionTimestamp', () => {
  test('returns Unknown for undefined timestamp', () => {
    expect(formatSessionTimestamp(undefined)).toBe('Unknown');
  });

  test('returns Unknown for invalid timestamp', () => {
    expect(formatSessionTimestamp(NaN)).toBe('Unknown');
    // Note: -1 is a valid timestamp (one ms before Unix epoch), so it returns a date
  });

  test('returns Just now for very recent timestamps', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    expect(formatSessionTimestamp(now)).toBe('Just now');
    expect(formatSessionTimestamp(now - 30 * 1000)).toBe('Just now'); // 30 seconds ago
  });

  test('returns Xm ago for minutes ago', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    expect(formatSessionTimestamp(now - 60 * 1000)).toBe('1m ago'); // 1 minute
    expect(formatSessionTimestamp(now - 5 * 60 * 1000)).toBe('5m ago'); // 5 minutes
    expect(formatSessionTimestamp(now - 30 * 60 * 1000)).toBe('30m ago'); // 30 minutes
    expect(formatSessionTimestamp(now - 59 * 60 * 1000)).toBe('59m ago'); // 59 minutes
  });

  test('returns Xh ago for hours ago', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    expect(formatSessionTimestamp(now - 60 * 60 * 1000)).toBe('1h ago'); // 1 hour
    expect(formatSessionTimestamp(now - 5 * 60 * 60 * 1000)).toBe('5h ago'); // 5 hours
    expect(formatSessionTimestamp(now - 12 * 60 * 60 * 1000)).toBe('12h ago'); // 12 hours
    expect(formatSessionTimestamp(now - 23 * 60 * 60 * 1000)).toBe('23h ago'); // 23 hours
  });

  test('returns Xd ago for days ago (less than 7)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    expect(formatSessionTimestamp(now - 24 * 60 * 60 * 1000)).toBe('1d ago'); // 1 day
    expect(formatSessionTimestamp(now - 3 * 24 * 60 * 60 * 1000)).toBe('3d ago'); // 3 days
    expect(formatSessionTimestamp(now - 6 * 24 * 60 * 60 * 1000)).toBe('6d ago'); // 6 days
  });

  test('returns absolute date for 7+ days ago', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const result = formatSessionTimestamp(weekAgo);
    // Should be a date string, not a relative time
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });

  test('returns absolute date for very old timestamps', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const result = formatSessionTimestamp(monthAgo);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });

  test('handles exact minute boundary (59s vs 60s)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 59 seconds should be "Just now"
    expect(formatSessionTimestamp(now - 59 * 1000)).toBe('Just now');
    // 60 seconds (1 minute) should be "1m ago"
    expect(formatSessionTimestamp(now - 60 * 1000)).toBe('1m ago');
  });

  test('handles exact hour boundary (59m vs 60m)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 59 minutes should be "59m ago"
    expect(formatSessionTimestamp(now - 59 * 60 * 1000)).toBe('59m ago');
    // 60 minutes (1 hour) should be "1h ago"
    expect(formatSessionTimestamp(now - 60 * 60 * 1000)).toBe('1h ago');
  });

  test('handles exact day boundary (23h vs 24h)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 23 hours should be "23h ago"
    expect(formatSessionTimestamp(now - 23 * 60 * 60 * 1000)).toBe('23h ago');
    // 24 hours (1 day) should be "1d ago"
    expect(formatSessionTimestamp(now - 24 * 60 * 60 * 1000)).toBe('1d ago');
  });

  test('handles exact week boundary (6d vs 7d)', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 6 days should be "6d ago"
    expect(formatSessionTimestamp(now - 6 * 24 * 60 * 60 * 1000)).toBe('6d ago');
    // 7 days should be an absolute date
    const result = formatSessionTimestamp(now - 7 * 24 * 60 * 60 * 1000);
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });
});

describe('formatSessionNumber', () => {
  test('returns string representation for small numbers', () => {
    expect(formatSessionNumber(0)).toBe('0');
    expect(formatSessionNumber(1)).toBe('1');
    expect(formatSessionNumber(42)).toBe('42');
    expect(formatSessionNumber(999)).toBe('999');
  });

  test('returns XK format for thousands', () => {
    expect(formatSessionNumber(1000)).toBe('1.0K');
    expect(formatSessionNumber(1500)).toBe('1.5K');
    expect(formatSessionNumber(10000)).toBe('10.0K');
    expect(formatSessionNumber(999999)).toBe('1000.0K'); // Just under 1M
  });

  test('returns XM format for millions', () => {
    expect(formatSessionNumber(1000000)).toBe('1.0M');
    expect(formatSessionNumber(1500000)).toBe('1.5M');
    expect(formatSessionNumber(10000000)).toBe('10.0M');
    expect(formatSessionNumber(123456789)).toBe('123.5M');
  });

  test('handles very large numbers', () => {
    expect(formatSessionNumber(1000000000)).toBe('1000.0M'); // 1 billion
    expect(formatSessionNumber(999999999999)).toBe('1000000.0M'); // Nearly 1 trillion
  });

  test('handles decimal precision correctly', () => {
    expect(formatSessionNumber(1234)).toBe('1.2K'); // Rounds to 1.2K
    expect(formatSessionNumber(1550)).toBe('1.6K'); // Rounds to 1.6K
    expect(formatSessionNumber(1234567)).toBe('1.2M'); // Rounds to 1.2M
  });

  test('handles boundary at 1000', () => {
    expect(formatSessionNumber(999)).toBe('999');
    expect(formatSessionNumber(1000)).toBe('1.0K');
  });

  test('handles boundary at 1 million', () => {
    expect(formatSessionNumber(999999)).toBe('1000.0K');
    expect(formatSessionNumber(1000000)).toBe('1.0M');
  });
});
