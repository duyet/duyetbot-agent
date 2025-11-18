/**
 * Cloud Session Manager
 *
 * Multi-tenant session manager using D1 for metadata and KV for messages/tools
 */

import type {
  CreateSessionInput,
  Session,
  SessionManager,
  SessionState,
  ToolResult,
  UpdateSessionInput,
} from '@/agent/session';
import { SessionError } from '@/agent/session';
import type { SessionRepository } from '@/api/repositories/session';
import { nanoid } from 'nanoid';
import type { MessageStore } from './kv-message-store';
import type { ToolResultStore } from './kv-tool-result-store';

/**
 * Cloud-based session manager with multi-tenant support
 */
export class CloudSessionManager implements SessionManager {
  constructor(
    private userId: string,
    private sessionRepo: SessionRepository,
    private messageStore: MessageStore,
    private toolStore: ToolResultStore
  ) {}

  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<Session> {
    const sessionId = nanoid();

    // Store metadata in D1
    const sessionRow = await this.sessionRepo.create({
      id: sessionId,
      userId: this.userId,
      state: 'active',
      title: input.metadata?.title as string | undefined,
      metadata: input.metadata,
    });

    // Store initial messages in KV if provided
    if (input.messages && input.messages.length > 0) {
      for (const message of input.messages) {
        await this.messageStore.append(this.userId, sessionId, message);
      }
    }

    return this.rowToSession(sessionRow);
  }

  /**
   * Get session by ID
   */
  async get(id: string): Promise<Session | undefined> {
    const sessionRow = await this.sessionRepo.get(this.userId, id);
    if (!sessionRow) {
      return undefined;
    }

    return this.rowToSession(sessionRow);
  }

  /**
   * Update session
   */
  async update(id: string, input: UpdateSessionInput): Promise<Session> {
    const existingSession = await this.get(id);
    if (!existingSession) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    // Update metadata in D1
    const updates: {
      state?: SessionState;
      title?: string;
      metadata?: Record<string, unknown>;
    } = {};

    if (input.state) {
      updates.state = input.state;
    }

    if (input.metadata) {
      updates.metadata = {
        ...(existingSession.metadata || {}),
        ...input.metadata,
      };
    }

    const sessionRow = await this.sessionRepo.update(this.userId, id, updates);
    if (!sessionRow) {
      throw new SessionError(`Failed to update session: ${id}`, 'UPDATE_FAILED');
    }

    // Append new messages to KV if provided
    if (input.messages && input.messages.length > 0) {
      for (const message of input.messages) {
        await this.messageStore.append(this.userId, id, message);
      }
    }

    // Append tool results to KV if provided
    if (input.toolResults && input.toolResults.length > 0) {
      for (const result of input.toolResults) {
        await this.toolStore.append(this.userId, id, result);
      }
    }

    return this.rowToSession(sessionRow);
  }

  /**
   * Delete session and all associated data
   */
  async delete(id: string): Promise<void> {
    // Delete metadata from D1
    await this.sessionRepo.delete(this.userId, id);

    // Clear messages from KV
    await this.messageStore.clear(this.userId, id);

    // Clear tool results from KV
    await this.toolStore.clear(this.userId, id);
  }

  /**
   * List sessions with optional filtering
   */
  async list(filter?: {
    state?: SessionState;
    metadata?: Record<string, unknown>;
  }): Promise<Session[]> {
    const sessionRows = await this.sessionRepo.list({
      userId: this.userId,
      state: filter?.state,
      limit: 100,
    });

    const sessions = sessionRows.map((row) => this.rowToSession(row));

    // Filter by metadata if provided
    if (filter?.metadata) {
      return sessions.filter((session) => {
        if (!session.metadata) {
          return false;
        }
        return Object.entries(filter.metadata!).every(
          ([key, value]) => session.metadata?.[key] === value
        );
      });
    }

    return sessions;
  }

  /**
   * Resume a paused session
   */
  async resume(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state !== 'paused') {
      throw new SessionError(`Session is not paused: ${id}`, 'INVALID_STATE');
    }

    return this.update(id, {
      state: 'active',
    });
  }

  /**
   * Pause an active session
   */
  async pause(id: string, resumeToken?: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state !== 'active') {
      throw new SessionError(`Session is not active: ${id}`, 'INVALID_STATE');
    }

    return this.update(id, {
      state: 'paused',
      metadata: {
        ...session.metadata,
        resumeToken,
      },
    });
  }

  /**
   * Complete a session
   */
  async complete(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    return this.update(id, {
      state: 'completed',
    });
  }

  /**
   * Fail a session
   */
  async fail(
    id: string,
    error: { message: string; code: string; details?: unknown }
  ): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    return this.update(id, {
      state: 'failed',
      metadata: {
        ...session.metadata,
        error,
      },
    });
  }

  /**
   * Cancel a session
   */
  async cancel(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    return this.update(id, {
      state: 'cancelled',
    });
  }

  /**
   * Get all messages for a session
   */
  async getMessages(sessionId: string, limit?: number) {
    if (limit) {
      return this.messageStore.getRecent(this.userId, sessionId, limit);
    }
    return this.messageStore.getAll(this.userId, sessionId);
  }

  /**
   * Get all tool results for a session
   */
  async getToolResults(sessionId: string, limit?: number): Promise<ToolResult[]> {
    if (limit) {
      return this.toolStore.getRecent(this.userId, sessionId, limit);
    }
    return this.toolStore.getAll(this.userId, sessionId);
  }

  /**
   * Convert SessionRow to Session
   */
  private rowToSession(row: {
    id: string;
    user_id: string;
    state: SessionState;
    title: string | null;
    created_at: number;
    updated_at: number;
    metadata: string | null;
  }): Session {
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

    return {
      id: row.id,
      state: row.state,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata,
    };
  }
}

/**
 * Create cloud session manager for a user
 */
export function createCloudSessionManager(
  userId: string,
  sessionRepo: SessionRepository,
  messageStore: MessageStore,
  toolStore: ToolResultStore
): SessionManager {
  return new CloudSessionManager(userId, sessionRepo, messageStore, toolStore);
}
