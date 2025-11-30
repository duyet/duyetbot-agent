/**
 * CLI Session Management
 *
 * File-based session storage for local mode
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LLMMessage } from '@duyetbot/types';

export type SessionState = 'active' | 'paused' | 'completed' | 'failed';

export interface LocalSession {
  id: string;
  title: string;
  state: SessionState;
  messages: LLMMessage[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSessionInput {
  title: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateSessionInput {
  title?: string;
  state?: SessionState;
  messages?: LLMMessage[];
  metadata?: Record<string, unknown>;
}

export interface ListSessionsOptions {
  state?: SessionState;
  limit?: number;
  offset?: number;
}

/**
 * File-based session manager for local mode
 */
export class FileSessionManager {
  private sessionsDir: string;
  private idCounter = 0;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
  }

  /**
   * Ensure sessions directory exists
   */
  private ensureDir(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /**
   * Get session file path
   */
  private getSessionPath(id: string): string {
    return path.join(this.sessionsDir, `${id}.json`);
  }

  /**
   * Generate unique session ID
   */
  private generateId(): string {
    return `session-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<LocalSession> {
    this.ensureDir();

    const now = Date.now();
    const session: LocalSession = {
      id: this.generateId(),
      title: input.title,
      state: 'active',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    if (input.metadata) {
      session.metadata = input.metadata;
    }

    const sessionPath = this.getSessionPath(session.id);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<LocalSession | undefined> {
    const sessionPath = this.getSessionPath(id);

    if (!fs.existsSync(sessionPath)) {
      return undefined;
    }

    const content = fs.readFileSync(sessionPath, 'utf-8');
    return JSON.parse(content) as LocalSession;
  }

  /**
   * Update session
   */
  async updateSession(id: string, input: UpdateSessionInput): Promise<LocalSession> {
    const session = await this.getSession(id);

    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    const updated: LocalSession = {
      ...session,
      ...input,
      updatedAt: Date.now(),
    };

    const sessionPath = this.getSessionPath(id);
    fs.writeFileSync(sessionPath, JSON.stringify(updated, null, 2));

    return updated;
  }

  /**
   * Delete session
   */
  async deleteSession(id: string): Promise<void> {
    const sessionPath = this.getSessionPath(id);

    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
    }
  }

  /**
   * List sessions
   */
  async listSessions(options?: ListSessionsOptions): Promise<LocalSession[]> {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir).filter((f) => f.endsWith('.json'));

    let sessions: LocalSession[] = [];

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
      sessions.push(JSON.parse(content) as LocalSession);
    }

    // Filter by state
    if (options?.state) {
      sessions = sessions.filter((s) => s.state === options.state);
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    // Apply offset
    if (options?.offset) {
      sessions = sessions.slice(options.offset);
    }

    // Apply limit
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }

    return sessions;
  }

  /**
   * Export session as JSON string
   */
  async exportSession(id: string): Promise<string> {
    const session = await this.getSession(id);

    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    return JSON.stringify(session, null, 2);
  }
}
