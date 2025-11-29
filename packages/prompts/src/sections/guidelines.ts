/**
 * Guidelines Section
 *
 * Response formatting and communication style guidance.
 * Uses OutputFormat for platform-neutral format specification.
 */

import type { OutputFormat } from '../types.js';

/**
 * Base guidelines shared across all platforms
 */
const BASE_GUIDELINES = [
  'Always respond in English only, regardless of the language the user writes in',
  'Be direct and concise - give the answer first, then explain only if needed',
  'For simple requests like translations, just provide the result without extra commentary or emojis',
  "NEVER make up information - if you don't have accurate data, say so or use tools",
  'For current events, news, or time-sensitive info: ALWAYS use search tools first',
  'For technical questions, explain your reasoning',
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
 */
const TELEGRAM_MARKDOWNV2_FORMAT = `
Format responses using Telegram MarkdownV2 syntax:
- *bold* for emphasis
- _italic_ for titles or terms
- \`inline code\` for commands, variables, or short code
- \`\`\`language
code block
\`\`\` for multi-line code with syntax highlighting
- [link text](URL) for hyperlinks
- >quoted text for blockquotes (must be at start of line)

CRITICAL: Escape these special characters with backslash in regular text:
_ * [ ] ( ) ~ \` > # + - = | { } . !

Examples:
- To write "test_variable", escape as "test\\_variable"
- To write "2 + 2 = 4", escape as "2 \\+ 2 \\= 4"
- To write "use *asterisk*", escape as "use \\*asterisk\\*"

Do NOT use HTML tags (<b>, <i>, <code>) - use MarkdownV2 syntax only.`;

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
