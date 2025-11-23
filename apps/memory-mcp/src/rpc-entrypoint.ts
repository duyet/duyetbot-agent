/**
 * Memory Service RPC Entrypoint
 *
 * Provides RPC methods for service binding communication.
 * This avoids HTTP overhead and blockConcurrencyWhile issues.
 */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { D1Storage } from './storage/d1.js';
import type { Env, LLMMessage } from './types.js';

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
}
