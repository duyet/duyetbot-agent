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
 * Supports platform-neutral `outputFormat` (preferred) or legacy `platform` config.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Platform-neutral format: 'telegram-html', 'github-markdown', etc.
 * @param config.platform - Legacy platform config (use outputFormat instead)
 *
 * @example
 * ```typescript
 * // Preferred: use outputFormat for shared agents
 * getSimpleAgentPrompt({ outputFormat: 'telegram-html' });
 *
 * // Legacy: platform-based config still supported
 * getSimpleAgentPrompt({ platform: 'telegram', telegramParseMode: 'HTML' });
 * ```
 */
export function getSimpleAgentPrompt(config?: Partial<PromptConfig>): string {
  const builder = createPrompt(config)
    .withIdentity()
    .withPolicy()
    .withCapabilities(DEFAULT_CAPABILITIES);

  // Prefer outputFormat (platform-neutral), fall back to platform config
  if (config?.outputFormat) {
    builder.withOutputFormat(config.outputFormat);
  } else if (config?.platform === 'telegram') {
    builder.withTelegramParseMode(config.telegramParseMode ?? 'HTML').forTelegram();
  } else if (config?.platform === 'github') {
    builder.forGitHub();
  } else if (config?.platform) {
    builder.forPlatform(config.platform);
  }

  return builder.withGuidelines().withHistoryContext().build();
}
