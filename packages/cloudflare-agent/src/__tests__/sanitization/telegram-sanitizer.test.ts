import { describe, expect, it } from 'vitest';
import { sanitizeLLMResponseForTelegram } from '../../sanitization/telegram-sanitizer.js';

describe('Telegram Sanitization', () => {
  it('should strip HTML tags', () => {
    const input = 'Hello <b>world</b> <script>alert(1)</script>';
    // We expect <b> to be stripped then re-added if it was markdown, but here it's raw HTML.
    // The sanitizer strips ALL HTML tags first.
    expect(sanitizeLLMResponseForTelegram(input)).toBe('Hello world alert(1)');
  });

  it('should convert markdown bold to HTML', () => {
    expect(sanitizeLLMResponseForTelegram('**bold**')).toBe('<b>bold</b>');
    expect(sanitizeLLMResponseForTelegram('__bold__')).toBe('<b>bold</b>');
  });

  it('should convert markdown italic to HTML', () => {
    expect(sanitizeLLMResponseForTelegram('*italic*')).toBe('<i>italic</i>');
    expect(sanitizeLLMResponseForTelegram('_italic_')).toBe('<i>italic</i>');
  });

  it('should convert inline code', () => {
    expect(sanitizeLLMResponseForTelegram('`code`')).toBe('<code>code</code>');
  });

  it('should convert code blocks', () => {
    expect(sanitizeLLMResponseForTelegram('```\ncode block\n```')).toBe('<pre>code block</pre>');
  });

  it('should handle links', () => {
    expect(sanitizeLLMResponseForTelegram('[link](http://example.com)')).toBe(
      '<a href="http://example.com">link</a>'
    );
  });

  it('should handle unclosed tags gracefully', () => {
    // LLM might output <a href="..."> without closing
    // But wait, step 2b in implementation handles this.
    // However step 3 strips all tags.
    // So if the implementation extracts placeholders first, it should work.

    // Test the specific regex implementation in the file
    // <a href="url">text (without closing)
    const input = 'Check this <a href="http://example.com">link out';
    expect(sanitizeLLMResponseForTelegram(input)).toBe(
      'Check this <a href="http://example.com">link out</a>'
    );
    // Wait, the implementation logic:
    // 1. extracts [text](url) -> placeholder
    // 2. extracts <a href="url">text</a> -> placeholder
    // 2b. extracts <a href="url">text... -> placeholder
    // 3. strips tags
    // 6. restores placeholders

    // So <a href="url">text out should be captured by 2b.
  });

  it('should escape special characters', () => {
    expect(sanitizeLLMResponseForTelegram('1 < 2 & 3 > 4')).toBe('1 &lt; 2 &amp; 3 &gt; 4');
  });

  it('should protect code from formatting', () => {
    const input = '`**bold** inside code`';
    expect(sanitizeLLMResponseForTelegram(input)).toBe('<code>**bold** inside code</code>');
  });

  it('should protect code blocks from formatting', () => {
    const input = '```javascript\nconst a = "**not bold**";\n```';
    expect(sanitizeLLMResponseForTelegram(input)).toBe('<pre>const a = "**not bold**";</pre>');
  });
});
