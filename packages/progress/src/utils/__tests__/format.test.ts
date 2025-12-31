import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatCost,
  formatDuration,
  formatToolArgs,
  formatToolArgsVerbose,
  formatToolResult,
  truncate,
} from '../format';

describe('formatDuration', () => {
  it('should format milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('should format seconds', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(1234)).toBe('1.23s');
    expect(formatDuration(5678)).toBe('5.68s');
    expect(formatDuration(12345)).toBe('12.35s');
    expect(formatDuration(59999)).toBe('60.00s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(63456)).toBe('1m 3s');
    expect(formatDuration(123456)).toBe('2m 3s');
    expect(formatDuration(300000)).toBe('5m 0s');
    expect(formatDuration(599999)).toBe('9m 60s');
  });

  it('should handle edge cases', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999.5)).toBe('1000ms');
  });
});

describe('formatCompactNumber', () => {
  describe('below 1k', () => {
    it('should display numbers as-is', () => {
      expect(formatCompactNumber(0)).toBe('0');
      expect(formatCompactNumber(1)).toBe('1');
      expect(formatCompactNumber(500)).toBe('500');
      expect(formatCompactNumber(999)).toBe('999');
    });
  });

  describe('1k to 1m', () => {
    it('should format with k suffix', () => {
      expect(formatCompactNumber(1000)).toBe('1k');
      expect(formatCompactNumber(1234)).toBe('1.2k');
      expect(formatCompactNumber(1500)).toBe('1.5k');
      expect(formatCompactNumber(5000)).toBe('5k');
      expect(formatCompactNumber(12345)).toBe('12.3k');
      expect(formatCompactNumber(123456)).toBe('123.5k');
      expect(formatCompactNumber(999999)).toBe('1000.0k');
    });

    it('should not show decimal for whole numbers', () => {
      expect(formatCompactNumber(1000)).toBe('1k');
      expect(formatCompactNumber(5000)).toBe('5k');
      expect(formatCompactNumber(10000)).toBe('10k');
    });

    it('should show one decimal for non-whole numbers', () => {
      expect(formatCompactNumber(1234)).toBe('1.2k');
      expect(formatCompactNumber(1567)).toBe('1.6k');
      expect(formatCompactNumber(10500)).toBe('10.5k');
    });
  });

  describe('1m to 1b', () => {
    it('should format with m suffix', () => {
      expect(formatCompactNumber(1000000)).toBe('1m');
      expect(formatCompactNumber(1234567)).toBe('1.2m');
      expect(formatCompactNumber(12345678)).toBe('12.3m');
      expect(formatCompactNumber(123456789)).toBe('123.5m');
      expect(formatCompactNumber(999999999)).toBe('1000.0m');
    });
  });

  describe('1b and above', () => {
    it('should format with b suffix', () => {
      expect(formatCompactNumber(1000000000)).toBe('1b');
      expect(formatCompactNumber(1234567890)).toBe('1.2b');
      expect(formatCompactNumber(12345678900)).toBe('12.3b');
    });
  });
});

describe('formatCost', () => {
  it('should format small amounts with up to 4 decimals', () => {
    expect(formatCost(0.0001)).toBe('$0.0001');
    expect(formatCost(0.001)).toBe('$0.001');
    expect(formatCost(0.0023)).toBe('$0.0023');
    expect(formatCost(0.009)).toBe('$0.009');
  });

  it('should format amounts >= 0.01 with 2 decimals', () => {
    expect(formatCost(0.01)).toBe('$0.01');
    expect(formatCost(0.1)).toBe('$0.10');
    expect(formatCost(1.5)).toBe('$1.50');
    expect(formatCost(10.567)).toBe('$10.57');
    expect(formatCost(100)).toBe('$100.00');
  });

  it('should handle zero and rounding', () => {
    expect(formatCost(0)).toBe('$0');
    expect(formatCost(0.005)).toBe('$0.005');
    expect(formatCost(0.004)).toBe('$0.004');
  });

  it('should handle trailing zeros correctly', () => {
    expect(formatCost(0.001)).toBe('$0.001');
    expect(formatCost(0.001)).toBe('$0.001');
    expect(formatCost(0.01)).toBe('$0.01');
  });
});

