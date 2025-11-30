/**
 * @duyetbot/prompts
 *
 * Centralized prompt management with TypeScript builder pattern.
 * Provides type-safe, composable prompts for all agents and platforms.
 *
 * @example
 * ```typescript
 * import { createPrompt, getTelegramPrompt, getSimpleAgentPrompt } from '@duyetbot/prompts';
 *
 * // Use builder for custom prompts
 * const prompt = createPrompt({ botName: '@mybot' })
 *   .withIdentity()
 *   .withPolicy()
 *   .withTools([{ name: 'search', description: 'Web search' }])
 *   .build();
 *
 * // Or use pre-built getters
 * const telegramPrompt = getTelegramPrompt();
 * const simplePrompt = getSimpleAgentPrompt();
 * ```
 */

// Agent Prompts
export {
  GITHUB_TOOLS,
  getAggregationPrompt,
  // Workers
  getCodeWorkerPrompt,
  getConfirmationPrompt,
  getDuyetInfoPrompt,
  getGitHubWorkerPrompt,
  getHITLAgentPrompt,
  getMemoryAgentPrompt,
  getOrchestratorPrompt,
  getPlanningPrompt,
  getResearchWorkerPrompt,
  getRouterPrompt,
  // Core agents
  getSimpleAgentPrompt,
  RESEARCH_TOOLS,
} from './agents/index.js';
// Builder
export { createPrompt, PromptBuilder } from './builder.js';
// Configuration
export { config } from './config.js';
// Platform Prompts
export {
  getGitHubBotPrompt,
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from './platforms/index.js';
// Sections (for advanced composition)
export {
  COMMON_TOOLS,
  capabilitiesSection,
  codingStandardsSection,
  DEFAULT_CAPABILITIES,
  extendedCodingStandardsSection,
  guidelinesSection,
  historyContextSection,
  identitySection,
  policySection,
  toolsSection,
} from './sections/index.js';
// Types
export type {
  CustomSection,
  OutputFormat,
  Platform,
  PromptConfig,
  SectionRenderer,
  ToolDefinition,
} from './types.js';

// =============================================================================
// Backward Compatibility Exports
// These are deprecated but maintained for existing consumers
// =============================================================================

import { getSimpleAgentPrompt } from './agents/index.js';
import {
  getGitHubBotPrompt,
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from './platforms/index.js';

/**
 * @deprecated Use getTelegramPrompt() instead
 */
export const TELEGRAM_SYSTEM_PROMPT = getTelegramPrompt();

/**
 * @deprecated Use getGitHubBotPrompt() instead
 */
export const GITHUB_SYSTEM_PROMPT = getGitHubBotPrompt();

/**
 * @deprecated Use getSimpleAgentPrompt() instead
 */
export const GENERIC_SYSTEM_PROMPT = getSimpleAgentPrompt();

/**
 * @deprecated Use getTelegramWelcomeMessage() instead
 */
export const TELEGRAM_WELCOME_MESSAGE = getTelegramWelcomeMessage();

/**
 * @deprecated Use getTelegramHelpMessage() instead
 */
export const TELEGRAM_HELP_MESSAGE = getTelegramHelpMessage();

/**
 * @deprecated Use specific getter functions instead
 */
export type PromptContext = Partial<PromptConfig>;

/**
 * @deprecated Use createPrompt().forPlatform(platform).build() or specific getters
 */
export function getSystemPrompt(platform: Platform, _context?: PromptContext): string {
  switch (platform) {
    case 'telegram':
      return getTelegramPrompt();
    case 'github':
      return getGitHubBotPrompt();
    default:
      return getSimpleAgentPrompt();
  }
}

// Re-export Platform type for backward compatibility
import type { OutputFormat, Platform, PromptConfig } from './types.js';

/**
 * Convert platform string to OutputFormat
 *
 * Helper function for agents to convert context.platform to outputFormat
 * at runtime.
 *
 * @param platform - Platform string ('telegram', 'github', etc.)
 * @param options - Optional configuration
 * @param options.markdown - Use markdown format for Telegram (default: false, uses HTML)
 * @returns OutputFormat for use with prompt functions
 *
 * @example
 * ```typescript
 * // In agent's execute() method:
 * const outputFormat = platformToOutputFormat(context.platform);
 * const systemPrompt = getDuyetInfoPrompt({ outputFormat });
 *
 * // For Telegram with MarkdownV2:
 * const outputFormat = platformToOutputFormat('telegram', { markdown: true });
 * ```
 */
export function platformToOutputFormat(
  platform?: string,
  options?: { markdown?: boolean }
): OutputFormat {
  switch (platform) {
    case 'telegram':
      return options?.markdown ? 'telegram-markdown' : 'telegram-html';
    case 'github':
      return 'github-markdown';
    default:
      return 'plain';
  }
}
