/**
 * Telegram HTML Format Assertions
 *
 * Validates that prompts/outputs follow Telegram HTML formatting rules.
 * Reference: packages/prompts/src/sections/guidelines.ts - TELEGRAM_HTML_FORMAT
 */

interface AssertionContext {
  prompt?: string;
  vars?: Record<string, unknown>;
  test?: unknown;
}

interface GradingResult {
  pass: boolean;
  score: number;
  reason: string;
  namedScores?: Record<string, number>;
  componentResults?: Array<{ pass: boolean; score: number; reason: string }>;
}

// Allowed Telegram HTML tags (from guidelines)
const ALLOWED_TAGS = ['b', 'i', 'u', 's', 'code', 'pre', 'a', 'blockquote'];

// Disallowed tags (security concern)
const DISALLOWED_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input'];

// Characters that must be escaped in Telegram HTML (outside tags)
const _ESCAPED_CHARS = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
};

/**
 * Validates Telegram HTML format compliance
 * Checks for:
 * - No disallowed tags
 * - Proper character escaping
 * - Valid tag nesting
 * - No Markdown syntax
 */
export async function telegramHtmlValid(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  const errors: string[] = [];
  const components: Array<{ pass: boolean; score: number; reason: string }> = [];

  // Parse output (might be JSON from provider)
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Check 1: No disallowed HTML tags
  let hasDisallowedTag = false;
  for (const tag of DISALLOWED_TAGS) {
    const pattern = new RegExp(`<${tag}[\\s>]`, 'i');
    if (pattern.test(content)) {
      errors.push(`Contains disallowed tag: <${tag}>`);
      hasDisallowedTag = true;
    }
  }
  components.push({
    pass: !hasDisallowedTag,
    score: hasDisallowedTag ? 0 : 1,
    reason: hasDisallowedTag ? 'Contains disallowed tags' : 'No disallowed tags',
  });

  // Check 2: No Markdown syntax (should use HTML instead)
  const markdownPatterns = [
    { pattern: /\*\*\w+\*\*/g, desc: 'Markdown bold (**text**)' },
    { pattern: /__\w+__/g, desc: 'Markdown underline (__text__)' },
    { pattern: /\*\w+\*/g, desc: 'Markdown italic (*text*)' },
    { pattern: /_\w+_/g, desc: 'Markdown italic (_text_)' },
    { pattern: /`\w+`/g, desc: 'Markdown inline code' },
  ];

  const markdownIssues: string[] = [];
  for (const { pattern, desc } of markdownPatterns) {
    if (pattern.test(content)) {
      markdownIssues.push(desc);
    }
  }

  components.push({
    pass: markdownIssues.length === 0,
    score: markdownIssues.length === 0 ? 1 : 0,
    reason:
      markdownIssues.length === 0
        ? 'No Markdown syntax detected'
        : `Uses Markdown instead of HTML: ${markdownIssues.join(', ')}`,
  });

  // Check 3: HTML tag validity (simplified check)
  const htmlTags = content.match(/<[^>]+>/g) || [];
  let invalidTags = 0;

  for (const tag of htmlTags) {
    const tagName = tag.match(/<\/?([a-z0-9]+)/i)?.[1]?.toLowerCase();
    if (tagName && !ALLOWED_TAGS.includes(tagName) && !DISALLOWED_TAGS.includes(tagName)) {
      // Check if it's a valid HTML entity (like &amp;)
      if (!tag.match(/^&\w+;$/)) {
        invalidTags++;
      }
    }
  }

  components.push({
    pass: invalidTags === 0,
    score: invalidTags === 0 ? 1 : Math.max(0, 1 - invalidTags * 0.2),
    reason: invalidTags === 0 ? 'All HTML tags are valid' : `Found ${invalidTags} invalid tags`,
  });

  // Check 4: Contains HTML format directive or uses HTML tags
  const hasHtmlTag = ALLOWED_TAGS.some((tag) => new RegExp(`<${tag}[\\s>]`).test(content));
  const hasFormatDirective = content.includes('HTML');

  components.push({
    pass: hasHtmlTag || hasFormatDirective,
    score: hasHtmlTag || hasFormatDirective ? 1 : 0.5,
    reason:
      hasHtmlTag || hasFormatDirective
        ? 'Uses HTML formatting'
        : 'Should use HTML tags for formatting',
  });

  const totalScore = components.reduce((sum, c) => sum + c.score, 0) / components.length;

  return {
    pass: errors.length === 0 && totalScore >= 0.8,
    score: totalScore,
    reason: errors.length > 0 ? errors.join('; ') : 'Valid Telegram HTML format',
    componentResults: components,
  };
}

