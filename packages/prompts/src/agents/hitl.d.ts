/**
 * HITL Agent Prompt
 *
 * Human-in-the-Loop agent for tool confirmation workflows.
 * Intercepts tool calls, requests user approval, executes approved tools.
 */
import type { PromptConfig } from '../types.js';
/**
 * Get the system prompt for HITLAgent
 * @param config - Optional configuration overrides
 */
export declare function getHITLAgentPrompt(config?: Partial<PromptConfig>): string;
/**
 * Get the confirmation request prompt template
 */
export declare function getConfirmationPrompt(operation: string, details: string): string;
//# sourceMappingURL=hitl.d.ts.map
