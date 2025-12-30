import { describe, expect, test } from 'vitest';
import {
  formatResponseTime,
  getCardBorderClass,
  getServerStatusLabel,
  getStatusBadgeVariant,
  truncateUrl,
} from './mcp-card-utils';

describe('getCardBorderClass', () => {
  test('returns opacity class for disabled servers', () => {
    expect(getCardBorderClass('online', false)).toBe('opacity-60');
    expect(getCardBorderClass('offline', false)).toBe('opacity-60');
    expect(getCardBorderClass('disabled', false)).toBe('opacity-60');
  });

  test('returns success border for online enabled servers', () => {
    expect(getCardBorderClass('online', true)).toBe('border-success/30');
  });

  test('returns destructive border for offline enabled servers', () => {
    expect(getCardBorderClass('offline', true)).toBe('border-destructive/30');
  });

  test('returns empty string for other statuses', () => {
    expect(getCardBorderClass('disabled', true)).toBe('');
    expect(getCardBorderClass('checking', true)).toBe('');
  });
});

describe('getStatusBadgeVariant', () => {
  test('returns success for online status', () => {
    expect(getStatusBadgeVariant('online')).toBe('success');
  });

  test('returns destructive for offline status', () => {
    expect(getStatusBadgeVariant('offline')).toBe('destructive');
  });

  test('returns secondary for disabled status', () => {
    expect(getStatusBadgeVariant('disabled')).toBe('secondary');
  });

  test('returns secondary for unknown statuses', () => {
    expect(getStatusBadgeVariant('checking')).toBe('secondary');
    expect(getStatusBadgeVariant('unknown' as any)).toBe('secondary');
  });
});

describe('getServerStatusLabel', () => {
  test('returns correct labels for known statuses', () => {
    expect(getServerStatusLabel('online')).toBe('Online');
    expect(getServerStatusLabel('offline')).toBe('Offline');
    expect(getServerStatusLabel('disabled')).toBe('Disabled');
    expect(getServerStatusLabel('checking')).toBe('Checking...');
  });

  test('returns Unknown for unknown statuses', () => {
    expect(getServerStatusLabel('unknown' as any)).toBe('Unknown');
    expect(getServerStatusLabel('' as any)).toBe('Unknown');
  });
});

describe('formatResponseTime', () => {
  test('returns formatted milliseconds for positive values', () => {
    expect(formatResponseTime(1)).toBe('1ms');
    expect(formatResponseTime(100)).toBe('100ms');
    expect(formatResponseTime(9999)).toBe('9999ms');
  });

  test('returns N/A for undefined', () => {
    expect(formatResponseTime(undefined)).toBe('N/A');
  });

  test('returns N/A for null', () => {
    expect(formatResponseTime(null as any)).toBe('N/A');
  });

  test('returns N/A for zero (0 is falsy)', () => {
    // The implementation uses !ms which treats 0 as falsy
    expect(formatResponseTime(0)).toBe('N/A');
  });
});

describe('truncateUrl', () => {
  test('returns URL unchanged when under max length', () => {
    const shortUrl = 'https://example.com';
    expect(truncateUrl(shortUrl)).toBe(shortUrl);
  });

  test('returns URL unchanged when exactly at max length', () => {
    const url = 'https://example.com/path/to/resource';
    expect(truncateUrl(url, 50)).toBe(url); // Length < 50
  });

  test('truncates URL when over max length', () => {
    const longUrl = 'https://example.com/very/long/path/that/exceeds/maximum/length';
    const result = truncateUrl(longUrl, 30);
    // truncateAt = 30 - 3 = 27, so we get 27 chars + "..."
    expect(result).toBe('https://example.com/very/lo...');
    expect(result.length).toBe(30);
  });

  test('uses default max length of 50', () => {
    const longUrl = 'https://api.githubcopilot.com/mcp/sse/with/very/long/path';
    const result = truncateUrl(longUrl);
    expect(result).toHaveLength(50);
    expect(result.endsWith('...')).toBe(true);
  });

  test('preserves URL prefix when truncating', () => {
    const url = 'https://github.com/very-long-repository-name/path/to/endpoint';
    const result = truncateUrl(url, 40);
    expect(result).toMatch(/^https:\/\//);
    expect(result.endsWith('...')).toBe(true);
  });

  test('handles very short max length', () => {
    const url = 'https://example.com';
    const result = truncateUrl(url, 10);
    // truncateAt = 10 - 3 = 7, so we get "https:/..." (7 chars before "...")
    expect(result).toBe('https:/...');
    expect(result.length).toBe(10);
  });
});
