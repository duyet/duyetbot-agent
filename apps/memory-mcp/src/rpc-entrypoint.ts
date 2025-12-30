/**
 * Memory Service RPC Entrypoint
 *
 * Provides RPC methods for service binding communication.
 * This avoids HTTP overhead and blockConcurrencyWhile issues.
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { D1Storage } from './storage/d1.js';
import type { Env, LLMMessage } from './types.js';
import {
  addTask,
  completeTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskItem,
} from './tools/todo-tasks.js';

/**
 * Memory data returned from getMemory
 */
export interface MemoryData {
  sessionId: string;
  messages: LLMMessage[];
  metadata: Record<string, unknown>;
}

/**
 * Result from saveMemory operation
 */
export interface SaveMemoryResult {
  sessionId: string;
  savedCount: number;
  updatedAt: number;
}

/**
 * Search result item
 */
export interface MemorySearchResult {
  sessionId: string;
  message: LLMMessage;
  messageIndex: number;
}

/**
 * Session info
 */
export interface SessionInfo {
  id: string;
  title: string | null;
  state: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

/**
 * Memory Service RPC Entrypoint
 *
 * Exposes memory operations as RPC methods for service bindings.
 * Called directly by other workers without HTTP overhead.
 */
export class MemoryServiceEntrypoint extends WorkerEntrypoint<Env> {
  /**
   * Get storage instance
   */
  private getStorage(): D1Storage {
    return new D1Storage(this.env.DB);
  }

  /**
   * Get messages for a session
   */
  async getMemory(
    userId: string,
    sessionId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    const storage = this.getStorage();

    // Verify session belongs to user
    const session = await storage.getSession(sessionId);
    if (!session || session.user_id !== userId) {
      return { sessionId, messages: [], metadata: {} };
    }

    const messages = await storage.getMessages(sessionId, options);

    return {
      sessionId,
      messages,
      metadata: (session.metadata as Record<string, unknown>) || {},
    };
  }

  /**
   * Save messages to a session
   */
  async saveMemory(
    userId: string,
    sessionId: string | undefined,
    messages: LLMMessage[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    const storage = this.getStorage();

    // Generate session ID if not provided
    const finalSessionId = sessionId || crypto.randomUUID();

    // Check if session exists
    const existing = await storage.getSession(finalSessionId);
    if (existing && existing.user_id !== userId) {
      return {
        sessionId: finalSessionId,
        savedCount: 0,
        updatedAt: Date.now(),
      };
    }

    // Create session if it doesn't exist
    if (!existing) {
      const now = Date.now();
      await storage.createSession({
        id: finalSessionId,
        user_id: userId,
        title: null,
        state: 'active',
        metadata: metadata || null,
        created_at: now,
        updated_at: now,
      });
    }

    // Save messages
    const savedCount = await storage.saveMessages(finalSessionId, messages);

    // Update session metadata if provided
    if (metadata && existing) {
      await storage.updateSession(finalSessionId, { metadata });
    }

    return {
      sessionId: finalSessionId,
      savedCount,
      updatedAt: Date.now(),
    };
  }

  /**
   * Search across messages
   */
  async searchMemory(
    userId: string,
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    const storage = this.getStorage();

    const results = await storage.searchMessages(userId, query, {
      limit: options?.limit || 10,
      ...(options?.sessionId && { sessionId: options.sessionId }),
    });

    return results;
  }

  /**
   * List user's sessions
   */
  async listSessions(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      state?: 'active' | 'paused' | 'completed';
    }
  ): Promise<{ sessions: SessionInfo[]; total: number }> {
    const storage = this.getStorage();

    const result = await storage.listSessions(userId, {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      ...(options?.state && { state: options.state }),
    });

    // Enrich with message counts
    const sessions = await Promise.all(
      result.sessions.map(async (s) => ({
        id: s.id,
        title: s.title,
        state: s.state,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: await storage.getMessageCount(s.id),
      }))
    );

    return {
      sessions,
      total: result.total,
    };
  }

  /**
   * Set a short-term memory item
   */
  async setShortTermMemory(
    userId: string,
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds: number = 86400
  ): Promise<{ id: string; expiresAt: number }> {
    const storage = this.getStorage();
    const result = await storage.setShortTermMemory(sessionId, userId, key, value, ttlSeconds);
    return {
      id: result.id,
      expiresAt: result.expires_at,
    };
  }

