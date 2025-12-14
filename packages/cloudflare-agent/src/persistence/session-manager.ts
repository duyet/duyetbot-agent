/**
 * Session Manager
 *
 * Provides utilities for session ID generation and management.
 * Handles platform-specific session ID formats and lifecycle operations.
 */

import type { SessionId } from '../adapters/message-persistence/types.js';

/**
 * Session Manager for handling session ID operations
 */
export class SessionManager {
  /**
   * Create a session ID from platform, user ID, and chat ID
   *
   * Normalizes all inputs to strings for consistent handling.
   *
   * @param platform - Platform identifier (telegram, github, api, etc.)
   * @param userId - User ID on platform (can be string or number)
   * @param chatId - Chat/conversation ID on platform (can be string or number)
   * @returns SessionId object
   *
   * @example
   * ```typescript
   * const sessionId = SessionManager.createSessionId('telegram', 123456789, -1001234567890);
   * // { platform: 'telegram', userId: '123456789', chatId: '-1001234567890' }
   * ```
   */
  static createSessionId(
    platform: string,
    userId: string | number,
    chatId: string | number
  ): SessionId {
    return {
      platform,
      userId: String(userId),
      chatId: String(chatId),
    };
  }

  /**
   * Format session ID as string key for storage
   *
   * Uses consistent format: "platform:userId:chatId"
   *
   * @param sessionId - Session identifier
   * @returns Formatted session key string
   *
   * @example
   * ```typescript
   * const key = SessionManager.formatSessionKey({
   *   platform: 'telegram',
   *   userId: '123456789',
   *   chatId: '-1001234567890'
   * });
   * // 'telegram:123456789:-1001234567890'
   * ```
   */
  static formatSessionKey(sessionId: SessionId): string {
    return `${sessionId.platform}:${sessionId.userId}:${sessionId.chatId}`;
  }

  /**
   * Parse session key string back to SessionId
   *
   * Inverse of formatSessionKey.
   *
   * @param sessionKey - Formatted session key string
   * @returns SessionId object, or null if invalid format
   *
   * @example
   * ```typescript
   * const sessionId = SessionManager.parseSessionKey('telegram:123456789:-1001234567890');
   * // { platform: 'telegram', userId: '123456789', chatId: '-1001234567890' }
   * ```
   */
  static parseSessionKey(sessionKey: string): SessionId | null {
    const parts = sessionKey.split(':');

    if (parts.length < 3) {
      return null;
    }

    // Handle cases where chatId might contain colons (rejoin remaining parts)
    const [platform, userId, ...chatIdParts] = parts;

    // Ensure platform and userId are defined
    if (!platform || !userId) {
      return null;
    }

    const chatId = chatIdParts.join(':');

    return {
      platform,
      userId,
      chatId,
    };
  }
}
