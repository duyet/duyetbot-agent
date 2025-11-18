/**
 * KV Message Store
 *
 * Stores session messages in Cloudflare KV for fast access
 */

import type { LLMMessage } from "@/providers/types";

export interface MessageStore {
  /**
   * Append message to session
   */
  append(userId: string, sessionId: string, message: LLMMessage): Promise<void>;

  /**
   * Get all messages for session
   */
  getAll(userId: string, sessionId: string): Promise<LLMMessage[]>;

  /**
   * Get recent messages (last N)
   */
  getRecent(
    userId: string,
    sessionId: string,
    limit: number,
  ): Promise<LLMMessage[]>;

  /**
   * Clear all messages for session
   */
  clear(userId: string, sessionId: string): Promise<void>;

  /**
   * Get message count for session
   */
  count(userId: string, sessionId: string): Promise<number>;
}

export class KVMessageStore implements MessageStore {
  private readonly MAX_MESSAGES = 10000;

  constructor(private kv: KVNamespace) {}

  /**
   * Generate KV key for session messages
   */
  private getKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:messages`;
  }

  /**
   * Append message to session
   */
  async append(
    userId: string,
    sessionId: string,
    message: LLMMessage,
  ): Promise<void> {
    const key = this.getKey(userId, sessionId);
    const messages = await this.getAll(userId, sessionId);

    // Add new message
    messages.push(message);

    // Trim to max messages (keep most recent)
    if (messages.length > this.MAX_MESSAGES) {
      messages.splice(0, messages.length - this.MAX_MESSAGES);
    }

    // Store back to KV
    await this.kv.put(key, JSON.stringify(messages));
  }

  /**
   * Get all messages for session
   */
  async getAll(userId: string, sessionId: string): Promise<LLMMessage[]> {
    const key = this.getKey(userId, sessionId);
    const value = await this.kv.get(key, "text");

    if (!value) {
      return [];
    }

    try {
      return JSON.parse(value) as LLMMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Get recent messages (last N)
   */
  async getRecent(
    userId: string,
    sessionId: string,
    limit: number,
  ): Promise<LLMMessage[]> {
    const messages = await this.getAll(userId, sessionId);
    return messages.slice(-limit);
  }

  /**
   * Clear all messages for session
   */
  async clear(userId: string, sessionId: string): Promise<void> {
    const key = this.getKey(userId, sessionId);
    await this.kv.delete(key);
  }

  /**
   * Get message count for session
   */
  async count(userId: string, sessionId: string): Promise<number> {
    const messages = await this.getAll(userId, sessionId);
    return messages.length;
  }

  /**
   * Delete all messages for user (GDPR compliance)
   */
  async deleteAllForUser(userId: string): Promise<void> {
    // Note: KV doesn't support prefix deletion directly
    // In production, you would list all keys with prefix and delete them
    // For now, this is a placeholder that would need to be implemented
    // using KV list() with prefix filtering
    const prefix = `users:${userId}:`;

    // This is a simplified implementation
    // In production, you'd need to:
    // 1. List all keys with this prefix
    // 2. Delete each key
    // 3. Handle pagination if there are many keys

    console.warn(
      `deleteAllForUser called for ${userId} - implement KV list/delete`,
    );
  }
}

/**
 * Create message store
 */
export function createMessageStore(kv: KVNamespace): MessageStore {
  return new KVMessageStore(kv);
}
