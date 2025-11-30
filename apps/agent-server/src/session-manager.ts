/**
 * Agent Session Manager
 *
 * Manages active agent sessions in memory
 */

import type { LLMMessage } from "@duyetbot/types";

export type SessionState = "active" | "paused" | "completed" | "failed";

export interface AgentSession {
  id: string;
  userId: string;
  state: SessionState;
  messages: LLMMessage[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  state?: SessionState;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  state?: SessionState;
  limit?: number;
  offset?: number;
}

export interface CleanupOptions {
  maxAge: number; // milliseconds
}

/**
 * Manages agent sessions in memory
 */
export class AgentSessionManager {
  private sessions = new Map<string, AgentSession>();
  private idCounter = 0;

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `session-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<AgentSession> {
    const now = new Date();
    const session: AgentSession = {
      id: this.generateId(),
      userId: input.userId,
      state: "active",
      messages: input.messages || [],
      createdAt: now,
      updatedAt: now,
    };

    // Only set metadata if provided
    if (input.metadata) {
      session.metadata = input.metadata;
    }

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<AgentSession | undefined> {
    return this.sessions.get(id);
  }

  /**
   * Update session
   */
  async updateSession(
    id: string,
    input: UpdateSessionInput,
  ): Promise<AgentSession> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: AgentSession = {
      ...session,
      ...input,
      updatedAt: new Date(),
    };

    this.sessions.set(id, updated);
    return updated;
  }

  /**
   * Delete session
   */
  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /**
   * List sessions for a user
   */
  async listSessions(
    userId: string,
    options?: ListSessionsOptions,
  ): Promise<AgentSession[]> {
    let sessions = Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId,
    );

    if (options?.state) {
      sessions = sessions.filter((s) => s.state === options.state);
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Apply pagination
    if (options?.offset) {
      sessions = sessions.slice(options.offset);
    }
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  /**
   * Get count of active sessions
   */
  getActiveSessionCount(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.state === "active",
    ).length;
  }

  /**
   * Cleanup old sessions
   */
  async cleanup(options: CleanupOptions): Promise<number> {
    const cutoff = Date.now() - options.maxAge;
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (session.updatedAt.getTime() < cutoff) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessions.clear();
  }
}
