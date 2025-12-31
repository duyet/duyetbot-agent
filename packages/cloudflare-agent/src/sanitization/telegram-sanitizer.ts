/**
 * Convert LLM response to safe Telegram HTML
 *
 * Telegram's HTML parser is EXTREMELY strict - any malformed tag causes
 * the ENTIRE message to render as plain text. This function:
 *
 * 1. Strips any existing HTML (LLMs produce inconsistent/broken HTML)
 * 2. Converts common markdown patterns to safe Telegram HTML
 * 3. Escapes all special characters properly
 *
 * Supported conversions:
 * - **bold** or __bold__ → <b>bold</b>
 * - *italic* or _italic_ → <i>italic</i>
 * - `code` → <code>code</code>
 * - ```code block``` → <pre>code block</pre>
 * - [text](url) → <a href="url">text</a>
 *
 * Note: Links are extracted before HTML stripping to preserve URLs.
 */
export function sanitizeLLMResponseForTelegram(response: string): string {
  // Step 1: Extract and protect markdown links before any processing
  // Pattern: [text](url) - capture both text and URL
  // Using LINKPLACEHOLDER format (no underscores) to avoid matching bold/italic regexes
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
  // Only strip tags that start with a letter (start or end tags) to avoid stripping math like "1 < 2"
  processed = processed.replace(/<\/?\s*[a-z][^>]*>/gi, '');

  // Step 4: Escape HTML special characters FIRST (before adding our own tags)
  // Must escape & first, then < and >
  processed = processed
    .replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, '&amp;') // Don't double-escape existing entities
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Step 5: Convert markdown to HTML tags (order matters!)

  // Step 5a: Convert markdown headers to bold (Telegram doesn't support headings)
  // ### Header → <b>Header</b>
  processed = processed.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Code blocks (``` ... ```) - extract to placeholders to protect from bold/italic
  const codeBlockPlaceholders: Array<{ placeholder: string; code: string }> = [];
  let codeBlockIndex = 0;
  processed = processed.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang, code) => {
    const placeholder = `CODEBLOCKPLACEHOLDER${codeBlockIndex++}`;
    codeBlockPlaceholders.push({ placeholder, code: code.trim() });
    return placeholder;
  });

  // Inline code (`code`) - extract to placeholders to protect from bold/italic
  // This prevents MCP tool names like `duyet__info` from becoming `duyet<b>info</b>`
  const inlineCodePlaceholders: Array<{ placeholder: string; code: string }> = [];
  let inlineCodeIndex = 0;
  processed = processed.replace(/`([^`\n]+)`/g, (_match, code) => {
    const placeholder = `INLINECODEPLACEHOLDER${inlineCodeIndex++}`;
    inlineCodePlaceholders.push({ placeholder, code: String(code) });
    return placeholder;
  });

  // Bold (**text** or __text__) - must be before italic
  // Now safe because code content is protected by placeholders
  processed = processed.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  processed = processed.replace(/__([^_]+)__/g, '<b>$1</b>');

  // Italic (*text* or _text_) - be careful with underscores in words
  // Only match *text* when surrounded by spaces or start/end of line
  processed = processed.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<i>$1</i>');
  // For underscores, only match when surrounded by whitespace to avoid matching words_with_underscores
  processed = processed.replace(/(?<=\s|^)_([^_\n]+)_(?=\s|$|[.,!?])/g, '<i>$1</i>');

  // Step 5b: Restore code placeholders as proper HTML tags
  for (const { placeholder, code } of codeBlockPlaceholders) {
    processed = processed.replace(placeholder, `<pre>${code}</pre>`);
  }
  for (const { placeholder, code } of inlineCodePlaceholders) {
    processed = processed.replace(placeholder, `<code>${code}</code>`);
  }

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
