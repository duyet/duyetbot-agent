/**
 * History management utilities
 */
/**
 * Trim message history to max length, keeping most recent
 */
export function trimHistory(messages, maxLength) {
  if (messages.length <= maxLength) {
    return messages;
  }
  return messages.slice(-maxLength);
}
/**
 * Format messages for LLM API call
 */
export function formatForLLM(messages, systemPrompt) {
  const llmMessages = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    const llmMsg = {
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
export function getMessageText(messages) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}
