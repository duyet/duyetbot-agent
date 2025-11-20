/**
 * Cloud Session Manager
 *
 * Session management using MCP Memory Server
 */

import { MCPMemoryClient } from '@duyetbot/core';
import type { LocalSession, CreateSessionInput, UpdateSessionInput, ListSessionsOptions } from './sessions.js';

/**
 * Cloud-based session manager using MCP Memory Server
 */
export class CloudSessionManager {
  private client: MCPMemoryClient;

  constructor(mcpServerUrl: string, _userId: string, token?: string) {
    const config: { baseURL: string; token?: string } = { baseURL: mcpServerUrl };
    if (token) {
      config.token = token;
    }
    this.client = new MCPMemoryClient(config);
  }

  /**
   * Authenticate with MCP server
   */
  async authenticate(githubToken: string): Promise<string> {
    const result = await this.client.authenticate(githubToken);
    return result.session_token;
  }

  /**
   * Create a new session
   */
  async createSession(input: CreateSessionInput): Promise<LocalSession> {
    const now = Date.now();
    const sessionId = `session-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const session: LocalSession = {
      id: sessionId,
      title: input.title,
      state: 'active',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    if (input.metadata) {
      session.metadata = input.metadata;
    }

    // Save to MCP server
    await this.client.saveMemory([], {
      session_id: sessionId,
      metadata: {
        title: input.title,
        state: 'active',
        createdAt: now,
        updatedAt: now,
        ...(input.metadata || {}),
      },
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(id: string): Promise<LocalSession | undefined> {
    try {
      const memory = await this.client.getMemory(id);
      if (memory) {
        const metadata = memory.metadata as {
          title?: string;
          state?: 'active' | 'paused' | 'completed' | 'failed';
          createdAt?: number;
          updatedAt?: number;
        };

        return {
          id: memory.session_id,
          title: metadata.title || 'Untitled',
          state: metadata.state || 'active',
          messages: memory.messages.map((m: { role: 'user' | 'assistant' | 'system'; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
          createdAt: metadata.createdAt || Date.now(),
          updatedAt: metadata.updatedAt || Date.now(),
        };
      }
      return undefined;
    } catch {
      return undefined;
    }
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
      updatedAt: Date.now(),
    };

    if (input.title !== undefined) {
      updated.title = input.title;
    }
    if (input.state !== undefined) {
      updated.state = input.state;
    }
    if (input.messages !== undefined) {
      updated.messages = input.messages;
    }
    if (input.metadata !== undefined) {
      updated.metadata = input.metadata;
    }

    // Save to MCP server
    await this.client.saveMemory(
      updated.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      {
        session_id: id,
        metadata: {
          title: updated.title,
          state: updated.state,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          ...(updated.metadata || {}),
        },
      }
    );

    return updated;
  }

  /**
   * Delete session
   */
  async deleteSession(id: string): Promise<void> {
    // MCP doesn't have delete, so we mark as deleted
    const session = await this.getSession(id);
    if (session) {
      await this.updateSession(id, { state: 'failed' });
    }
  }

  /**
   * List sessions
   */
  async listSessions(options?: ListSessionsOptions): Promise<LocalSession[]> {
    const listOptions: { limit?: number; offset?: number; state?: 'active' | 'paused' | 'completed' } = {};
    if (options?.limit) {
      listOptions.limit = options.limit;
    }
    if (options?.offset) {
      listOptions.offset = options.offset;
    }
    if (options?.state && options.state !== 'failed') {
      listOptions.state = options.state;
    }

    const result = await this.client.listSessions(listOptions);

    const sessions: LocalSession[] = [];

    for (const item of result.sessions) {
      const session = await this.getSession(item.id);
      if (session) {
        sessions.push(session);
      }
    }

    // Sort by updatedAt descending
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);

    return sessions;
  }

  /**
   * Search sessions by query
   */
  async searchSessions(query: string): Promise<LocalSession[]> {
    const result = await this.client.searchMemory(query);

    const sessions: LocalSession[] = [];
    const seenIds = new Set<string>();

    for (const item of result.results) {
      if (!seenIds.has(item.session_id)) {
        seenIds.add(item.session_id);
        const session = await this.getSession(item.session_id);
        if (session) {
          sessions.push(session);
        }
      }
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
