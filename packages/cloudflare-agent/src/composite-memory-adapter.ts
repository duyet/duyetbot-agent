/**
 * Composite Memory Adapter
 *
 * Combines multiple memory backends with configurable strategies:
 * - primary-first: Use primary for reads, fallback to secondary
 * - parallel: Query both, merge results
 * - mem0-for-search: D1 for getMemory, mem0 for searchMemory
 */

import type {
  LongTermMemoryEntry,
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveLongTermMemoryResult,
  SaveMemoryResult,
  SaveShortTermMemoryResult,
  SessionInfo,
  ShortTermMemoryEntry,
} from './memory-adapter.js';
import type { Message } from './types.js';

/**
 * Strategy for combining memory backends
 */
export type CompositeStrategy = 'primary-first' | 'parallel' | 'mem0-for-search';

/**
 * Configuration for Composite Memory Adapter
 */
export interface CompositeMemoryConfig {
  /** Primary memory adapter (e.g., D1) */
  primary: MemoryAdapter;
  /** Secondary memory adapter (e.g., mem0) */
  secondary?: MemoryAdapter;
  /** Strategy for combining backends */
  strategy: CompositeStrategy;
}

/**
 * Composite Memory Adapter implementation
 */
export class CompositeMemoryAdapter implements MemoryAdapter {
  private primary: MemoryAdapter;
  private secondary: MemoryAdapter | undefined;
  private strategy: CompositeStrategy;

  constructor(config: CompositeMemoryConfig) {
    this.primary = config.primary;
    this.secondary = config.secondary;
    this.strategy = config.strategy;
  }

