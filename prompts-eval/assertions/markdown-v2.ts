/**
 * Telegram MarkdownV2 Format Assertions
 *
 * Validates that prompts/outputs follow Telegram MarkdownV2 formatting rules.
 * Reference: packages/prompts/src/sections/guidelines.ts - TELEGRAM_MARKDOWNV2_FORMAT
 *
 * Key Rule: The transport layer handles ALL escaping automatically.
 * Write plain text naturally - DO NOT manually escape special characters.
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
  componentResults?: Array<{ pass: boolean; score: number; reason: string }>;
}

// Characters that can be used as formatting in MarkdownV2
const _FORMATTING_CHARS = [
  '*',
  '_',
  '~',
  '`',
  '[',
  ']',
  '(',
  ')',
  '>',
  '#',
  '+',
  '-',
  '=',
  '|',
  '{',
  '}',
  '.',
  '!',
];

/**
 * Validates Telegram MarkdownV2 format compliance
 * Checks for:
 * - Proper formatting syntax (* _ ~ ` > etc.)
 * - No manual escaping (transport layer handles it)
 * - Valid link syntax
 * - Proper code block delimiters
 */
export async function markdownV2Valid(
  output: string,
  _context: AssertionContext
): Promise<GradingResult> {
  const components: Array<{ pass: boolean; score: number; reason: string }> = [];

  let content: string;
  try {
    const parsed = JSON.parse(output);
    content = parsed.systemPrompt || output;
  } catch {
    content = output;
  }

  // Check 1: No manual escaping (transport layer does it automatically)
  // Look for backslash escaping which would cause double-escaping
  const manualEscapes = content.match(/\\[_*[\]()~>#+=|{}.!-]/g);
  const hasManualEscaping = manualEscapes && manualEscapes.length > 0;

  components.push({
    pass: !hasManualEscaping,
    score: hasManualEscaping ? 0 : 1,
    reason: hasManualEscaping
      ? `Found manual escaping (${manualEscapes?.length || 0} instances) - transport layer handles this automatically`
      : 'No manual escaping (correct - transport layer handles it)',
  });

  // Check 2: Paired formatting markers (* _ ~ are common)
  const formatChecks = [
    { char: '*', name: 'bold' },
    { char: '_', name: 'italic' },
    { char: '~', name: 'strikethrough' },
  ];

  let unpairedIssues = 0;
  for (const { char } of formatChecks) {
    // Remove code blocks before checking (they don't count)
    const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');

    // Count unescaped instances (should be even)
    const matches = withoutCode.match(new RegExp(`(?<!\\\\)\\${char}`, 'g')) || [];
    if (matches.length % 2 !== 0 && matches.length > 0) {
      unpairedIssues++;
    }
  }

  components.push({
    pass: unpairedIssues === 0,
    score: unpairedIssues === 0 ? 1 : Math.max(0.5, 1 - unpairedIssues * 0.25),
    reason:
      unpairedIssues === 0
        ? 'Formatting markers are properly paired'
        : `Found ${unpairedIssues} unpaired formatting markers`,
  });

  // Check 3: Valid link syntax - markers wrap entire link
  // Correct: *[text](url)* or _[text](url)_
  // Wrong: [*text*](url) or [_text_](url)
  const wrongLinkPatterns = [
    /\[\*[^\]]+\*\]\([^)]+\)/g, // [*text*](url)
    /\[_[^\]]+_\]\([^)]+\)/g, // [_text_](url)
    /\[~[^\]]+~\]\([^)]+\)/g, // [~text~](url)
    /\[__[^\]]+__\]\([^)]+\)/g, // [__text__](url)
  ];

  let wrongLinkCount = 0;
  for (const pattern of wrongLinkPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      wrongLinkCount += matches.length;
    }
  }

  components.push({
    pass: wrongLinkCount === 0,
    score: wrongLinkCount === 0 ? 1 : Math.max(0, 1 - wrongLinkCount * 0.25),
    reason:
      wrongLinkCount === 0
        ? 'Links have correct formatting (markers wrap entire link)'
        : `Found ${wrongLinkCount} incorrectly formatted links (markers should wrap entire link)`,
  });

  // Check 4: Code blocks use triple backticks with language
  const _codeBlockPattern = /```(\w+)?\n/g;
  const _hasLanguageSpecifiers = /```(\w+)\n/.test(content);
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

  let properCodeBlocks = 0;
  for (const block of codeBlocks) {
    if (/```\w+\n/.test(block)) {
      properCodeBlocks++;
    }
  }

  components.push({
    pass: properCodeBlocks >= Math.max(0, codeBlocks.length - 1), // Allow one code block without language
    score: codeBlocks.length === 0 ? 1 : properCodeBlocks / codeBlocks.length,
    reason:
      codeBlocks.length === 0
        ? 'No code blocks to check'
        : `${properCodeBlocks}/${codeBlocks.length} code blocks have language specifiers`,
  });

  // Check 5: Contains MarkdownV2 format directive or uses MarkdownV2 syntax
  const hasFormatDirective = content.includes('MarkdownV2') || content.includes('MarkdownV2');
  const usesMarkdownV2 =
    /\*[^*]+\*/.test(content) || // bold
    /_[^_]+_/.test(content) || // italic
    /~[^~]+~/.test(content) || // strikethrough
    /\|\|[^|]+\|\|/.test(content); // spoiler

  components.push({
    pass: hasFormatDirective || usesMarkdownV2,
    score: hasFormatDirective || usesMarkdownV2 ? 1 : 0.5,
    reason:
      hasFormatDirective || usesMarkdownV2
        ? 'Uses MarkdownV2 formatting'
        : 'Should use MarkdownV2 syntax',
  });

  const totalScore = components.reduce((sum, c) => sum + c.score, 0) / components.length;

  return {
    pass: totalScore >= 0.8,
    score: totalScore,
    reason: totalScore >= 0.8 ? 'Valid MarkdownV2 format' : 'Some MarkdownV2 checks failed',
    componentResults: components,
  };
}

/**
 * Checks that code blocks don't have unnecessary escaping
 */
export async function markdownV2CodeBlockValid(
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

  // Extract code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const inlineCode = content.match(/`[^`]+`/g) || [];

  const issues: string[] = [];

  // Check for manual escaping inside code blocks (shouldn't be there)
  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    // Look for backslash escapes inside code
    if (/\\[_*[\]()~>#+=|{}.!-]/.test(block)) {
      issues.push(`Code block ${i + 1} contains unnecessary manual escaping`);
    }
  }

  for (let i = 0; i < inlineCode.length; i++) {
    const code = inlineCode[i];
    // Look for backslash escapes inside inline code
    if (/\\[_*[\]()~>#+=|{}.!-]/.test(code)) {
      issues.push(`Inline code ${i + 1} contains unnecessary manual escaping`);
    }
  }

  return {
    pass: issues.length === 0,
    score: issues.length === 0 ? 1 : 0.5,
    reason:
      issues.length === 0
        ? 'Code blocks properly formatted (no unnecessary escaping)'
        : issues.join('; '),
  };
}

/**
 * Validates proper link formatting in MarkdownV2
 * Critical rule: Formatting markers wrap the ENTIRE link including brackets and URL
 */
export async function markdownV2LinkFormat(
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

  // Check for incorrect link patterns (markers inside brackets)
  const incorrectPatterns = [
    { pattern: /\[\*[^\]]+\*\]\(/, name: 'bold inside brackets' },
    { pattern: /\[_[^\]]+_\]\(/, name: 'italic inside brackets' },
    { pattern: /\[~[^\]]+~\]\(/, name: 'strikethrough inside brackets' },
    { pattern: /\[__[^\]]+__\]\(/, name: 'underline inside brackets' },
  ];

  let incorrectCount = 0;
  const foundPatterns: string[] = [];

  for (const { pattern, name } of incorrectPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      incorrectCount += matches.length;
      foundPatterns.push(`${matches.length} × ${name}`);
    }
  }

  // Check for correct patterns (markers outside)
  const _correctPattern = /[*_~]?\[[^\]]+\]\([^)]+\)[*_~]?/g;
  const allLinks = content.match(/\[[^\]]+\]\([^)]+\)/g) || [];

  return {
    pass: incorrectCount === 0,
    score: allLinks.length === 0 ? 1 : (allLinks.length - incorrectCount) / allLinks.length,
    reason:
      incorrectCount === 0
        ? `All ${allLinks.length} links properly formatted (markers wrap entire link)`
        : `Found ${incorrectCount} incorrectly formatted links: ${foundPatterns.join(', ')}. Markers should wrap entire link: *[text](url)*, not [*text*](url)`,
  };
}

/**
 * Checks that text is written naturally without manual escaping
 */
export async function markdownV2NoManualEscaping(
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

  // Look for manual escaping attempts
  const manualEscapePattern = /\\[_*[\]()~>#+=|{}.!-]/g;
  const _escapeMatches = content.match(manualEscapePattern) || [];

  // Remove code blocks from check (some escaping might be valid there)
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const escapeMatchesOutsideCode = withoutCode.match(manualEscapePattern) || [];

  return {
    pass: escapeMatchesOutsideCode.length === 0,
    score: escapeMatchesOutsideCode.length === 0 ? 1 : 0,
    reason:
      escapeMatchesOutsideCode.length === 0
        ? 'Text is written naturally without manual escaping (correct)'
        : `Found ${escapeMatchesOutsideCode.length} manual escape sequences. Write plain text naturally - the transport layer handles escaping automatically`,
  };
}

export default markdownV2Valid;
