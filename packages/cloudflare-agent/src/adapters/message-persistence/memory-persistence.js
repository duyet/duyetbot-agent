/**
 * Memory-backed Message Persistence Adapter
 *
 * Stores messages in memory only (no persistent storage).
 * Useful for testing and environments without D1 database.
 * Messages are discarded when the process terminates.
 */
/**
 * Memory message persistence adapter implementation
 */
export class MemoryMessagePersistence {
  messagesBySession = new Map();
  /**
   * Persist messages in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param messages - Messages to persist
   * @param _eventId - Optional event ID (ignored)
   */
  persistMessages(sessionId, messages, _eventId) {
    const sessionIdStr = this.buildSessionId(sessionId);
    this.messagesBySession.set(sessionIdStr, [...messages]);
  }
  /**
   * Persist command and response in memory (synchronous, does not throw)
   *
   * @param sessionId - Session identifier
   * @param command - The slash command text
   * @param response - The response text
   * @param _eventId - Optional event ID (ignored)
   */
  persistCommand(sessionId, command, response, _eventId) {
    const sessionIdStr = this.buildSessionId(sessionId);
    const existing = this.messagesBySession.get(sessionIdStr) ?? [];
    const messages = [
      ...existing,
      { role: 'user', content: command },
      { role: 'assistant', content: response },
    ];
    this.messagesBySession.set(sessionIdStr, messages);
  }
  /**
   * Load messages from memory
   *
   * @param sessionId - Session identifier
   * @param maxHistory - Maximum number of messages to retrieve
   * @returns Array of messages
   */
  async loadMessages(sessionId, maxHistory) {
    const sessionIdStr = this.buildSessionId(sessionId);
    const messages = this.messagesBySession.get(sessionIdStr) ?? [];
    // Return the most recent messages up to maxHistory
    if (messages.length <= maxHistory) {
      return messages;
    }
    return messages.slice(-maxHistory);
  }
  /**
   * Clear all stored messages (useful for testing)
   */
  clear() {
    this.messagesBySession.clear();
  }
  /**
   * Get message count for a session (useful for testing)
   *
   * @param sessionId - Session identifier
   * @returns Number of messages stored
   */
  getMessageCount(sessionId) {
    const sessionIdStr = this.buildSessionId(sessionId);
    return this.messagesBySession.get(sessionIdStr)?.length ?? 0;
  }
  /**
   * Build session ID string from components
   *
   * @param sessionId - Session identifier components
   * @returns Session ID string (format: "platform:userId:chatId")
   */
  buildSessionId(sessionId) {
    return `${sessionId.platform}:${sessionId.userId}:${sessionId.chatId}`;
  }
}
