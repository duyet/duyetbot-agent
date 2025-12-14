import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  escapeMarkdownV2,
  escapePlain,
  getEscaper,
  smartEscapeMarkdownV2,
} from '../escape.js';

describe('escape', () => {
  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect(escapeHtml('Rock & Roll')).toBe('Rock &amp; Roll');
    });

    it('escapes less-than', () => {
      expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('escapes greater-than', () => {
      expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('escapes double quotes', () => {
      expect(escapeHtml('Say "hello"')).toBe('Say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect(escapeHtml("It's working")).toBe('It&#39;s working');
    });

    it('escapes multiple entities', () => {
      const input = '<script>alert("xss")</script>';
      const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;';
      expect(escapeHtml(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('handles plain text without special chars', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeMarkdownV2', () => {
    it('escapes underscores', () => {
      expect(escapeMarkdownV2('Hello_world')).toBe('Hello\\_world');
    });

    it('escapes asterisks', () => {
      expect(escapeMarkdownV2('2 * 3 = 6')).toBe('2 \\* 3 \\= 6');
    });

    it('escapes brackets', () => {
      expect(escapeMarkdownV2('[text]')).toBe('\\[text\\]');
    });

    it('escapes parentheses', () => {
      expect(escapeMarkdownV2('(example)')).toBe('\\(example\\)');
    });

    it('escapes dots', () => {
      expect(escapeMarkdownV2('Cost: $1.50')).toBe('Cost: $1\\.50');
    });

    it('escapes hyphens', () => {
      expect(escapeMarkdownV2('test-case')).toBe('test\\-case');
    });

    it('escapes pipes', () => {
      expect(escapeMarkdownV2('a | b')).toBe('a \\| b');
    });

    it('escapes exclamation marks', () => {
      expect(escapeMarkdownV2('Hello!')).toBe('Hello\\!');
    });

    it('escapes multiple special chars', () => {
      const input = '_*[]()~`>#+\\-=|{}.!';
      const expected = '\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\\\\\-\\=\\|\\{\\}\\.\\!';
      expect(escapeMarkdownV2(input)).toBe(expected);
    });

    it('handles empty string', () => {
      expect(escapeMarkdownV2('')).toBe('');
    });

    it('handles plain text without special chars', () => {
      expect(escapeMarkdownV2('Hello World')).toBe('Hello World');
    });

    it('handles text with dollar signs (not escaped)', () => {
      expect(escapeMarkdownV2('$100')).toBe('$100');
    });
  });

  describe('smartEscapeMarkdownV2', () => {
    it('preserves bold formatting with *bold*', () => {
      const input = 'This is *bold* text';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('*bold*');
    });

    it('preserves italic formatting with _italic_', () => {
      const input = 'This is _italic_ text';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('_italic_');
    });

    it('preserves inline code with `code`', () => {
      const input = 'Use `console.log()` here';
      const result = smartEscapeMarkdownV2(input);
      // Content inside backticks is preserved, parens inside code don't get escaped
      expect(result).toContain('`console.log()`');
    });

    it('preserves code blocks with ```...```', () => {
      const input = '```\nconst x = 1;\n```';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toMatch(/```.*```/s);
    });

    it('preserves markdown links [text](url)', () => {
      const input = '[Click here](https://example.com)';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toMatch(/\[.*\]\(.*\)/);
    });

    it('preserves formatted links *[text](url)*', () => {
      const input = '*[Bold Link](https://example.com)*';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toMatch(/\*\[.*\]\(.*\)\*/);
    });

    it('escapes unmatched special chars', () => {
      const input = 'Price: $10.99';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('\\.');
    });

    it('handles mixed formatting', () => {
      const input = 'See *bold* and _italic_ and `code` text';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('*bold*');
      expect(result).toContain('_italic_');
      expect(result).toContain('`code`');
    });

    it('escapes special chars outside formatting', () => {
      const input = 'Price: $10.99 (reduced!)';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('\\.');
      expect(result).toContain('\\(');
      expect(result).toContain('\\)');
      expect(result).toContain('\\!');
    });

    it('handles blockquote > at line start', () => {
      const input = '>Quote text\nNormal text';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toMatch(/^>Quote/);
    });

    it('escapes > not at line start', () => {
      const input = 'a > b';
      const result = smartEscapeMarkdownV2(input);
      expect(result).toContain('\\>');
    });
  });

  describe('escapePlain', () => {
    it('does not escape HTML entities', () => {
      expect(escapePlain('<script>alert("xss")</script>')).toBe('<script>alert("xss")</script>');
    });

    it('does not escape MarkdownV2 special chars', () => {
      expect(escapePlain('_*[]()~`>#+\\-=|{}.!')).toBe('_*[]()~`>#+\\-=|{}.!');
    });

    it('returns text as-is', () => {
      expect(escapePlain('Hello World!')).toBe('Hello World!');
    });

    it('handles empty string', () => {
      expect(escapePlain('')).toBe('');
    });
  });

  describe('getEscaper', () => {
    it('returns escapeHtml for html format', () => {
      const escaper = getEscaper('html');
      expect(escaper('<div>')).toBe('&lt;div&gt;');
    });

    it('returns escapeMarkdownV2 for markdownV2 format', () => {
      const escaper = getEscaper('markdownV2');
      expect(escaper('_test_')).toBe('\\_test\\_');
    });

    it('returns escapePlain for markdown format', () => {
      const escaper = getEscaper('markdown');
      expect(escaper('<div>')).toBe('<div>');
      expect(escaper('_test_')).toBe('_test_');
    });

    it('returns escapePlain for plain format', () => {
      const escaper = getEscaper('plain');
      expect(escaper('<div>')).toBe('<div>');
      expect(escaper('_test_')).toBe('_test_');
    });

    it('escaper functions work correctly', () => {
      const htmlEscaper = getEscaper('html');
      const mdV2Escaper = getEscaper('markdownV2');
      const plainEscaper = getEscaper('plain');

      const input = 'Test (example)';

      expect(htmlEscaper(input)).toBe('Test (example)');
      expect(mdV2Escaper(input)).toBe('Test \\(example\\)');
      expect(plainEscaper(input)).toBe('Test (example)');
    });
  });
});