describe('truncate', () => {
  it('should not truncate if text is shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('hi', 5)).toBe('hi');
    expect(truncate('', 5)).toBe('');
  });

  it('should not truncate if text equals maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello');
    expect(truncate('world', 5)).toBe('world');
  });

  it('should truncate with ellipsis when text exceeds maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...');
    expect(truncate('hello world', 10)).toBe('hello w...');
    expect(truncate('hello world', 11)).toBe('hello world');
  });

  it('should handle edge cases', () => {
    expect(truncate('abcdefghij', 3)).toBe('...');
    expect(truncate('a', 3)).toBe('a');
    expect(truncate('ab', 3)).toBe('ab');
    expect(truncate('abc', 3)).toBe('abc');
    expect(truncate('abcd', 3)).toBe('...');
  });

  it('should handle maxLength smaller than ellipsis', () => {
    // When maxLength < 3, we should still add ellipsis but may result in empty or minimal text
    expect(truncate('hello', 2)).toBe('...');
    expect(truncate('hello', 1)).toBe('...');
    expect(truncate('hello', 0)).toBe('...');
  });
});

describe('formatToolArgs', () => {
  it('should handle empty or undefined args', () => {
    expect(formatToolArgs()).toBe('');
    expect(formatToolArgs({})).toBe('');
  });

  it('should format string values with quotes', () => {
    expect(formatToolArgs({ key: 'value' })).toBe('key: "value"');
  });

  it('should format number and boolean values without quotes', () => {
    expect(formatToolArgs({ count: 5 })).toBe('count: 5');
    expect(formatToolArgs({ active: true })).toBe('active: true');
    expect(formatToolArgs({ active: false })).toBe('active: false');
    expect(formatToolArgs({ ratio: 3.14 })).toBe('ratio: 3.14');
  });

  it('should format null values', () => {
    expect(formatToolArgs({ value: null })).toBe('value: null');
  });

  it('should format objects and arrays as JSON', () => {
    expect(formatToolArgs({ nested: { a: 1 } })).toBe('nested: {"a":1}');
    expect(formatToolArgs({ items: [1, 2, 3] })).toBe('items: [1,2,3]');
  });

  it('should prioritize search-related keys', () => {
    expect(formatToolArgs({ query: 'test', limit: 5 })).toBe('query: "test"');
    expect(formatToolArgs({ search: 'keyword', count: 10 })).toBe('search: "keyword"');
    expect(formatToolArgs({ q: 'find', page: 2 })).toBe('q: "find"');
  });

  it('should prioritize url-related keys', () => {
    expect(formatToolArgs({ url: 'https://example.com', method: 'GET' })).toBe(
      'url: "https://example.com"'
    );
    expect(formatToolArgs({ link: 'test.com', timeout: 30 })).toBe('link: "test.com"');
  });

  it('should prioritize prompt-related keys', () => {
    expect(formatToolArgs({ prompt: 'question', model: 'gpt-4' })).toBe('prompt: "question"');
    expect(formatToolArgs({ question: 'why?', context: 'test' })).toBe('question: "why?"');
    expect(formatToolArgs({ input: 'data', format: 'json' })).toBe('input: "data"');
  });

  it('should prioritize content-related keys', () => {
    expect(formatToolArgs({ text: 'hello', lang: 'en' })).toBe('text: "hello"');
    expect(formatToolArgs({ content: 'body', type: 'html' })).toBe('content: "body"');
    expect(formatToolArgs({ message: 'info', level: 'debug' })).toBe('message: "info"');
  });

  it('should prioritize path-related keys', () => {
    expect(formatToolArgs({ path: '/tmp/file', mode: 'read' })).toBe('path: "/tmp/file"');
    expect(formatToolArgs({ file: 'test.txt', encoding: 'utf8' })).toBe('file: "test.txt"');
    expect(formatToolArgs({ filename: 'data.json', size: 1024 })).toBe('filename: "data.json"');
  });

  it('should fallback to first key if no priority matches', () => {
    expect(formatToolArgs({ count: 5, name: 'test' })).toBe('count: 5');
    expect(formatToolArgs({ active: true, id: 123 })).toBe('active: true');
  });

  it('should truncate long string values', () => {
    const longString = 'a'.repeat(100);
    const result = formatToolArgs({ query: longString });
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longString.length + 20);
  });

  it('should respect custom maxLength parameter', () => {
    const result = formatToolArgs({ query: 'this is a long query text' }, 15);
    // maxLength 15 means we truncate at 12 chars (15 - 3 for "...")
    // "this is a long query text" -> "this is a lo..."
    expect(result).toBe('query: "this is a lo..."');
  });
});