  /**
   * Get a short-term memory item
   */
  async getShortTermMemory(
    sessionId: string,
    key: string
  ): Promise<{ value: string; expiresAt: number } | null> {
    const storage = this.getStorage();
    const result = await storage.getShortTermMemory(sessionId, key);
    if (!result) {
      return null;
    }
    return {
      value: result.value,
      expiresAt: result.expires_at,
    };
  }

  /**
   * List short-term memory items for a session
   */
  async listShortTermMemory(
    sessionId: string
  ): Promise<Array<{ key: string; value: string; expiresAt: number }>> {
    const storage = this.getStorage();
    const results = await storage.listShortTermMemory(sessionId);
    return results.map((item) => ({
      key: item.key,
      value: item.value,
      expiresAt: item.expires_at,
    }));
  }

  /**
   * Delete a short-term memory item
   */
  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    const storage = this.getStorage();
    return storage.deleteShortTermMemory(sessionId, key);
  }

  /**
   * Save a long-term memory item
   */
  async saveLongTermMemory(
    userId: string,
    category: string,
    key: string,
    value: string,
    options?: {
      importance?: number;
      sourceSessionId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ id: string; created: boolean }> {
    const storage = this.getStorage();
    const result = await storage.saveLongTermMemory(userId, category, key, value, options);
    await storage.indexMemoryForSearch(result.id, userId, value, category);
    return {
      id: result.id,
      created: result.created_at === result.updated_at,
    };
  }

  /**
   * Get long-term memory items
   */
  async getLongTermMemory(
    userId: string,
    options?: {
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{
    items: Array<{
      id: string;
      category: string;
      key: string;
      value: string;
      importance: number;
      accessCount: number;
    }>;
    total: number;
  }> {
    const storage = this.getStorage();
    const { items, total } = await storage.listLongTermMemory(userId, options);
    return {
      items: items.map((item) => ({
        id: item.id,
        category: item.category,
        key: item.key,
        value: item.value,
        importance: item.importance,
        accessCount: item.access_count,
      })),
      total,
    };
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
    const storage = this.getStorage();
    return storage.updateLongTermMemory(id, updates);
  }

  /**
   * Delete a long-term memory item
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    const storage = this.getStorage();
    return storage.deleteLongTermMemory(id);
  }

  /**
   * Search long-term memory
   */
  async searchLongTermMemory(
    userId: string,
    query: string,
    options?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<
    Array<{
      id: string;
      key: string;
      value: string;
      category: string;
      importance: number;
    }>
  > {
    const storage = this.getStorage();
    const results = await storage.searchLongTermMemory(userId, query, options);
    return results.map((item) => ({
      id: item.id,
      key: item.key,
      value: item.value,
      category: item.category,
      importance: item.importance,
    }));
  }

  /**
   * Clean up expired short-term memory items
   */
  async cleanupExpiredMemory(): Promise<number> {
    const storage = this.getStorage();
    return storage.cleanupExpiredShortTermMemory();
  }

  // ========================================================================
  // Todo/Task Management RPC Methods
  // ========================================================================

  /**
   * Add a new task
   */
  async addTask(
    userId: string,
    description: string,
    options?: {
      priority?: number;
      due_date?: number;
      tags?: string[];
      parent_task_id?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<TaskItem> {
    const storage = this.getStorage();
    return addTask(
      {
        description,
        priority: options?.priority ?? 5,
        due_date: options?.due_date,
        tags: options?.tags ?? [],
        parent_task_id: options?.parent_task_id,
        metadata: options?.metadata,
      },
      storage,
      userId
    );
  }

  /**
   * List tasks for a user
   */
  async listTasks(
    userId: string,
    options?: {
      status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
      limit?: number;
      offset?: number;
      parent_task_id?: string;
    }
  ): Promise<{ tasks: TaskItem[]; total: number }> {
    const storage = this.getStorage();
    return listTasks(
      {
        status: options?.status,
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
        parent_task_id: options?.parent_task_id,
      },
      storage,
      userId
    );
  }

  /**
   * Update an existing task
   */
  async updateTask(
    taskId: string,
    updates: {
      description?: string;
      status?: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
      priority?: number;
      due_date?: number;
      tags?: string[];
      completed_at?: number;
    }
  ): Promise<TaskItem> {
    const storage = this.getStorage();
    return updateTask({ id: taskId, ...updates }, storage);
  }

  /**
   * Mark a task as completed
   */
  async completeTask(taskId: string): Promise<TaskItem> {
    const storage = this.getStorage();
    return completeTask({ id: taskId }, storage);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; id: string }> {
    const storage = this.getStorage();
    return deleteTask({ id: taskId }, storage);
  }
}
