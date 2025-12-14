/**
 * Escape utilities for different rendering formats.
 *
 * Provides functions to safely escape text for HTML, MarkdownV2 (Telegram),
 * GitHub Markdown, and plain text formats.
 */

import type { RenderFormat } from '../types.js';

/**
 * Escape HTML entities in text for safe inclusion in HTML messages
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape special characters for Telegram MarkdownV2 format (simple version)
 *
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 * This is a simple escape that escapes ALL special characters.
 * Use smartEscapeMarkdownV2() to preserve formatting syntax.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMarkdownV2(text: string): string {
  // All special characters that need escaping in MarkdownV2
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Smart escape for Telegram MarkdownV2 that preserves formatting syntax
 *
 * Handles these MarkdownV2 constructs:
 * - *bold*, _italic_, __underline__, ~strikethrough~, ||spoiler||
 * - [text](url) links - escapes text, preserves URL (only escape ) and \)
 * - *[text](url)* bold-wrapped links - preserves outer markers
 * - _[text](url)_ italic-wrapped links - preserves outer markers
 * - `inline code` and ```code blocks```
 * - >blockquotes (at line start)
 *
 * Per Telegram docs: "Any character with code between 1 and 126 can be escaped
 * anywhere with a preceding '\' character"
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
export function smartEscapeMarkdownV2(text: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Check for code blocks first (```...```)
    if (text.slice(i, i + 3) === '```') {
      const endIndex = text.indexOf('```', i + 3);
      if (endIndex !== -1) {
        // Preserve code block, only escape ` and \ inside
        const codeBlock = text.slice(i, endIndex + 3);
        result.push(escapeInsideCodeBlock(codeBlock));
        i = endIndex + 3;
        continue;
      }
    }

    // Check for inline code (`...`)
    if (text[i] === '`') {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex !== -1) {
        // Preserve inline code, only escape ` and \ inside
        const inlineCode = text.slice(i, endIndex + 1);
        result.push(escapeInsideInlineCode(inlineCode));
        i = endIndex + 1;
        continue;
      }
    }

    // Check for formatted links: *[text](url)* or _[text](url)_
    // Must check BEFORE plain links to preserve outer formatting markers
    if (text[i] === '*' || text[i] === '_') {
      const marker = text[i] as string;
      const formattedLink = matchFormattedLink(text, i, marker);
      if (formattedLink) {
        result.push(formattedLink.formatted);
        i = formattedLink.endIndex;
        continue;
      }
    }

    // Check for plain links [text](url)
    if (text[i] === '[') {
      const linkMatch = matchLink(text, i);
      if (linkMatch) {
        result.push(formatLink(linkMatch.text, linkMatch.url));
        i = linkMatch.endIndex;
        continue;
      }
    }

    // Check for formatting markers that should be preserved
    // Bold: *text* (not escaped)
    // Italic: _text_ (not escaped at boundaries)
    // Underline: __text__
    // Strikethrough: ~text~
    // Spoiler: ||text||
    // These are tricky - we preserve the markers but escape content

    // For simplicity, escape special chars that are not part of recognized patterns
    const char = text[i] as string;
    if (isMarkdownV2Special(char)) {
      // Check if this is a formatting marker we should preserve
      if (isFormattingMarker(text, i)) {
        result.push(char);
      } else {
        result.push(`\\${char}`);
      }
    } else {
      result.push(char);
    }
    i++;
  }

  return result.join('');
}

/**
 * Match a formatted link pattern: *[text](url)* or _[text](url)_
 * Returns the formatted result and end index
 */
function matchFormattedLink(
  text: string,
  start: number,
  marker: string
): { formatted: string; endIndex: number } | null {
  // Must start with marker followed by [
  if (text[start] !== marker || text[start + 1] !== '[') {
    return null;
  }

  // Try to match the link starting after the opening marker
  const linkMatch = matchLink(text, start + 1);
  if (!linkMatch) {
    return null;
  }

  // Must have closing marker after the link
  if (text[linkMatch.endIndex] !== marker) {
    return null;
  }

  // Format as marker + link + marker (don't escape the link text for bold links)
  const escapedUrl = linkMatch.url.replace(/([)\\])/g, '\\$1');
  // For formatted links, preserve the link text as-is (it's the title)
  // Only escape truly problematic chars, not formatting markers
  const escapedText = escapeLinkTextForFormattedLink(linkMatch.text);

  return {
    formatted: `${marker}[${escapedText}](${escapedUrl})${marker}`,
    endIndex: linkMatch.endIndex + 1,
  };
}

/**
 * Escape link text for formatted links (*[text](url)*)
 * Less aggressive escaping - preserves readability of titles
 * Only escapes characters that would break the link syntax itself
 */
