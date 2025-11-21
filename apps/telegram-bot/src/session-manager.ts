/**
 * Telegram Session Manager with MCP Client Integration
 */

import type { AgentMessage, TelegramSessionData } from './types.js';

/**
 * MCP Memory Client interface
 */
export interface MCPMemoryClient {
  authenticate(token: string): Promise<{ userId: string; sessionToken: string }>;
  getMemory(sessionId: string, limit?: number): Promise<{ messages: AgentMessage[] }>;
  saveMemory(sessionId: string, messages: AgentMessage[]): Promise<{ savedCount: number }>;
  searchMemory(
    query: string,
    limit?: number
  ): Promise<{ results: Array<{ sessionId: string; message: AgentMessage; score: number }> }>;
  listSessions(
    limit?: number
  ): Promise<{ sessions: Array<{ id: string; title: string; updatedAt: number }> }>;
}

/**
 * Create MCP client for memory server
 */
export function createMCPClient(serverUrl: string, authToken?: string): MCPMemoryClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  async function callMCP<T>(tool: string, input: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${serverUrl}/mcp/tools/${tool}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    authenticate: (token: string) => callMCP('authenticate', { github_token: token }),
    getMemory: (sessionId: string, limit = 100) =>
      callMCP('get_memory', { session_id: sessionId, limit }),
    saveMemory: (sessionId: string, messages: AgentMessage[]) =>
      callMCP('save_memory', { session_id: sessionId, messages }),
    searchMemory: (query: string, limit = 10) => callMCP('search_memory', { query, limit }),
    listSessions: (limit = 20) => callMCP('list_sessions', { limit }),
  };
}

/**
 * Create session ID for Telegram user
 */
export function createTelegramSessionId(userId: number): string {
  return `telegram:${userId}`;
}

/**
 * Parse session ID
 */
export function parseSessionId(sessionId: string): { type: 'telegram'; userId: number } | null {
  const match = sessionId.match(/^telegram:(\d+)$/);
  if (!match) return null;
  return {
    type: 'telegram',
    userId: Number.parseInt(match[1], 10),
  };
}

/**
 * Telegram Session Manager
 */
export class TelegramSessionManager {
  private mcpClient?: MCPMemoryClient;
  private localSessions: Map<number, TelegramSessionData> = new Map();
  private messageHistory: Map<string, AgentMessage[]> = new Map();

  constructor(mcpServerUrl?: string, authToken?: string) {
    if (mcpServerUrl) {
      this.mcpClient = createMCPClient(mcpServerUrl, authToken);
    }
  }

  /**
   * Get or create session for user
   */
  async getSession(
    userId: number,
    userInfo?: { username?: string; firstName?: string; lastName?: string }
  ): Promise<TelegramSessionData> {
    // Check local cache
    let session = this.localSessions.get(userId);

    if (!session) {
      const sessionId = createTelegramSessionId(userId);
      session = {
        userId,
        username: userInfo?.username,
        firstName: userInfo?.firstName,
        lastName: userInfo?.lastName,
        sessionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: 0,
      };
      this.localSessions.set(userId, session);
    }

    return session;
  }

  /**
   * Get message history for session
   */
  async getMessages(sessionId: string, limit = 50): Promise<AgentMessage[]> {
    // Try MCP first
    if (this.mcpClient) {
      try {
        const result = await this.mcpClient.getMemory(sessionId, limit);
        return result.messages;
      } catch {
        // Fall back to local
      }
    }

    // Local storage
    return this.messageHistory.get(sessionId) || [];
  }

  /**
   * Save messages to session
   */
  async saveMessages(sessionId: string, messages: AgentMessage[]): Promise<void> {
    // Update local storage
    const existing = this.messageHistory.get(sessionId) || [];
    const updated = [...existing, ...messages];
    this.messageHistory.set(sessionId, updated);

    // Update session metadata
    const parsed = parseSessionId(sessionId);
    if (parsed) {
      const session = this.localSessions.get(parsed.userId);
      if (session) {
        session.updatedAt = Date.now();
        session.messageCount = updated.length;
      }
    }

    // Sync to MCP
    if (this.mcpClient) {
      try {
        await this.mcpClient.saveMemory(sessionId, updated);
      } catch (error) {
        console.error('Failed to save to MCP:', error);
      }
    }
  }

  /**
   * Search across all sessions
   */
  async searchMemory(
    query: string,
    limit = 10
  ): Promise<Array<{ sessionId: string; message: AgentMessage; score: number }>> {
    if (this.mcpClient) {
      const result = await this.mcpClient.searchMemory(query, limit);
      return result.results;
    }

    // Simple local search
    const results: Array<{ sessionId: string; message: AgentMessage; score: number }> = [];

    for (const [sessionId, messages] of this.messageHistory) {
      for (const message of messages) {
        if (message.content.toLowerCase().includes(query.toLowerCase())) {
          results.push({ sessionId, message, score: 1 });
          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<TelegramSessionData[]> {
    return Array.from(this.localSessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Clear session history
   */
  async clearSession(userId: number): Promise<void> {
    const sessionId = createTelegramSessionId(userId);
    this.messageHistory.delete(sessionId);

    const session = this.localSessions.get(userId);
    if (session) {
      session.messageCount = 0;
      session.updatedAt = Date.now();
    }
  }
}
