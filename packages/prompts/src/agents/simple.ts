/**
 * Simple Agent Prompt
 *
 * Lightweight agent for simple Q&A without tools or orchestration.
 * Quick direct LLM responses with optional conversation history.
 */

import { createPrompt } from '../builder.js';
import { DEFAULT_CAPABILITIES } from '../sections/index.js';
import type { PromptConfig } from '../types.js';

/**
 * Get the system prompt for SimpleAgent
 *
 * Uses platform-neutral `outputFormat` for format specification.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Format: 'telegram-html', 'telegram-markdown', 'github-markdown', 'plain'
 *
 * @example
 * ```typescript
 * getSimpleAgentPrompt({ outputFormat: 'telegram-html' });
 * getSimpleAgentPrompt({ outputFormat: 'github-markdown' });
 * ```
 */
export function getSimpleAgentPrompt(config?: Partial<PromptConfig>): string {
  const builder = createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(DEFAULT_CAPABILITIES);

  // Apply output format if specified
  if (config?.outputFormat) {
    builder.withOutputFormat(config.outputFormat);
  }

  return builder.withGuidelines().withHistoryContext().build();
}
