/**
 * GitHub Worker Prompt
 *
 * Specialized worker for GitHub operations:
 * - PR review and management
 * - Issue handling
 * - Code comments
 * - Repository operations
 *
 * Applies Claude and Grok best practices:
 * - Clear, structured instructions with XML tags
 * - Goal → Constraints → Deliverables framing
 * - Rich formatting: ASCII diagrams, links, code blocks
 */
import type { PromptConfig, ToolDefinition } from '../../types.js';
/**
 * GitHub tools
 */
export declare const GITHUB_TOOLS: ToolDefinition[];
/**
 * Get the system prompt for GitHubWorker
 * @param config - Optional configuration overrides
 */
export declare function getGitHubWorkerPrompt(config?: Partial<PromptConfig>): string;
//# sourceMappingURL=github.d.ts.map
