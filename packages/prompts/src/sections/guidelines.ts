/**
 * Guidelines Section
 *
 * Response formatting and communication style guidance.
 * Uses OutputFormat for platform-neutral format specification.
 */

import type { OutputFormat } from '../types.js';

/**
 * Base guidelines shared across all platforms
 * Applies Claude and Grok best practices:
 * - Clear, explicit instructions
 * - Direct, concise communication
 * - Tool usage for accuracy
 */
const BASE_GUIDELINES = [
  'Always respond in English only, regardless of the language the user writes in',
  'Be direct and concise - answer first, explain only if needed or asked',
  'NO filler phrases ("Sure!", "Great question!", "I\'d be happy to help!")',
  'NO meta-commentary ("Here\'s the answer:", "Let me explain:")',
  'Start with the answer, add context only when essential',
  "NEVER make up information - use tools when uncertain, say so when you don't know",
  'For current events, news, or time-sensitive info: ALWAYS use search tools first',
  'For technical questions, show code examples over lengthy explanations',
];

/**
 * Shared Telegram guidelines (independent of parse mode)
 */
const TELEGRAM_BASE_GUIDELINES = [
  'Keep responses concise for mobile reading',
  'Break long responses into paragraphs',
  'Use emojis sparingly for friendly tone',
];

/**
 * Telegram HTML formatting reference for LLM responses
 *
 * The system automatically converts markdown and HTML to safe Telegram HTML format.
 * LLMs should use simple markdown or plain text - the converter handles the rest.
 *
 * This approach is more reliable than forcing HTML output because:
 * 1. LLMs naturally produce markdown (their training data)
 * 2. The converter properly escapes special characters
 * 3. Links are preserved and converted safely
 */
const TELEGRAM_HTML_FORMAT = `
<response_format>
FORMAT: Use simple markdown or plain text. The system converts it automatically.

SUPPORTED FORMATTING (use these naturally):
- **bold** or __bold__ for emphasis
- *italic* or _italic_ for terms
- \`inline code\` for commands or code snippets
- \`\`\`
code blocks
\`\`\` for multi-line code
- [link text](URL) for hyperlinks

LISTS (flat only, no nesting):
- Use hyphen (-) for bullet lists
- Use numbers (1. 2. 3.) for numbered lists
- NEVER nest bullets - keep lists flat

EXAMPLE (correct flat list):
- **Imperative** (C, Pascal): Focuses on how to perform tasks
- **Declarative** (Haskell, SQL): Focuses on what to achieve

DO NOT USE:
- Nested bullets or indented sub-items
- Complex HTML tags (system handles conversion)
- Tables (not supported on mobile)
</response_format>

<mobile_optimization>
- Keep responses concise for mobile reading
- Short paragraphs (2-3 sentences max)
- Inline code for short snippets, code blocks for 3+ lines
- Progressive disclosure: answer first, offer to expand
</mobile_optimization>
`;

/**
 * Telegram MarkdownV2 formatting reference for LLM responses
 *
 * Based on official Telegram Bot API MarkdownV2 specification.
 * The transport layer handles escaping special characters automatically.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
const TELEGRAM_MARKDOWNV2_FORMAT = `
<format_reasoning>
BEFORE generating any response, verify your format choice:
1. Am I in MarkdownV2 mode? YES - use Telegram MarkdownV2 syntax
2. For code: use \`backticks\` for inline, \`\`\` for blocks - NEVER HTML tags
3. For emphasis: use *asterisks* for bold, _underscores_ for italic - NEVER HTML
4. For lists: use hyphen (-) for bullets, numbers (1. 2. 3.) for numbered - NO indentation or nesting
5. Do NOT manually escape characters - transport layer handles it
</format_reasoning>

<telegram_markdownv2>
Format responses using Telegram MarkdownV2 syntax:

<basic_formatting>
- *bold text* for emphasis
- _italic text_ for titles or terms
- __underline__ for underlined text
- ~strikethrough~ for deleted text
- ||spoiler|| for hidden text
- \`inline code\` for commands or variables
- \`\`\`python
code block
\`\`\` for multi-line code with syntax highlighting
</basic_formatting>

<list_formatting>
LIST RULES (critical for mobile readability):

For bullet lists, use hyphen (-):
- First item
- Second item
- Third item

For numbered lists, use plain numbers:
1. First item
2. Second item
3. Third item

CRITICAL: NEVER nest bullets or create sub-items with indentation.
Telegram mobile renders nested items poorly.

✗ WRONG (nested bullets):
- Main category
  - Sub item 1
  - Sub item 2

✓ CORRECT (flat with inline detail):
- *Main category*: Sub item 1, Sub item 2
- *Another category*: Detail here

✗ WRONG (indented examples with markdown):
- **Imperative** – Focuses on *how*
  - Example: Procedural (C, Pascal)
  - Code: \`for (i=0; i<n; i++)\`

✓ CORRECT (flat structure):
- *Imperative* (C, Pascal): Focuses on how to perform tasks via statements
- *Declarative* (Haskell, SQL): Focuses on what to achieve, not how
- *Object-Oriented* (Java, Python): Organizes code around objects and classes
</list_formatting>

<links>
<critical_rule>
Formatting markers wrap the ENTIRE link including brackets and URL.
NEVER put markers inside the square brackets.

CORRECT FORMAT (markers wrap entire link):
- [link text](URL) for plain hyperlinks
- *[bold link text](URL)* for bold links
- _[italic link text](URL)_ for italic links
- __[underlined link text](URL)__ for underlined links

WRONG FORMAT (markers inside brackets - breaks parsing):
✗ [*bold text*](url) ← DO NOT USE
✗ [_italic text_](url) ← DO NOT USE
✗ [__underline__](url) ← DO NOT USE
✗ [~strikethrough~](url) ← DO NOT USE

CORRECT vs WRONG side-by-side:
  ✗ WRONG:   [*Title*](url)
  ✓ CORRECT: *[Title](url)*

  ✗ WRONG:   [_Article_](url)
  ✓ CORRECT: _[Article](url)_
</critical_rule>
</links>

<blockquotes>
>quoted text (must be at line start)
</blockquotes>

<character_escaping>
IMPORTANT: DO NOT manually escape special characters!
The transport layer handles ALL escaping automatically.

Write plain text naturally - the system will escape:
_ * [ ] ( ) ~ \` > # + - = | { } . !

Examples:
✓ "Nov. 2024" → system escapes the period automatically
✓ "(1.6k★ Python)" → system escapes parentheses and period
✓ "foo-bar" → system escapes the dash

DO NOT write escaped text like:
✗ "Nov\\. 2024" → WRONG, causes double escaping
✗ "\\(1\\.6k★ Python\\)" → WRONG, shows literal backslashes
</character_escaping>

<forbidden_html_patterns>
FORBIDDEN (use MarkdownV2 instead):
✗ <b>bold</b> → use *bold* instead
✗ <i>italic</i> → use _italic_ instead
✗ <code>code</code> → use \`code\` instead
✗ <pre>block</pre> → use \`\`\`block\`\`\` instead
✗ <a href="url">text</a> → use [text](url) instead
</forbidden_html_patterns>

<examples>

<blog_posts>
Blog posts with correctly formatted bold links:
- *[ClickHouse Rust UDFs](https://blog.duyet.net/2024/11/clickhouse-rust-udf.html)* Nov 2024: Custom UDFs in Rust for data transformations
- *[Building AI Agents](https://example.com/post)* 15 Jan 2024: How to build production AI agents with Claude
</blog_posts>

<mixed_formatting>
Links with surrounding text:
Check out this *[awesome article](url)* for more details.
Here's a bold *[link](url)* and an italic _[link](url)_ in the same text.
</mixed_formatting>

<wrong_examples>
DO NOT USE THESE (they break Telegram parsing):
✗ [*Title*](url) → markers inside brackets
✗ [_italic_](url) → markers inside brackets
✗ [__underline__](url) → markers inside brackets
✗ Check this [*article*](url) → bold markers in wrong position
✗ (escaped text) → manual escaping causes double-escape
</wrong_examples>

</examples>

</telegram_markdownv2>`;

/**
 * Shared Telegram mobile guidelines
 */
