/**
 * History management utilities
 */

import type { LLMMessage, Message } from './types.js';

/**
 * Trim message history to max length, keeping most recent
 */
export function trimHistory(messages: Message[], maxLength: number): Message[] {
  if (messages.length <= maxLength) {
    return messages;
  }
  return messages.slice(-maxLength);
}

/**
 * Format messages for LLM API call
 */
export function formatForLLM(messages: Message[], systemPrompt: string): LLMMessage[] {
  const llmMessages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    const llmMsg: LLMMessage = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.toolCallId) {
      llmMsg.tool_call_id = msg.toolCallId;
    }

    if (msg.name) {
      llmMsg.name = msg.name;
    }

    llmMessages.push(llmMsg);
  }

  return llmMessages;
}

/**
 * Extract text content from messages
 */
export function getMessageText(messages: Message[]): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}
