/**
 * Telegram Platform Prompt
 *
 * Mobile-optimized prompt for Telegram bot interactions.
 * Applies Claude and Grok best practices:
 * - Clear, explicit instructions with XML structure
 * - Goal → Constraints → Deliverables framing
 * - Specific examples for desired behavior
 * - Brief, direct responses
 */
import type { PromptConfig } from '../types.js';
/**
 * Get the system prompt for Telegram bot
 *
 * @param customConfig - Optional configuration overrides
 * @param customConfig.outputFormat - Use 'telegram-html' (default) or 'telegram-markdown'
 */
export declare function getTelegramPrompt(customConfig?: Partial<PromptConfig>): string;
/**
 * Telegram welcome message
 */
export declare function getTelegramWelcomeMessage(): string;
/**
 * Telegram help message
 */
export declare function getTelegramHelpMessage(): string;
//# sourceMappingURL=telegram.d.ts.map
