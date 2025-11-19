/**
 * File-based Session Manager
 *
 * Persists sessions to local filesystem (~/.duyetbot/sessions/)
 * Each session is stored as a separate JSON file
 */

import type {
  CreateSessionInput,
  Session,
  SessionManager,
  SessionState,
  UpdateSessionInput,
} from '@/agent/session';
import { SessionError } from '@/agent/session';
import { FileSystemStorage } from './filesystem';

/**
 * File-based session manager
 * Stores each session as ~/.duyetbot/sessions/{id}.json
 */
export class FileSessionManager implements SessionManager {
  private storage: FileSystemStorage;
  private idCounter = 0;

  constructor(basePath?: string) {
    this.storage = new FileSystemStorage(basePath);
  }

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `session-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Get session file path
   */
  private getSessionPath(id: string): string {
    return `sessions/${id}.json`;
  }

  /**
   * Serialize session for storage (convert Dates to ISO strings)
   */
  private serialize(session: Session): unknown {
    return {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(session.completedAt && { completedAt: session.completedAt.toISOString() }),
    };
  }

  /**
   * Deserialize session from storage (convert ISO strings to Dates)
   */
  private deserialize(data: unknown): Session {
    const serializedSession = data as {
      id: string;
      state: SessionState;
      createdAt: string;
      updatedAt: string;
      completedAt?: string;
      messages?: Session['messages'];
      toolResults?: Session['toolResults'];
      metadata?: Session['metadata'];
    };

    return {
      ...serializedSession,
      createdAt: new Date(serializedSession.createdAt),
      updatedAt: new Date(serializedSession.updatedAt),
      ...(serializedSession.completedAt && {
        completedAt: new Date(serializedSession.completedAt),
      }),
    };
  }

  /**
   * Create a new session
   */
  async create(input: CreateSessionInput): Promise<Session> {
    const session: Session = {
      id: this.generateId(),
      state: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };

    // Persist to file
    await this.storage.writeJSON(this.getSessionPath(session.id), this.serialize(session));

    return session;
  }

  /**
   * Get session by ID
   */
  async get(id: string): Promise<Session | undefined> {
    try {
      const data = await this.storage.readJSON(this.getSessionPath(id));
      return this.deserialize(data);
    } catch {
      return undefined;
    }
  }

  /**
   * Update session
   */
  async update(id: string, input: UpdateSessionInput): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    const updated: Session = {
      ...session,
      ...input,
      updatedAt: new Date(),
    };

    // Persist to file
    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(updated));

    return updated;
  }

  /**
   * Delete session
   */
  async delete(id: string): Promise<void> {
    await this.storage.delete(this.getSessionPath(id));
  }

  /**
   * List sessions
   */
  async list(filter?: {
    state?: SessionState;
    metadata?: Record<string, unknown>;
  }): Promise<Session[]> {
    const files = await this.storage.list('sessions');
    const sessions: Session[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      try {
        const data = await this.storage.readJSON(`sessions/${file}`);
        sessions.push(this.deserialize(data));
      } catch {
        // Skip invalid files
      }
    }

    // Apply filters
    let filtered = sessions;

    if (filter?.state) {
      filtered = filtered.filter((s) => s.state === filter.state);
    }

    if (filter?.metadata) {
      filtered = filtered.filter((s) => {
        if (!s.metadata) {
          return false;
        }
        return Object.entries(filter.metadata ?? {}).every(
          ([key, value]) => s.metadata?.[key] === value
        );
      });
    }

    return filtered;
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
      throw new SessionError(`Cannot resume session in state: ${session.state}`, 'INVALID_STATE');
    }

    const resumed: Session = {
      ...session,
      state: 'active',
      updatedAt: new Date(),
      resumeToken: undefined,
    };

    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(resumed));
    return resumed;
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
      throw new SessionError(`Cannot pause session in state: ${session.state}`, 'INVALID_STATE');
    }

    const paused: Session = {
      ...session,
      state: 'paused',
      ...(resumeToken && { resumeToken }),
      updatedAt: new Date(),
    };

    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(paused));
    return paused;
  }

  /**
   * Complete a session
   */
  async complete(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state === 'completed') {
      throw new SessionError('Session already completed', 'INVALID_STATE');
    }

    if (session.state !== 'active') {
      throw new SessionError(`Cannot complete session in state: ${session.state}`, 'INVALID_STATE');
    }

    const completed: Session = {
      ...session,
      state: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(completed));
    return completed;
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

    if (session.state !== 'active') {
      throw new SessionError(`Cannot fail session in state: ${session.state}`, 'INVALID_STATE');
    }

    const failed: Session = {
      ...session,
      state: 'failed',
      error,
      updatedAt: new Date(),
    };

    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(failed));
    return failed;
  }

  /**
   * Cancel a session
   */
  async cancel(id: string): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state === 'completed' || session.state === 'failed') {
      throw new SessionError(`Cannot cancel session in state: ${session.state}`, 'INVALID_STATE');
    }

    const cancelled: Session = {
      ...session,
      state: 'cancelled',
      updatedAt: new Date(),
    };

    await this.storage.writeJSON(this.getSessionPath(id), this.serialize(cancelled));
    return cancelled;
  }
}
