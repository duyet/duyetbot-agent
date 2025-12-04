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
  'Use bullet points (• or -) for lists',
  'Use emojis sparingly for friendly tone',
];

/**
 * Telegram HTML formatting reference for LLM responses
 */
const TELEGRAM_HTML_FORMAT = `
Format responses using Telegram HTML tags:
- <b>bold</b> for emphasis
- <i>italic</i> for titles or terms
- <code>inline code</code> for commands, variables, or short code
- <pre>code block</pre> for multi-line code
- <pre><code class="language-python">code</code></pre> for syntax-highlighted code blocks
- <a href="URL">link text</a> for hyperlinks
- <blockquote>quoted text</blockquote> for quotes

CRITICAL: Escape these characters in regular text (not inside tags):
- < becomes &lt;
- > becomes &gt;
- & becomes &amp;

Do NOT use Markdown syntax (*bold*, _italic_, \`code\`) - use HTML tags only.`;

/**
 * Telegram MarkdownV2 formatting reference for LLM responses
 *
 * Based on official Telegram Bot API MarkdownV2 specification.
 * The transport layer handles escaping special characters automatically.
 *
 * @see https://core.telegram.org/bots/api#markdownv2-style
 */
const TELEGRAM_MARKDOWNV2_FORMAT = `
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

<examples>

<blog_posts>
Blog posts with correctly formatted bold links:
• *[ClickHouse Rust UDFs](https://blog.duyet.net/2024/11/clickhouse-rust-udf.html)* Nov 2024
  Custom UDFs in Rust for data transformations

• *[Building AI Agents](https://example.com/post)* 15 Jan 2024
  How to build production AI agents with Claude
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
 * Platform-specific guidelines for non-output-format platforms
 */
const PLATFORM_GUIDELINES = {
  github: [
    'Use GitHub-flavored markdown',
    'Reference specific files and line numbers when relevant',
    'Include code blocks with syntax highlighting',
    'Be precise about code changes and diffs',
  ],
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
      return [...TELEGRAM_BASE_GUIDELINES, TELEGRAM_HTML_FORMAT];
    case 'telegram-markdown':
      return [...TELEGRAM_BASE_GUIDELINES, TELEGRAM_MARKDOWNV2_FORMAT];
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
