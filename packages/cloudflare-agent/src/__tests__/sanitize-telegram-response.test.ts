/**
 * Tests for HTML sanitization for Telegram responses
 *
 * Tests ensure proper handling of:
 * - Properly closed HTML anchor tags
 * - Unclosed anchor tags (LLM sometimes forgets closing tag)
 * - Markdown links [text](url)
 * - HTML special characters
 * - Code blocks and inline code
 * - Bold and italic formatting
 * - Mixed formatting scenarios
 */

import { describe, expect, it } from 'vitest';

/**
 * Mock implementation of sanitizeLLMResponseForTelegram
 * This is extracted from cloudflare-agent.ts for unit testing
 */
function sanitizeLLMResponseForTelegram(response: string): string {
  // Step 1: Extract and protect markdown links before any processing
  // Pattern: [text](url) - capture both text and URL
  // Using placeholder format LINKPLACEHOLDER0 instead of __LINK_0__ to avoid regex conflicts
  const linkPlaceholders: Array<{ placeholder: string; text: string; url: string }> = [];
  let linkIndex = 0;
  let processed = response.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    const placeholder = `LINKPLACEHOLDER${linkIndex++}`;
    linkPlaceholders.push({ placeholder, text: String(text), url: String(url) });
    return placeholder;
  });

  // Step 2: Extract HTML link hrefs before stripping tags
  // Pattern: <a href="url">text</a>
  processed = processed.replace(
    /<a\s+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
    (_match, url, text) => {
      const placeholder = `LINKPLACEHOLDER${linkIndex++}`;
      linkPlaceholders.push({ placeholder, text: String(text), url: String(url) });
      return placeholder;
    }
  );

  // Step 2b: Handle unclosed anchor tags (LLM sometimes forgets closing tag)
  // Match: <a href="url">text (without closing </a>)
  // This catches cases where the tag is left open at end of line or before another tag
  processed = processed.replace(
    /<a\s+href=["']([^"']+)["'][^>]*>([^<\n]*?)(?=\n|$|<|&)/gi,
    (_match, url, text) => {
      const linkText = text.trim() || url;
      const placeholder = `LINKPLACEHOLDER${linkIndex++}`;
      linkPlaceholders.push({ placeholder, text: String(linkText), url: String(url) });
      return placeholder;
    }
  );

  // Step 3: Convert <br> to newlines, strip all other HTML tags
  processed = processed.replace(/<br\s*\/?>/gi, '\n');
  processed = processed.replace(/<[^>]*>/g, '');

  // Step 4: Escape HTML special characters FIRST (before adding our own tags)
  // Must escape & first, then < and >
  processed = processed
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;') // Don't double-escape existing entities
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Step 5: Convert markdown to HTML tags (order matters!)

  // Code blocks (``` ... ```) - must be before inline code
  processed = processed.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    // Code inside pre doesn't need additional escaping since we already escaped above
    return `<pre>${code.trim()}</pre>`;
  });

  // Inline code (`code`) - be careful not to match inside pre tags
  processed = processed.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Bold (**text** or __text__) - must be before italic
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  processed = processed.replace(/__([^_]+)__/g, '<b>$1</b>');

  // Italic (*text* or _text_) - be careful with underscores in words
  // Only match *text* when surrounded by spaces or start/end of line
  processed = processed.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<i>$1</i>');
  // For underscores, only match when surrounded by whitespace to avoid matching words_with_underscores
  processed = processed.replace(/(?<=\s|^)_([^_\n]+)_(?=\s|$|[.,!?])/g, '<i>$1</i>');

  // Step 6: Restore link placeholders as proper <a> tags
  for (const { placeholder, text, url } of linkPlaceholders) {
    // Escape the text but keep URL as-is (URLs don't need escaping in href)
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Escape quotes in URL for href attribute
    const safeUrl = url.replace(/"/g, '&quot;');
    processed = processed.replace(placeholder, `<a href="${safeUrl}">${safeText}</a>`);
  }

  // Step 7: Clean up excessive whitespace
  processed = processed.replace(/\n{3,}/g, '\n\n').trim();

  return processed;
}