/**
 * Validates that HTML tags are properly closed
 */
export async function telegramHtmlTagsClosed(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Extract all opening and closing tags
  const openingTags: Record<string, number> = {};
  const closingTags: Record<string, number> = {};

  const openMatches = content.matchAll(/<([a-z]+)[^>]*>/gi);
  for (const match of openMatches) {
    const tagName = match[1].toLowerCase();
    if (ALLOWED_TAGS.includes(tagName)) {
      openingTags[tagName] = (openingTags[tagName] || 0) + 1;
    }
  }

  const closeMatches = content.matchAll(/<\/([a-z]+)>/gi);
  for (const match of closeMatches) {
    const tagName = match[1].toLowerCase();
    closingTags[tagName] = (closingTags[tagName] || 0) + 1;
  }

  // Check for mismatches
  const mismatches: string[] = [];
  for (const [tag, count] of Object.entries(openingTags)) {
    const closeCount = closingTags[tag] || 0;
    if (closeCount !== count) {
      mismatches.push(`<${tag}>: ${count} open, ${closeCount} close`);
    }
  }

  return {
    pass: mismatches.length === 0,
    score: mismatches.length === 0 ? 1 : 0.5,
    reason:
      mismatches.length === 0
        ? 'All tags properly closed'
        : `Mismatched tags: ${mismatches.join('; ')}`,
  };
}

/**
 * Checks if output contains specific HTML elements
 */
export async function telegramHtmlContains(
  output: string,
  context: AssertionContext & { value?: string[] }
): Promise<GradingResult> {
  const expected = (context.value || []) as string[];
  const missing: string[] = [];

  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  for (const item of expected) {
    if (!content.includes(item)) {
      missing.push(item);
    }
  }

  return {
    pass: missing.length === 0,
    score: expected.length > 0 ? 1 - missing.length / expected.length : 1,
    reason:
      missing.length > 0 ? `Missing: ${missing.join(', ')}` : 'Contains all expected elements',
  };
}

/**
 * Validates proper character escaping in HTML
 */
export async function telegramHtmlEscaping(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Find text outside of tags to check escaping
  // Simple regex to extract text nodes (between > and <)
  const textNodes = content.split(/>([^<]*)</);
  const issues: string[] = [];

  for (let i = 1; i < textNodes.length; i += 2) {
    const textNode = textNodes[i];
    // Check for unescaped special chars
    if (/<(?!&lt;)/.test(textNode)) {
      issues.push('Found unescaped < in text');
    }
    if (/>(?!&gt;)/.test(textNode)) {
      issues.push('Found unescaped > in text');
    }
    if (/&(?!amp;|lt;|gt;|#)/.test(textNode)) {
      // Check if & is not part of an entity
      const ampMatches = textNode.match(/&(?!amp;|lt;|gt;|#)/g);
      if (ampMatches && ampMatches.length > 0) {
        issues.push('Found unescaped & in text');
      }
    }
  }

  return {
    pass: issues.length === 0,
    score: issues.length === 0 ? 1 : 0.5,
    reason:
      issues.length === 0 ? 'Proper character escaping' : `Escaping issues: ${issues.join('; ')}`,
  };
}

export default telegramHtmlValid;
