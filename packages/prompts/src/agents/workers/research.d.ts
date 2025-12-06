/**
 * Research Worker Prompt
 *
 * Specialized worker for research-related tasks:
 * - Information gathering and synthesis
 * - Documentation lookup
 * - Web search and summarization
 * - Technical research and comparison
 *
 * Applies Grok 4.1 patterns:
 * - Deep and wide search methodology
 * - Multi-stakeholder source distribution
 * - Structured transparent reasoning
 */
import type { PromptConfig, ToolDefinition } from '../../types.js';
/**
 * Research tools
 */
export declare const RESEARCH_TOOLS: ToolDefinition[];
/**
 * Get the system prompt for ResearchWorker
 * @param config - Optional configuration overrides
 */
export declare function getResearchWorkerPrompt(config?: Partial<PromptConfig>): string;
//# sourceMappingURL=research.d.ts.map
