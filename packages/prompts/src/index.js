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
export function platformToOutputFormat(platform, options) {
  switch (platform) {
    case 'telegram':
      return options?.markdown ? 'telegram-markdown' : 'telegram-html';
    case 'github':
      return 'github-markdown';
    default:
      return 'plain';
  }
}
