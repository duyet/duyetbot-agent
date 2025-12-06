/**
 * GitHub Platform Prompt
 *
 * GitHub-optimized prompt for issue/PR interactions.
 * Applies Claude and Grok best practices:
 * - Clear, structured instructions with XML tags
 * - Goal → Constraints → Deliverables framing
 * - Rich formatting: ASCII diagrams, links, code blocks
 * - Specific examples for desired behavior
 */
import type { PromptConfig } from '../types.js';
/**
 * Get the system prompt for GitHub bot
 * @param customConfig - Optional configuration overrides
 */
export declare function getGitHubBotPrompt(customConfig?: Partial<PromptConfig>): string;
//# sourceMappingURL=github.d.ts.map