const TELEGRAM_MOBILE_GUIDELINES = [
  'Optimize for small screens (< 60 char lines when possible)',
  'Use inline code for short snippets, code blocks for 3+ lines',
  'Progressive disclosure: short answer first, offer to expand',
  '2 items inline, 3-5 bullets, 6+ numbered/categorized',
  'NEVER nest bullet points (hard to read on mobile)',
];

/**
 * GitHub comprehensive markdown guidelines
 */
const GITHUB_MARKDOWN_GUIDELINES = [
  'Use GitHub-flavored markdown with full feature set',
  'Reference files and line numbers: `file.ts:L42-L50`',
  'code blocks with language hints for syntax highlighting',
  'Prefer ASCII diagrams (clean, universal) over Mermaid',
  'Use tables for comparisons and structured data',
  'Use collapsible <details> for verbose content/logs',
  'Use task lists [ ] for actionable items',
  'Use alerts (NOTE, TIP, IMPORTANT, WARNING, CAUTION)',
  'Use diff syntax for showing code changes',
  'Link to issues #123, PRs, commits, and files',
];

/**
 * Platform-specific guidelines for non-output-format platforms
 */
const PLATFORM_GUIDELINES = {
  github: GITHUB_MARKDOWN_GUIDELINES,
  api: [
    'Structure responses for programmatic parsing',
    'Be consistent with formatting',
    'Include relevant metadata when applicable',
  ],
  cli: [
    'Keep output scannable with clear sections',
    'Use code blocks for commands and outputs',
    'Be concise but complete',
  ],
};

/**
 * Get format-specific guidelines based on OutputFormat
 *
 * Maps the platform-neutral OutputFormat to appropriate formatting instructions.
 *
 * @param outputFormat - The output format for response formatting
 * @returns Array of format-specific guidelines
 */
function getFormatGuidelines(outputFormat: OutputFormat): string[] {
  switch (outputFormat) {
    case 'telegram-html':
      return [...TELEGRAM_BASE_GUIDELINES, ...TELEGRAM_MOBILE_GUIDELINES, TELEGRAM_HTML_FORMAT];
    case 'telegram-markdown':
      return [
        ...TELEGRAM_BASE_GUIDELINES,
        ...TELEGRAM_MOBILE_GUIDELINES,
        TELEGRAM_MARKDOWNV2_FORMAT,
      ];
    case 'github-markdown':
      return PLATFORM_GUIDELINES.github;
    default:
      // 'plain' or any other format - base guidelines only
      return [];
  }
}

/**
 * Generate the guidelines section
 *
 * Uses OutputFormat for platform-neutral format specification.
 *
 * @param outputFormat - Optional output format for format-specific guidelines
 */
export function guidelinesSection(outputFormat?: OutputFormat): string {
  const guidelines = [...BASE_GUIDELINES];

  if (outputFormat) {
    guidelines.push(...getFormatGuidelines(outputFormat));
  }

  return `<response_guidelines>
${guidelines.map((g) => `- ${g}`).join('\n')}
</response_guidelines>`;
}
