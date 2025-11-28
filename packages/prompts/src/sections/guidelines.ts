/**
 * Guidelines Section
 *
 * Response formatting and communication style guidance.
 * Platform-aware for optimal user experience.
 */

import type { Platform } from '../types.js';

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
 * Platform-specific guidelines
 */
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

const PLATFORM_GUIDELINES: Record<Platform, string[]> = {
  telegram: [
    'Keep responses concise for mobile reading',
    'Break long responses into paragraphs',
    'Use bullet points (• or -) for lists',
    'Use emojis sparingly for friendly tone',
    TELEGRAM_HTML_FORMAT,
  ],
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
 * Generate the guidelines section
 * @param platform - Optional platform for platform-specific guidelines
 */
export function guidelinesSection(platform?: Platform): string {
  const guidelines = [...BASE_GUIDELINES];

  if (platform && PLATFORM_GUIDELINES[platform]) {
    guidelines.push(...PLATFORM_GUIDELINES[platform]);
  }

  return `<response_guidelines>
${guidelines.map((g) => `- ${g}`).join('\n')}
</response_guidelines>`;
}
