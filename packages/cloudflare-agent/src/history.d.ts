/**
 * History management utilities
 */
import type { LLMMessage, Message } from './types.js';
/**
 * Trim message history to max length, keeping most recent
 */
export declare function trimHistory(messages: Message[], maxLength: number): Message[];
/**
 * Format messages for LLM API call
 */
export declare function formatForLLM(messages: Message[], systemPrompt: string): LLMMessage[];
/**
 * Extract text content from messages
 */
export declare function getMessageText(messages: Message[]): string;
//# sourceMappingURL=history.d.ts.map