  /**
   * Get messages for a session
   */
  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    switch (this.strategy) {
      case 'primary-first':
        return this.getPrimaryFirst(sessionId, options);
      case 'parallel':
        return this.getParallel(sessionId, options);
      case 'mem0-for-search':
        // Use primary (D1) for getMemory
        return this.primary.getMemory(sessionId, options);
    }
  }

  /**
   * Save messages for a session
   * Always write to both (primary sync, secondary async/fire-and-forget)
   */
  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    // Primary write (blocking)
    const primaryResult = await this.primary.saveMemory(sessionId, messages, metadata);

    // Secondary write (fire-and-forget)
    if (this.secondary) {
      this.secondary.saveMemory(sessionId, messages, metadata).catch((err) => {
        console.warn('Secondary saveMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Search across memory
   * Always try both and merge (deduplicate by content)
   */
  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    if (this.strategy === 'mem0-for-search' && this.secondary?.searchMemory) {
      // Use secondary (mem0) for search
      return this.secondary.searchMemory(query, options);
    }

    // For other strategies, merge results from both
    const promises: Promise<MemorySearchResult[]>[] = [];

    if (this.primary.searchMemory) {
      promises.push(this.primary.searchMemory(query, options));
    }

    if (this.secondary?.searchMemory) {
      promises.push(this.secondary.searchMemory(query, options));
    }

    const results = await Promise.allSettled(promises);
    const allResults: MemorySearchResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    }

    // Deduplicate by content and merge
    return this.deduplicateSearchResults(allResults, options?.limit);
  }

  /**
   * List all sessions
   */
  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    if (!this.primary.listSessions) {
      return { sessions: [], total: 0 };
    }

    switch (this.strategy) {
      case 'primary-first':
        try {
          return await this.primary.listSessions(options);
        } catch {
          if (this.secondary?.listSessions) {
            return this.secondary.listSessions(options);
          }
          return { sessions: [], total: 0 };
        }
      case 'parallel':
      case 'mem0-for-search': {
        // For parallel/mem0-for-search, merge sessions from both
        const promises: Promise<{ sessions: SessionInfo[]; total: number }>[] = [
          this.primary.listSessions(options),
        ];

        if (this.secondary?.listSessions) {
          promises.push(this.secondary.listSessions(options));
        }

        const results = await Promise.allSettled(promises);
        const allSessions: SessionInfo[] = [];

        for (const result of results) {
          if (result.status === 'fulfilled') {
            allSessions.push(...result.value.sessions);
          }
        }

        // Deduplicate by session ID
        const uniqueSessions = this.deduplicateSessions(allSessions);
        return {
          sessions: uniqueSessions.slice(0, options?.limit),
          total: uniqueSessions.length,
        };
      }
    }
  }

  /**
   * Save a short-term memory item
   */
  async saveShortTermMemory(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult> {
    if (!this.primary.saveShortTermMemory) {
      return { key, expiresAt: Date.now() + (ttlSeconds || 86400) * 1000, success: false };
    }

    const primaryResult = await this.primary.saveShortTermMemory(sessionId, key, value, ttlSeconds);

    // Fire-and-forget to secondary
    if (this.secondary?.saveShortTermMemory) {
      this.secondary.saveShortTermMemory(sessionId, key, value, ttlSeconds).catch((err) => {
        console.warn('Secondary saveShortTermMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Get a short-term memory item by key
   */
  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null> {
    if (!this.primary.getShortTermMemory) {
      return null;
    }

    switch (this.strategy) {
      case 'primary-first':
      case 'mem0-for-search':
        try {
          const result = await this.primary.getShortTermMemory(sessionId, key);
          if (result) {
            return result;
          }
        } catch {
          // Fallback to secondary
        }

        if (this.secondary?.getShortTermMemory) {
          return this.secondary.getShortTermMemory(sessionId, key);
        }
        return null;

      case 'parallel': {
        // Try both in parallel, return first non-null
        const promises: Promise<ShortTermMemoryEntry | null>[] = [
          this.primary.getShortTermMemory(sessionId, key),
        ];

        if (this.secondary?.getShortTermMemory) {
          promises.push(this.secondary.getShortTermMemory(sessionId, key));
        }

        const results = await Promise.allSettled(promises);
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            return result.value;
          }
        }
        return null;
      }
    }
  }

  /**
   * List all short-term memory items for a session
   */
  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryEntry[]> {
    if (!this.primary.listShortTermMemory) {
      return [];
    }

    const promises: Promise<ShortTermMemoryEntry[]>[] = [
      this.primary.listShortTermMemory(sessionId),
    ];

    if (this.secondary?.listShortTermMemory) {
      promises.push(this.secondary.listShortTermMemory(sessionId));
    }

    const results = await Promise.allSettled(promises);
    const allEntries: ShortTermMemoryEntry[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEntries.push(...result.value);
      }
    }

    // Deduplicate by key
    return this.deduplicateShortTermMemory(allEntries);
  }

  /**
   * Delete a short-term memory item
   */
  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    if (!this.primary.deleteShortTermMemory) {
      return false;
    }

    const primaryResult = await this.primary.deleteShortTermMemory(sessionId, key);

    // Fire-and-forget to secondary
    if (this.secondary?.deleteShortTermMemory) {
      this.secondary.deleteShortTermMemory(sessionId, key).catch((err) => {
        console.warn('Secondary deleteShortTermMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Save a long-term memory item
   */
  async saveLongTermMemory(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult> {
    if (!this.primary.saveLongTermMemory) {
      return { id: `local-${Date.now()}`, created: false, success: false };
    }

    const primaryResult = await this.primary.saveLongTermMemory(
      category,
      key,
      value,
      importance,
      metadata
    );

    // Fire-and-forget to secondary
    if (this.secondary?.saveLongTermMemory) {
      this.secondary.saveLongTermMemory(category, key, value, importance, metadata).catch((err) => {
        console.warn('Secondary saveLongTermMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Get long-term memory items by category and/or key
   */
  async getLongTermMemory(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]> {
    if (!this.primary.getLongTermMemory) {
      return [];
    }

    const promises: Promise<LongTermMemoryEntry[]>[] = [this.primary.getLongTermMemory(filters)];

    if (this.secondary?.getLongTermMemory) {
      promises.push(this.secondary.getLongTermMemory(filters));
    }

    const results = await Promise.allSettled(promises);
    const allEntries: LongTermMemoryEntry[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allEntries.push(...result.value);
      }
    }

    // Deduplicate by key and category
    return this.deduplicateLongTermMemory(allEntries, filters?.limit);
  }

  /**
   * Update a long-term memory item
   */
  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    if (!this.primary.updateLongTermMemory) {
      return false;
    }

    const primaryResult = await this.primary.updateLongTermMemory(id, updates);

    // Fire-and-forget to secondary
    if (this.secondary?.updateLongTermMemory) {
      this.secondary.updateLongTermMemory(id, updates).catch((err) => {
        console.warn('Secondary updateLongTermMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Delete a long-term memory item
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    if (!this.primary.deleteLongTermMemory) {
      return false;
    }

    const primaryResult = await this.primary.deleteLongTermMemory(id);

    // Fire-and-forget to secondary
    if (this.secondary?.deleteLongTermMemory) {
      this.secondary.deleteLongTermMemory(id).catch((err) => {
        console.warn('Secondary deleteLongTermMemory failed:', err);
      });
    }

    return primaryResult;
  }

  /**
   * Search memory using natural language query
   */
  async searchMemoryByQuery(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>> {
    if (this.strategy === 'mem0-for-search' && this.secondary?.searchMemoryByQuery) {
      // Use secondary (mem0) for search
      return this.secondary.searchMemoryByQuery(query, filters);
    }

    const promises: Promise<
      Array<{ id: string; content: string; category: string; score: number }>
    >[] = [];

    if (this.primary.searchMemoryByQuery) {
      promises.push(this.primary.searchMemoryByQuery(query, filters));
    }

    if (this.secondary?.searchMemoryByQuery) {
      promises.push(this.secondary.searchMemoryByQuery(query, filters));
    }

    const results = await Promise.allSettled(promises);
    const allResults: Array<{ id: string; content: string; category: string; score: number }> = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    }

    // Deduplicate by content and sort by score
    return this.deduplicateQueryResults(allResults, filters?.limit);
  }

  /**
   * Get memory from primary first, fallback to secondary
   */
  private async getPrimaryFirst(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    try {
      const result = await this.primary.getMemory(sessionId, options);
      if (result.messages.length > 0) {
        return result;
      }
    } catch {
      // Fallback to secondary
    }

    if (this.secondary) {
      return this.secondary.getMemory(sessionId, options);
    }

    return { sessionId, messages: [], metadata: {} };
  }

  /**
   * Get memory from both in parallel and merge
   */
  private async getParallel(
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    const promises: Promise<MemoryData>[] = [this.primary.getMemory(sessionId, options)];

    if (this.secondary) {
      promises.push(this.secondary.getMemory(sessionId, options));
    }

    const results = await Promise.allSettled(promises);
    const allMessages: MemoryData['messages'] = [];
    let metadata = {};

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMessages.push(...result.value.messages);
        metadata = { ...metadata, ...result.value.metadata };
      }
    }

    // Sort by timestamp and deduplicate
    const sortedMessages = allMessages.sort((a, b) => {
      const timeA = a.timestamp || 0;
      const timeB = b.timestamp || 0;
      return timeA - timeB;
    });

    // Deduplicate by content
    const uniqueMessages = this.deduplicateMessages(sortedMessages);

    // Apply limit
    const limitedMessages = options?.limit
      ? uniqueMessages.slice(options.offset || 0, (options.offset || 0) + options.limit)
      : uniqueMessages;

    return {
      sessionId,
      messages: limitedMessages,
      metadata,
    };
  }

  /**
   * Deduplicate messages by content
   */
  private deduplicateMessages(messages: MemoryData['messages']): MemoryData['messages'] {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      const key = `${msg.role}:${msg.content}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Deduplicate search results by content similarity
   */
  private deduplicateSearchResults(
    results: MemorySearchResult[],
    limit?: number
  ): MemorySearchResult[] {
    const seen = new Set<string>();
    const unique: MemorySearchResult[] = [];

    // Sort by score first
    const sorted = results.sort((a, b) => b.score - a.score);

    for (const result of sorted) {
      const key = result.message.content.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return limit ? unique.slice(0, limit) : unique;
  }

  /**
   * Deduplicate sessions by ID
   */
  private deduplicateSessions(sessions: SessionInfo[]): SessionInfo[] {
    const seen = new Map<string, SessionInfo>();

    for (const session of sessions) {
      const existing = seen.get(session.id);
      if (!existing || session.updatedAt > existing.updatedAt) {
        seen.set(session.id, session);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Deduplicate short-term memory by key
   */
  private deduplicateShortTermMemory(entries: ShortTermMemoryEntry[]): ShortTermMemoryEntry[] {
    const seen = new Map<string, ShortTermMemoryEntry>();

    for (const entry of entries) {
      const existing = seen.get(entry.key);
      if (!existing || entry.expiresAt > existing.expiresAt) {
        seen.set(entry.key, entry);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Deduplicate long-term memory by key and category
   */
  private deduplicateLongTermMemory(
    entries: LongTermMemoryEntry[],
    limit?: number
  ): LongTermMemoryEntry[] {
    const seen = new Map<string, LongTermMemoryEntry>();

    for (const entry of entries) {
      const key = `${entry.category}:${entry.key}`;
      const existing = seen.get(key);
      if (!existing || entry.updatedAt > existing.updatedAt) {
        seen.set(key, entry);
      }
    }

    const unique = Array.from(seen.values()).sort((a, b) => b.importance - a.importance);
    return limit ? unique.slice(0, limit) : unique;
  }

  /**
   * Deduplicate query results by content
   */
  private deduplicateQueryResults(
    results: Array<{ id: string; content: string; category: string; score: number }>,
    limit?: number
  ): Array<{ id: string; content: string; category: string; score: number }> {
    const seen = new Set<string>();
    const unique: Array<{ id: string; content: string; category: string; score: number }> = [];

    // Sort by score first
    const sorted = results.sort((a, b) => b.score - a.score);

    for (const result of sorted) {
      const key = result.content.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(result);
      }
    }

    return limit ? unique.slice(0, limit) : unique;
  }
}

/**
 * Create a composite memory adapter
 */
export function createCompositeMemoryAdapter(
  config: CompositeMemoryConfig
): CompositeMemoryAdapter {
  return new CompositeMemoryAdapter(config);
}
