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

// Configuration
export { config } from './config.js';

// Types
export type {
  Platform,
  PromptConfig,
  ToolDefinition,
  CustomSection,
  SectionRenderer,
  TelegramParseMode,
} from './types.js';

// Builder
export { PromptBuilder, createPrompt } from './builder.js';

// Sections (for advanced composition)
export {
  identitySection,
  policySection,
  capabilitiesSection,
  toolsSection,
  guidelinesSection,
  codingStandardsSection,
  extendedCodingStandardsSection,
  historyContextSection,
  DEFAULT_CAPABILITIES,
  COMMON_TOOLS,
} from './sections/index.js';

// Agent Prompts
export {
  // Core agents
  getSimpleAgentPrompt,
  getRouterPrompt,
  getOrchestratorPrompt,
  getPlanningPrompt,
  getAggregationPrompt,
  getHITLAgentPrompt,
  getConfirmationPrompt,
  getDuyetInfoPrompt,
  getMemoryAgentPrompt,
  // Workers
  getCodeWorkerPrompt,
  getResearchWorkerPrompt,
  getGitHubWorkerPrompt,
  RESEARCH_TOOLS,
  GITHUB_TOOLS,
} from './agents/index.js';

// Platform Prompts
export {
  getTelegramPrompt,
  getTelegramWelcomeMessage,
  getTelegramHelpMessage,
  getGitHubBotPrompt,
} from './platforms/index.js';

// =============================================================================
// Backward Compatibility Exports
// These are deprecated but maintained for existing consumers
// =============================================================================

import { getSimpleAgentPrompt } from './agents/index.js';
import {
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from './platforms/index.js';
import { getGitHubBotPrompt } from './platforms/index.js';

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
import type { Platform, PromptConfig } from './types.js';
