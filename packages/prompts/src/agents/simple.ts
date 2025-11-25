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
 * @param config - Optional configuration overrides
 */
export function getSimpleAgentPrompt(config?: Partial<PromptConfig>): string {
  return createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(DEFAULT_CAPABILITIES)
    .withGuidelines()
    .withHistoryContext()
    .build();
}
