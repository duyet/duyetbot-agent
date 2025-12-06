/**
 * Duyet Info Agent Prompt
 *
 * MCP-enabled agent for queries about Duyet's blog and personal information.
 * Combines blog content discovery with personal info (CV, contact, skills, etc.)
 */
import type { PromptConfig } from '../types.js';
/**
 * Get the system prompt for DuyetInfoAgent
 *
 * Uses platform-neutral `outputFormat` for format specification.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Format: 'telegram-html', 'telegram-markdown', 'github-markdown', 'plain'
 *
 * @example
 * ```typescript
 * getDuyetInfoPrompt({ outputFormat: 'telegram-html' });
 * getDuyetInfoPrompt({ outputFormat: 'github-markdown' });
 * ```
 */
export declare function getDuyetInfoPrompt(config?: Partial<PromptConfig>): string;
//# sourceMappingURL=duyet-info.d.ts.map
