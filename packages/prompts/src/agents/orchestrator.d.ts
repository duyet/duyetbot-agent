/**
 * Orchestrator Agent Prompt
 *
 * Complex task decomposition and orchestration.
 * Plans tasks into atomic steps, executes in parallel, aggregates results.
 */
import type { PromptConfig } from '../types.js';
/**
 * Get the system prompt for OrchestratorAgent
 *
 * Uses platform-neutral `outputFormat` for format specification.
 *
 * @param config - Optional configuration overrides
 * @param config.outputFormat - Format: 'telegram-html', 'telegram-markdown', 'github-markdown', 'plain'
 */
export declare function getOrchestratorPrompt(config?: Partial<PromptConfig>): string;
/**
 * Get the planning prompt for task decomposition
 */
export declare function getPlanningPrompt(): string;
/**
 * Get the aggregation prompt for result synthesis
 */
export declare function getAggregationPrompt(): string;
//# sourceMappingURL=orchestrator.d.ts.map
