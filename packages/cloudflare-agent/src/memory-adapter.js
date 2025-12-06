/**
 * Memory Adapter Interface
 *
 * Provides abstraction for memory persistence in ChatAgent
 */
/**
 * Convert internal Message to MemoryMessage format
 */
export function toMemoryMessage(message) {
  const memoryMessage = {
    role: message.role,
    content: message.content,
    timestamp: Date.now(),
  };
  if (message.toolCallId) {
    memoryMessage.metadata = {
      toolCallId: message.toolCallId,
      ...(message.name && { name: message.name }),
    };
  }
  return memoryMessage;
}
/**
 * Convert MemoryMessage to internal Message format
 */
export function fromMemoryMessage(memoryMessage) {
  const message = {
    role: memoryMessage.role,
    content: memoryMessage.content,
  };
  if (memoryMessage.metadata?.toolCallId) {
    message.toolCallId = memoryMessage.metadata.toolCallId;
  }
  if (memoryMessage.metadata?.name) {
    message.name = memoryMessage.metadata.name;
  }
  return message;
}
