import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  formatDuration,
  formatEventTimestamp,
  getStatusLabel,
  getStatusVariant,
} from './event-utils';

describe('formatEventTimestamp', () => {
  beforeEach(() => {
    // Mock the current time using vitest's fake timers
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  test('returns "Unknown" for undefined timestamp', () => {
    expect(formatEventTimestamp(undefined)).toBe('Unknown');
  });

  test('returns "Unknown" for zero timestamp', () => {
    expect(formatEventTimestamp(0)).toBe('Unknown');
  });

  test('returns "Just now" for very recent timestamps', () => {
    const now = Date.now();
    expect(formatEventTimestamp(now - 500)).toBe('Just now');
    expect(formatEventTimestamp(now - 30000)).toBe('Just now');
  });

  test('returns minutes ago for recent timestamps', () => {
    const now = Date.now();
    expect(formatEventTimestamp(now - 60000)).toBe('1m ago');
    expect(formatEventTimestamp(now - 5 * 60000)).toBe('5m ago');
    expect(formatEventTimestamp(now - 30 * 60000)).toBe('30m ago');
  });

  test('returns hours ago for same-day timestamps', () => {
    const now = Date.now();
    expect(formatEventTimestamp(now - 3600000)).toBe('1h ago');
    expect(formatEventTimestamp(now - 3 * 3600000)).toBe('3h ago');
    expect(formatEventTimestamp(now - 12 * 3600000)).toBe('12h ago');
  });

  test('returns days ago for older timestamps', () => {
    const now = Date.now();
    expect(formatEventTimestamp(now - 86400000)).toBe('1d ago');
    expect(formatEventTimestamp(now - 3 * 86400000)).toBe('3d ago');
    expect(formatEventTimestamp(now - 7 * 86400000)).toBe('7d ago');
  });
});

describe('formatDuration', () => {
  test('formats milliseconds for durations under 1 second', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(100)).toBe('100ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  test('formats seconds with 1 decimal place for durations under 1 minute', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(1500)).toBe('1.5s');
    expect(formatDuration(5000)).toBe('5.0s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  test('formats minutes and seconds for durations over 1 minute', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
    expect(formatDuration(3599000)).toBe('59m 59s');
  });

  test('handles edge cases', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(60000)).toBe('1m 0s');
  });
});

describe('getStatusVariant', () => {
  test('returns "success" for success status', () => {
    expect(getStatusVariant('success')).toBe('success');
  });

  test('returns "warning" for running and pending statuses', () => {
    expect(getStatusVariant('running')).toBe('warning');
    expect(getStatusVariant('pending')).toBe('warning');
  });

  test('returns "destructive" for error status', () => {
    expect(getStatusVariant('error')).toBe('destructive');
  });

  test('returns "secondary" for unknown statuses', () => {
    expect(getStatusVariant('cancelled')).toBe('secondary');
    expect(getStatusVariant('unknown')).toBe('secondary');
    expect(getStatusVariant('random')).toBe('secondary');
  });
});

describe('getStatusLabel', () => {
  test('returns "Completed" for success status', () => {
    expect(getStatusLabel('success')).toBe('Completed');
  });

  test('returns "Running" for running status', () => {
    expect(getStatusLabel('running')).toBe('Running');
  });

  test('returns "Pending" for pending status', () => {
    expect(getStatusLabel('pending')).toBe('Pending');
  });

  test('returns "Error" for error status', () => {
    expect(getStatusLabel('error')).toBe('Error');
  });

  test('returns "Cancelled" for cancelled status', () => {
    expect(getStatusLabel('cancelled')).toBe('Cancelled');
  });

  test('returns original status for unknown statuses', () => {
    expect(getStatusLabel('unknown')).toBe('unknown');
    expect(getStatusLabel('random')).toBe('random');
    expect(getStatusLabel('custom')).toBe('custom');
  });
});
