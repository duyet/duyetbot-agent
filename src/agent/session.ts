/**
 * Agent Session Management
 *
 * Session types and interfaces for agent execution state
 */

import type { LLMMessage, ProviderConfig } from '@/providers/types';

/**
 * Session state
 */
export type SessionState = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Tool execution result
 */
export interface ToolResult {
  toolName: string;
  status: 'success' | 'error';
  output?: unknown;
  error?: {
    message: string;
    code: string;
  };
  timestamp?: Date;
}

/**
 * Session interface
 */
export interface Session {
  // Required properties
  id: string;
  state: SessionState;
  createdAt: Date;
  updatedAt: Date;

  // Optional properties
  provider?: ProviderConfig;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  toolResults?: ToolResult[];
  resumeToken?: string;
  completedAt?: Date;
}

/**
 * Session creation input
 */
export interface CreateSessionInput {
  provider?: ProviderConfig;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  state?: SessionState;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  toolResults?: ToolResult[];
  resumeToken?: string;
}

/**
 * Session manager interface
 */
export interface SessionManager {
  /**
   * Create a new session
   */
  create(input: CreateSessionInput): Promise<Session>;

  /**
   * Get session by ID
   */
  get(id: string): Promise<Session | undefined>;

  /**
   * Update session
   */
  update(id: string, input: UpdateSessionInput): Promise<Session>;

  /**
   * Delete session
   */
  delete(id: string): Promise<void>;

  /**
   * List sessions
   */
  list(filter?: {
    state?: SessionState;
    metadata?: Record<string, unknown>;
  }): Promise<Session[]>;

  /**
   * Resume a paused session
   */
  resume(id: string): Promise<Session>;

  /**
   * Pause an active session
   */
  pause(id: string, resumeToken?: string): Promise<Session>;

  /**
   * Complete a session
   */
  complete(id: string): Promise<Session>;

  /**
   * Fail a session
   */
  fail(id: string, error: { message: string; code: string; details?: unknown }): Promise<Session>;

  /**
   * Cancel a session
   */
  cancel(id: string): Promise<Session>;
}

/**
 * Session error
 */
export class SessionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * In-memory session manager implementation
 * Useful for testing and local development
 */
export class InMemorySessionManager implements SessionManager {
  private sessions = new Map<string, Session>();
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
  async create(input: CreateSessionInput): Promise<Session> {
    const session: Session = {
      id: this.generateId(),
      state: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  async get(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  /**
   * Update session
   */
  async update(id: string, input: UpdateSessionInput): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    const updated: Session = {
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
  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /**
   * List sessions
   */
  async list(filter?: { state?: SessionState; metadata?: Record<string, unknown> }): Promise<Session[]> {
    let sessions = Array.from(this.sessions.values());

    if (filter?.state) {
      sessions = sessions.filter((s) => s.state === filter.state);
    }

    if (filter?.metadata) {
      sessions = sessions.filter((s) => {
        if (!s.metadata) return false;
        return Object.entries(filter.metadata ?? {}).every(([key, value]) => s.metadata?.[key] === value);
      });
    }

    return sessions;
  }

  /**
   * Resume a paused session
   */
  async resume(id: string): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state !== 'paused') {
      throw new SessionError(
        `Cannot resume session in state: ${session.state}`,
        'INVALID_STATE'
      );
    }

    const resumed: Session = {
      ...session,
      state: 'active',
      updatedAt: new Date(),
    };
    delete resumed.resumeToken;

    this.sessions.set(id, resumed);
    return resumed;
  }

  /**
   * Pause an active session
   */
  async pause(id: string, resumeToken?: string): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state !== 'active') {
      throw new SessionError(
        `Cannot pause session in state: ${session.state}`,
        'INVALID_STATE'
      );
    }

    const paused: Session = {
      ...session,
      state: 'paused',
      ...(resumeToken && { resumeToken }),
      updatedAt: new Date(),
    };

    this.sessions.set(id, paused);
    return paused;
  }

  /**
   * Complete a session
   */
  async complete(id: string): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state === 'completed') {
      throw new SessionError('Session already completed', 'INVALID_STATE');
    }

    if (session.state !== 'active') {
      throw new SessionError(
        `Cannot complete session in state: ${session.state}`,
        'INVALID_STATE'
      );
    }

    const completed: Session = {
      ...session,
      state: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(id, completed);
    return completed;
  }

  /**
   * Fail a session
   */
  async fail(
    id: string,
    error: { message: string; code: string; details?: unknown }
  ): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state !== 'active') {
      throw new SessionError(
        `Cannot fail session in state: ${session.state}`,
        'INVALID_STATE'
      );
    }

    const failed: Session = {
      ...session,
      state: 'failed',
      error,
      updatedAt: new Date(),
    };

    this.sessions.set(id, failed);
    return failed;
  }

  /**
   * Cancel a session
   */
  async cancel(id: string): Promise<Session> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new SessionError(`Session not found: ${id}`, 'SESSION_NOT_FOUND');
    }

    if (session.state === 'completed' || session.state === 'failed') {
      throw new SessionError(
        `Cannot cancel session in state: ${session.state}`,
        'INVALID_STATE'
      );
    }

    const cancelled: Session = {
      ...session,
      state: 'cancelled',
      updatedAt: new Date(),
    };

    this.sessions.set(id, cancelled);
    return cancelled;
  }
}
