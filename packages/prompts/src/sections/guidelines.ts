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
  'Use markdown formatting when helpful',
  'Always respond in the language used by the user',
  "Admit when you don't know something rather than making up information",
  'For technical questions, explain your reasoning',
];

/**
 * Platform-specific guidelines
 */
const PLATFORM_GUIDELINES: Record<Platform, string[]> = {
  telegram: [
    'Keep responses concise for mobile reading',
    'Break long responses into paragraphs',
    'Use bullet points for lists',
    'Use emojis sparingly for friendly tone',
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