describe('formatToolArgsVerbose', () => {
  it('should handle empty or undefined args', () => {
    expect(formatToolArgsVerbose()).toBe('');
    expect(formatToolArgsVerbose({})).toBe('');
  });

  it('should format all arguments with comma separation', () => {
    expect(formatToolArgsVerbose({ key: 'value' })).toBe('key: "value"');
    expect(formatToolArgsVerbose({ name: 'test', path: '/tmp' })).toBe(
      'name: "test", path: "/tmp"'
    );
  });

  it('should format multiple mixed types', () => {
    const result = formatToolArgsVerbose({
      count: 5,
      name: 'test',
      active: true,
    });
    expect(result).toContain('count: 5');
    expect(result).toContain('name: "test"');
    expect(result).toContain('active: true');
  });

  it('should preserve order of arguments', () => {
    const args: Record<string, unknown> = {};
    args.first = 1;
    args.second = 'two';
    args.third = true;

    const result = formatToolArgsVerbose(args);
    const firstIndex = result.indexOf('first');
    const secondIndex = result.indexOf('second');
    const thirdIndex = result.indexOf('third');

    expect(firstIndex < secondIndex).toBe(true);
    expect(secondIndex < thirdIndex).toBe(true);
  });

  it('should truncate very long values', () => {
    const longString = 'a'.repeat(150);
    const result = formatToolArgsVerbose({ query: longString });
    expect(result).toContain('...');
    expect(result.length).toBeLessThan(longString.length + 20);
  });
});

describe('formatToolResult', () => {
  it('should return result as-is if short', () => {
    expect(formatToolResult('success')).toBe('success');
    expect(formatToolResult('OK')).toBe('OK');
  });

  it('should truncate by line count', () => {
    const result = 'line1\nline2\nline3\nline4';
    expect(formatToolResult(result, 2)).toBe('line1\nline2...');
  });

  it('should truncate by character length', () => {
    const result = 'a'.repeat(250);
    const formatted = formatToolResult(result, 10, 50);
    expect(formatted).toContain('...');
    expect(formatted.length).toBeLessThanOrEqual(53); // 50 chars + "..."
  });

  it('should handle both line and character truncation', () => {
    const result = 'line1\nline2\nline3\nline4\nline5';
    const formatted = formatToolResult(result, 2);
    expect(formatted).toContain('line1');
    expect(formatted).toContain('line2');
    expect(formatted).not.toContain('line3');
    expect(formatted).toContain('...');
  });

  it('should not duplicate ellipsis', () => {
    const result = 'line1\nline2\nline3';
    const formatted = formatToolResult(result, 2);
    const ellipsisCount = (formatted.match(/\.\.\./g) || []).length;
    expect(ellipsisCount).toBe(1);
  });

  it('should use custom maxLines parameter', () => {
    const result = 'line1\nline2\nline3\nline4\nline5';
    expect(formatToolResult(result, 1)).toContain('line1');
    expect(formatToolResult(result, 1)).not.toContain('line2');
    expect(formatToolResult(result, 5)).not.toContain('...');
  });

  it('should use custom maxLength parameter', () => {
    const result = 'short';
    const formatted = formatToolResult(result, 3, 3);
    expect(formatted).toBe('...');
  });

  it('should handle multi-line output with long lines', () => {
    const result = `${'a'.repeat(100)}\n${'b'.repeat(100)}`;
    const formatted = formatToolResult(result, 10, 50);
    expect(formatted.length).toBeLessThanOrEqual(53);
  });

  it('should handle empty result', () => {
    expect(formatToolResult('')).toBe('');
  });

  it('should handle result with only newlines', () => {
    const result = '\n\n\n';
    const formatted = formatToolResult(result, 2);
    expect(formatted).toBeDefined();
  });
});
