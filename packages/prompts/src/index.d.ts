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
export {
  GITHUB_TOOLS,
  getAggregationPrompt,
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
  getSimpleAgentPrompt,
  RESEARCH_TOOLS,
} from './agents/index.js';
export { createPrompt, PromptBuilder } from './builder.js';
export { config } from './config.js';
export {
  getGitHubBotPrompt,
  getTelegramHelpMessage,
  getTelegramPrompt,
  getTelegramWelcomeMessage,
} from './platforms/index.js';
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
export type {
  CustomSection,
  OutputFormat,
  Platform,
  PromptConfig,
  SectionRenderer,
  ToolDefinition,
} from './types.js';
import type { OutputFormat } from './types.js';
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
export declare function platformToOutputFormat(
  platform?: string,
  options?: {
    markdown?: boolean;
  }
): OutputFormat;
//# sourceMappingURL=index.d.ts.map
