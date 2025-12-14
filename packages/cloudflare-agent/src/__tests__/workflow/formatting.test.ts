// Import from @duyetbot/progress directly - tests should validate the real functions
import {
  formatCompactNumber,
  formatCost,
  formatDuration,
  formatToolArgs,
  formatToolResult,
  shortenModelName,
} from '@duyetbot/progress';
import { describe, expect, it } from 'vitest';

describe('Workflow Formatting', () => {
  describe('formatDuration', () => {
    it('should format ms', () => {
      expect(formatDuration(500)).toBe('500ms');
    });
    it('should format seconds', () => {
      expect(formatDuration(1500)).toBe('1.50s');
      expect(formatDuration(10000)).toBe('10.00s');
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

  describe('formatCost', () => {
    it('should format zero', () => {
      expect(formatCost(0)).toBe('$0');
    });
    it('should format tiny cost', () => {
      expect(formatCost(0.00005)).toBe('$0.0001');
    });
    it('should format small cost', () => {
      expect(formatCost(0.00123)).toBe('$0.0012');
    });
    it('should format larger cost', () => {
      expect(formatCost(0.12345)).toBe('$0.12');
    });
  });

  describe('shortenModelName', () => {
    it('should pass through unknown names', () => {
      expect(shortenModelName('@preset/duyetbot')).toBe('@preset/duyetbot');
    });
    it('should truncate long names at 20 chars', () => {
      expect(shortenModelName('openai/gpt-4o')).toBe('openai/gpt-4o');
    });
    it('should clean up claude names', () => {
      expect(shortenModelName('anthropic/claude-3-5-sonnet-20241022')).toBe('sonnet-3.5');
      expect(shortenModelName('anthropic/claude-3-opus-20240229')).toBe('opus-3');
    });
    it('should truncate very long names', () => {
      const longName = 'verylongmodelnamethatexceedstwentychars';
      const result = shortenModelName(longName);
      expect(result.length).toBe(20); // 17 chars + "..."
      expect(result).toBe('verylongmodelname...');
    });
  });

  describe('formatToolArgs', () => {
    it('should return empty string for no args', () => {
      expect(formatToolArgs({})).toBe('');
      expect(formatToolArgs(undefined)).toBe('');
    });
    it('should prioritize showing query key over other keys', () => {
      // New behavior: formatToolArgs shows only the priority key (query > url > prompt > etc.)
      const result = formatToolArgs({ query: 'search term', other: 'value' });
      expect(result).toBe('query: "search term"');
      // 'other' is not shown because 'query' takes priority
    });
    it('should format different types', () => {
      expect(formatToolArgs({ url: 'http://example.com' })).toBe('url: "http://example.com"');
      expect(formatToolArgs({ count: 5 })).toBe('count: 5');
      expect(formatToolArgs({ active: true })).toBe('active: true');
    });
    it('should format objects and arrays', () => {
      const result = formatToolArgs({ items: [1, 2, 3] });
      expect(result).toContain('[1,2,3]');
    });
  });

  describe('formatToolResult', () => {
    it('should truncate lines and add ellipsis', () => {
      const output = 'line1\nline2\nline3\nline4';
      const result = formatToolResult(output, 2);
      expect(result).toContain('line1');
      expect(result).toContain('line2');
      expect(result).toContain('...');
    });
    it('should truncate by length', () => {
      const longOutput = 'a'.repeat(200);
      const result = formatToolResult(longOutput, 10, 150);
      expect(result).toHaveLength(150); // 150 chars total (no additional "...")
      expect(result.endsWith('...')).toBe(true);
    });
  });
});