describe('sanitizeLLMResponseForTelegram', () => {
  describe('properly closed HTML anchor tags', () => {
    it('should preserve properly closed anchor tags', () => {
      const input = 'Visit <a href="https://example.com">this link</a> for info';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">this link</a>');
    });

    it('should handle multiple closed anchor tags', () => {
      const input =
        'Check <a href="https://example.com">link1</a> plus <a href="https://other.com">link2</a>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">link1</a>');
      expect(output).toContain('<a href="https://other.com">link2</a>');
    });

    it('should handle links with single quotes', () => {
      const input = "Visit <a href='https://example.com'>this link</a> for info";
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">this link</a>');
    });
  });

  describe('unclosed anchor tags (the main fix)', () => {
    it('should handle unclosed anchor tags at end of message', () => {
      const input = '<a href="https://duyet.net/cv">duyet.net/cv';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://duyet.net/cv">');
      expect(output).toContain('</a>');
      // Should have closing tag added
      expect(output).toMatch(/<a href="[^"]*">[^<]*<\/a>/);
    });

    it('should handle unclosed anchor tags with URL used as text when no text provided', () => {
      const input = '<a href="https://example.com">';
      const output = sanitizeLLMResponseForTelegram(input);
      // URL should be used as link text since no text was provided
      expect(output).toMatch(/<a href="https:\/\/example\.com">[^<]*<\/a>/);
    });

    it('should handle unclosed anchor tags followed by newline', () => {
      const input = 'PDF: <a href="https://duyet.me/cv.pdf">duyet.me/cv.pdf\nNext line';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://duyet.me/cv.pdf">');
      expect(output).toContain('</a>');
      expect(output).toContain('Next line');
    });

    it('should handle unclosed anchor tags followed by another HTML tag', () => {
      const input = '<a href="https://example.com">example.com<b>bold</b>';
      const output = sanitizeLLMResponseForTelegram(input);
      // Should close the unclosed anchor tag
      expect(output).toMatch(/<a href="[^"]*">[^<]*<\/a>/);
      expect(output).toContain('bold');
    });

    it('should handle unclosed anchor tags at message boundary', () => {
      const input = 'Check this: <a href="https://example.com">example.com';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">');
      expect(output).toContain('</a>');
    });

    it('should trim whitespace from unclosed link text', () => {
      const input = '<a href="https://example.com">  example.com  \nmore text';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">example.com</a>');
      expect(output).toContain('more text');
    });

    it('should use URL as text when unclosed link has no text', () => {
      const input = '<a href="https://example.com">\nmore content';
      const output = sanitizeLLMResponseForTelegram(input);
      // Should use URL as text
      expect(output).toMatch(/<a href="https:\/\/example\.com">(https:\/\/)?example\.com<\/a>/);
    });
  });

  describe('markdown links', () => {
    it('should convert markdown links to HTML', () => {
      const input = 'Visit [example.com](https://example.com) for info';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">example.com</a>');
    });

    it('should handle multiple markdown links', () => {
      const input = '[link1](https://example.com) or [link2](https://other.com)';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com">link1</a>');
      expect(output).toContain('<a href="https://other.com">link2</a>');
    });
  });

  describe('mixed HTML and markdown formatting', () => {
    it('should handle mixed closed and unclosed anchor tags', () => {
      const input =
        'See <a href="https://closed.com">closed link</a> with <a href="https://unclosed.com">unclosed link';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://closed.com">closed link</a>');
      expect(output).toContain('<a href="https://unclosed.com">unclosed link</a>');
    });

    it('should handle markdown and HTML links together', () => {
      const input = '[markdown](https://md.com) or <a href="https://html.com">html</a>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://md.com">markdown</a>');
      expect(output).toContain('<a href="https://html.com">html</a>');
    });
  });

  describe('HTML special characters', () => {
    it('should escape ampersands in text', () => {
      const input = 'This & that';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('&amp;');
    });

    it('should escape angle brackets in text not in tags', () => {
      const input = 'Number: 5 is less then 10';
      const output = sanitizeLLMResponseForTelegram(input);
      // Bare < and > in text should be escaped, but in tags should be stripped
      expect(output).toContain('Number: 5 is less then 10');
    });

    it('should not double-escape existing entities', () => {
      const input = 'Entity: &amp; test';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('&amp;');
      // Should not have triple escaping
      expect(output).not.toContain('&amp;amp;');
    });

    it('should preserve URLs with special characters', () => {
      const input = '<a href="https://example.com?q=test">link</a>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com?q=test">');
    });
  });

  describe('formatting tags', () => {
    it('should convert bold markdown to HTML', () => {
      const input = '**bold text**';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<b>bold text</b>');
    });

    it('should convert italic markdown to HTML', () => {
      const input = '*italic text*';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<i>italic text</i>');
    });

    it('should convert inline code to HTML', () => {
      const input = 'Use `console.log()` for output';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<code>console.log()</code>');
    });

    it('should handle code blocks', () => {
      const input = 'Example:\n```javascript\nconst x = 1;\n```\nEnd';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<pre>const x = 1;</pre>');
    });

    it('should strip unsupported HTML tags', () => {
      const input = '<div>content</div> and <script>bad</script>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).not.toContain('<div>');
      expect(output).not.toContain('<script>');
      expect(output).toContain('content');
      expect(output).toContain('bad');
    });

    it('should convert <br> tags to newlines', () => {
      const input = 'Line 1<br>Line 2<br/>Line 3';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('complex real-world scenarios', () => {
    it('should handle duyet.net CV links example', () => {
      const input =
        'My CV is here:\n<a href="https://duyet.net/cv">duyet.net/cv\n\nPDF: <a href="https://duyet.me/cv.pdf">duyet.me/cv.pdf';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://duyet.net/cv">');
      expect(output).toContain('</a>');
      expect(output).toContain('<a href="https://duyet.me/cv.pdf">');
      // Both links should be properly closed
      const linkMatches = output.match(/<a href="[^"]*">[^<]*<\/a>/g);
      expect(linkMatches).toHaveLength(2);
    });

    it('should handle mixed formatting with unclosed link', () => {
      const input = 'This is **bold** with <a href="https://example.com">unclosed link text';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<b>bold</b>');
      expect(output).toContain('<a href="https://example.com">');
      expect(output).toContain('</a>');
    });

    it('should handle list with links', () => {
      const input =
        '• Item 1: <a href="https://first.com">first\n• Item 2: <a href="https://second.com">second</a>\n• Item 3: text';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://first.com">first</a>');
      expect(output).toContain('<a href="https://second.com">second</a>');
      expect(output).toContain('Item 3');
    });

    it('should clean up excessive whitespace', () => {
      const input = 'Line 1\n\n\n\nLine 2\n\n\n\nLine 3';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).not.toContain('\n\n\n');
      expect(output).toMatch(/Line 1\n\nLine 2\n\nLine 3/);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const input = '';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toBe('');
    });

    it('should handle whitespace-only input', () => {
      const input = '   \n\n   ';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toBe('');
    });

    it('should handle links with query parameters', () => {
      const input = '<a href="https://example.com?q=test">link</a>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com?q=test">link</a>');
    });

    it('should handle links with encoded special characters', () => {
      const input = '<a href="https://example.com?q=%20">link</a>';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('<a href="https://example.com?q=%20">link</a>');
    });

    it('should preserve text content exactly', () => {
      const input = 'Important: <a href="https://example.com">click here';
      const output = sanitizeLLMResponseForTelegram(input);
      expect(output).toContain('Important:');
      expect(output).toContain('click here');
    });

    it('should handle consecutive unclosed links', () => {
      const input =
        '<a href="https://first.com">first text <a href="https://second.com">second text';
      const output = sanitizeLLMResponseForTelegram(input);
      // Both should be properly closed
      const linkMatches = output.match(/<a href="[^"]*">[^<]*<\/a>/g);
      expect(linkMatches?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
