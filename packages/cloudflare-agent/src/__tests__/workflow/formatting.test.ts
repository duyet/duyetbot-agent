import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatCostUsd,
  formatDuration,
  formatToolArgs,
  formatToolResponse,
  shortenModelName,
} from '../../workflow/formatting.js';

describe('Workflow Formatting', () => {
  describe('formatDuration', () => {
    it('should format ms', () => {
      expect(formatDuration(500)).toBe('500ms');
    });
    it('should format seconds', () => {
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(10000)).toBe('10.0s');
    });
    it('should format minutes', () => {
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });
  });

  describe('formatCompactNumber', () => {
    it('should format small numbers', () => {
      expect(formatCompactNumber(500)).toBe('500');
    });
    it('should format k', () => {
      expect(formatCompactNumber(1200)).toBe('1.2k');
      expect(formatCompactNumber(15000)).toBe('15k');
    });
  });

  describe('formatCostUsd', () => {
    it('should format zero', () => {
      expect(formatCostUsd(0)).toBe('$0');
    });
    it('should format tiny cost', () => {
      expect(formatCostUsd(0.00005)).toBe('<$0.0001');
    });
    it('should format small cost', () => {
      expect(formatCostUsd(0.00123)).toBe('$0.0012');
    });
    it('should format larger cost', () => {
      expect(formatCostUsd(0.12345)).toBe('$0.123');
    });
  });

  describe('shortenModelName', () => {
    it('should remove @preset/', () => {
      expect(shortenModelName('@preset/duyetbot')).toBe('duyetbot');
    });
    it('should remove provider prefix', () => {
      expect(shortenModelName('openai/gpt-4o')).toBe('gpt-4o');
    });
    it('should clean up claude names', () => {
      expect(shortenModelName('anthropic/claude-3-5-sonnet-20241022')).toBe('sonnet-3.5');
      expect(shortenModelName('anthropic/claude-3-opus-20240229')).toBe('opus');
    });
  });

  describe('formatToolArgs', () => {
    it('should return empty string for no args', () => {
      expect(formatToolArgs({})).toBe('');
      expect(formatToolArgs(undefined)).toBe('');
    });
    it('should prioritize keys', () => {
      expect(formatToolArgs({ query: 'search term', other: 'ignored' })).toBe(
        'query: "search term"'
      );
      expect(formatToolArgs({ url: 'http://example.com' })).toBe('url: "http://example.com"');
    });
    it('should fallback to first key', () => {
      expect(formatToolArgs({ something: 'value' })).toBe('something: "value"');
    });
    it('should truncate long values', () => {
      const longValue = 'a'.repeat(50);
      expect(formatToolArgs({ key: longValue })).toContain('...');
    });
  });

  describe('formatToolResponse', () => {
    it('should truncate lines', () => {
      const output = 'line1\nline2\nline3\nline4';
      expect(formatToolResponse(output, 2)).toBe('line1 | line2...');
    });
    it('should truncate length', () => {
      const longOutput = 'a'.repeat(200);
      expect(formatToolResponse(longOutput, 10)).toHaveLength(153); // 150 + ...
    });
  });
});
