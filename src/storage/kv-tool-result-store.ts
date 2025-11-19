/**
 * KV Tool Result Store
 *
 * Stores tool execution results in Cloudflare KV
 */

import type { ToolResult } from '@/agent/session';

export interface ToolResultStore {
  /**
   * Append tool result to session
   */
  append(userId: string, sessionId: string, result: ToolResult): Promise<void>;

  /**
   * Get all tool results for session
   */
  getAll(userId: string, sessionId: string): Promise<ToolResult[]>;

  /**
   * Get recent tool results (last N)
   */
  getRecent(userId: string, sessionId: string, limit: number): Promise<ToolResult[]>;

  /**
   * Clear all tool results for session
   */
  clear(userId: string, sessionId: string): Promise<void>;

  /**
   * Get tool result count for session
   */
  count(userId: string, sessionId: string): Promise<number>;
}

export class KVToolResultStore implements ToolResultStore {
  private readonly MAX_RESULTS = 1000;

  constructor(private kv: KVNamespace) {}

  /**
   * Generate KV key for session tool results
   */
  private getKey(userId: string, sessionId: string): string {
    return `users:${userId}:sessions:${sessionId}:tools`;
  }

  /**
   * Append tool result to session
   */
  async append(userId: string, sessionId: string, result: ToolResult): Promise<void> {
    const key = this.getKey(userId, sessionId);
    const results = await this.getAll(userId, sessionId);

    // Add new result with timestamp
    results.push({
      ...result,
      timestamp: result.timestamp || new Date(),
    });

    // Trim to max results (keep most recent)
    if (results.length > this.MAX_RESULTS) {
      results.splice(0, results.length - this.MAX_RESULTS);
    }

    // Store back to KV
    await this.kv.put(key, JSON.stringify(results));
  }

  /**
   * Get all tool results for session
   */
  async getAll(userId: string, sessionId: string): Promise<ToolResult[]> {
    const key = this.getKey(userId, sessionId);
    const value = await this.kv.get(key, 'text');

    if (!value) {
      return [];
    }

    try {
      const results = JSON.parse(value) as ToolResult[];
      // Convert timestamp strings back to Date objects
      return results.map((r) => ({
        ...r,
        timestamp: r.timestamp ? new Date(r.timestamp) : undefined,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get recent tool results (last N)
   */
  async getRecent(userId: string, sessionId: string, limit: number): Promise<ToolResult[]> {
    const results = await this.getAll(userId, sessionId);
    return results.slice(-limit);
  }

  /**
   * Clear all tool results for session
   */
  async clear(userId: string, sessionId: string): Promise<void> {
    const key = this.getKey(userId, sessionId);
    await this.kv.delete(key);
  }

  /**
   * Get tool result count for session
   */
  async count(userId: string, sessionId: string): Promise<number> {
    const results = await this.getAll(userId, sessionId);
    return results.length;
  }

  /**
   * Delete all tool results for user (GDPR compliance)
   */
  async deleteAllForUser(userId: string): Promise<void> {
    // Note: KV doesn't support prefix deletion directly
    // See KVMessageStore for implementation notes
    const _ = `users:${userId}:`;
    console.warn(`deleteAllForUser called for ${userId} - implement KV list/delete`);
  }
}

/**
 * Create tool result store
 */
export function createToolResultStore(kv: KVNamespace): ToolResultStore {
  return new KVToolResultStore(kv);
}
