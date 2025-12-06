/**
 * Delegation Templates
 *
 * Structured prompts for lead-to-subagent delegation.
 * Following Anthropic's principle: "Lead agents must provide objectives,
 * output formats, tool guidance, and clear task boundaries."
 */
import type { DelegationContext, SubagentType } from './types.js';
/**
 * Main delegation template
 * This is the core template used to delegate tasks to subagents
 */
export declare function buildDelegationPrompt(context: DelegationContext): string;
/**
 * Get system prompt for a specific subagent type
 */
export declare function getSubagentSystemPrompt(type: SubagentType): string;
/**
 * Build the complete prompt for a subagent including system and delegation
 */
export declare function buildSubagentPrompt(
  type: SubagentType,
  delegationContext: DelegationContext
): {
  systemPrompt: string;
  userPrompt: string;
};
/**
 * Get default tool guidance for a subagent type
 */
export declare function getDefaultToolGuidance(type: SubagentType): string[];
/**
 * Get default boundaries for a subagent type
 */
export declare function getDefaultBoundaries(type: SubagentType): string[];
/**
 * Format dependency results for context
 */
export declare function formatDependencyContext(
  results: Map<
    string,
    {
      success: boolean;
      content?: string;
      data?: unknown;
    }
  >
): string;
//# sourceMappingURL=delegation-templates.d.ts.map
