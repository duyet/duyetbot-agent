/**
 * Agent Provider Interface
 *
 * Combines LLM provider capabilities with platform transport operations.
 * Defines the contract for unified agent execution across different platforms.
 */
/**
 * Create a ProviderExecutionContext from ParsedInput
 *
 * @param input - ParsedInput containing extracted message data
 * @returns ProviderExecutionContext
 */
export function createProviderContext(input) {
  return {
    text: input.text,
    userId: input.userId,
    chatId: input.chatId,
    username: input.username,
    messageRef: input.messageRef,
    replyTo: input.replyTo,
    metadata: input.metadata,
    createdAt: Date.now(),
  };
}