function escapeLinkTextForFormattedLink(text: string): string {
  // In link text, we only need to escape: [ ] \ and `
  // Other special chars are safe inside [...]
  return text.replace(/([[\\`\]])/g, '\\$1');
}

/**
 * Characters that need escaping in MarkdownV2 plain text
 */
function isMarkdownV2Special(char: string): boolean {
  return '_*[]()~`>#+-=|{}.!\\'.includes(char);
}

/**
 * Check if character at position is a formatting marker to preserve
 */
function isFormattingMarker(text: string, pos: number): boolean {
  const char = text[pos];

  // Bold: *
  if (char === '*') {
    // Check if it's opening or closing bold
    return isBalancedMarker(text, pos, '*');
  }

  // Italic: _ (but not __ which is underline)
  if (char === '_') {
    // __underline__ uses double underscore
    if (text[pos + 1] === '_' || (pos > 0 && text[pos - 1] === '_')) {
      return isBalancedMarker(text, pos, '__');
    }
    return isBalancedMarker(text, pos, '_');
  }

  // Strikethrough: ~
  if (char === '~') {
    return isBalancedMarker(text, pos, '~');
  }

  // Spoiler: ||
  if (char === '|' && text[pos + 1] === '|') {
    return isBalancedMarker(text, pos, '||');
  }

  // Blockquote: > at start of line
  if (char === '>') {
    return pos === 0 || text[pos - 1] === '\n';
  }

  return false;
}

/**
 * Check if marker has a matching closing marker
 */
function isBalancedMarker(text: string, pos: number, marker: string): boolean {
  // Simple heuristic: look for closing marker after some content
  const afterMarker = pos + marker.length;
  const restOfText = text.slice(afterMarker);
  const closingIndex = restOfText.indexOf(marker);

  // Has closing marker with content between
  if (closingIndex > 0) {
    return true;
  }

  // Check if this IS the closing marker (has content before)
  if (pos >= marker.length) {
    const beforeMarker = text.slice(0, pos);
    const openingIndex = beforeMarker.lastIndexOf(marker);
    if (openingIndex !== -1 && openingIndex < pos - marker.length) {
      return true;
    }
  }

  return false;
}

/**
 * Match a markdown link [text](url) starting at position
 */
function matchLink(
  text: string,
  start: number
): { text: string; url: string; endIndex: number } | null {
  if (text[start] !== '[') {
    return null;
  }

  // Find closing ]
  let depth = 1;
  let i = start + 1;
  while (i < text.length && depth > 0) {
    if (text[i] === '[') {
      depth++;
    } else if (text[i] === ']') {
      depth--;
    }
    i++;
  }

  if (depth !== 0) {
    return null;
  }
  const textEnd = i - 1;

  // Must be followed by (url)
  if (text[i] !== '(') {
    return null;
  }

  const urlStart = i + 1;
  // Find closing ) - handle nested parens in URL
  depth = 1;
  i = urlStart;
  while (i < text.length && depth > 0) {
    if (text[i] === '(') {
      depth++;
    } else if (text[i] === ')') {
      depth--;
    }
    i++;
  }

  if (depth !== 0) {
    return null;
  }

  return {
    text: text.slice(start + 1, textEnd),
    url: text.slice(urlStart, i - 1),
    endIndex: i,
  };
}

/**
 * Format a link with proper escaping
 * - Link text: escape special chars
 * - URL: only escape ) and \
 */
function formatLink(linkText: string, url: string): string {
  // Escape special chars in link text (but preserve nested formatting)
  const escapedText = escapeMarkdownV2(linkText);
  // In URL, only ) and \ need escaping
  const escapedUrl = url.replace(/([)\\])/g, '\\$1');
  return `[${escapedText}](${escapedUrl})`;
}

/**
 * Escape inside code block - only ` and \ need escaping
 */
function escapeInsideCodeBlock(codeBlock: string): string {
  // Keep the ``` markers, escape ` and \ inside
  const match = codeBlock.match(/^```([\s\S]*?)```$/);
  if (!match || match[1] === undefined) {
    return codeBlock;
  }

  const content = match[1];
  const escapedContent = content.replace(/([`\\])/g, '\\$1');
  return `\`\`\`${escapedContent}\`\`\``;
}

/**
 * Escape inside inline code - only ` and \ need escaping
 */
function escapeInsideInlineCode(inlineCode: string): string {
  // Keep the ` markers, escape ` and \ inside
  const content = inlineCode.slice(1, -1);
  const escapedContent = content.replace(/([`\\])/g, '\\$1');
  return `\`${escapedContent}\``;
}

/**
 * No-op escape for plain text format
 */
export function escapePlain(text: string): string {
  return text;
}

/**
 * Get the appropriate escape function for a given render format
 *
 * @param format - The target rendering format
 * @returns An escape function that transforms text to be safe for the format
 */
export function getEscaper(format: RenderFormat): (text: string) => string {
  switch (format) {
    case 'html':
      return escapeHtml;
    case 'markdownV2':
      return escapeMarkdownV2;
    case 'markdown':
      // GitHub markdown doesn't need escaping
      return escapePlain;
    case 'plain':
      return escapePlain;
    default:
      return escapePlain;
  }
}
