/**
 * Telegram Session Manager
 *
 * Manages chat sessions for Telegram users
 */

import type { ChatSession, TelegramUser } from './types.js';

/**
 * MCP Memory Client interface
 */
export interface MCPMemoryClient {
  getMemory(sessionId: string): Promise<{
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    metadata?: Record<string, unknown>;
  } | null>;
  saveMemory(
    sessionId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Create session ID for Telegram user
 */
export function createSessionId(userId: number, chatId: number): string {
  return `telegram:${userId}:${chatId}`;
}

/**
 * Parse session ID to extract user and chat info
 */
export function parseSessionId(sessionId: string): { userId: number; chatId: number } | null {
  const match = sessionId.match(/^telegram:(\d+):(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    userId: Number.parseInt(match[1], 10),
    chatId: Number.parseInt(match[2], 10),
  };
}

/**
 * Telegram Session Manager
 */
export class TelegramSessionManager {
  private localSessions = new Map<string, ChatSession>();
  private mcpClient?: MCPMemoryClient;

  constructor(mcpClient?: MCPMemoryClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Get or create session for user
   */
  async getSession(user: TelegramUser, chatId: number): Promise<ChatSession> {
    const sessionId = createSessionId(user.id, chatId);

    // Check local cache first
    const cached = this.localSessions.get(sessionId);
    if (cached) {
      return cached;
    }

    // Try to load from MCP server
    if (this.mcpClient) {
      try {
        const memory = await this.mcpClient.getMemory(sessionId);
        if (memory) {
          const session: ChatSession = {
            sessionId,
            userId: user.id,
            chatId,
            messages: memory.messages,
            createdAt: (memory.metadata?.createdAt as number) || Date.now(),
            updatedAt: Date.now(),
          };
          this.localSessions.set(sessionId, session);
          return session;
        }
      } catch {
        // Fall through to create new session
      }
    }

    // Create new session
    const session: ChatSession = {
      sessionId,
      userId: user.id,
      chatId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.localSessions.set(sessionId, session);
    return session;
  }

  /**
   * Append message to session
   */
  async appendMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const session = this.localSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push({ role, content });
    session.updatedAt = Date.now();

    // Save to MCP server
    if (this.mcpClient) {
      try {
        await this.mcpClient.saveMemory(sessionId, session.messages, {
          userId: session.userId,
          chatId: session.chatId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
      } catch (error) {
        console.error('Failed to save to MCP server:', error);
      }
    }
  }

  /**
   * Clear session history
   */
  async clearSession(sessionId: string): Promise<void> {
    const session = this.localSessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();

      if (this.mcpClient) {
        try {
          await this.mcpClient.saveMemory(sessionId, [], {
            userId: session.userId,
            chatId: session.chatId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          });
        } catch (error) {
          console.error('Failed to clear MCP session:', error);
        }
      }
    }
  }

  /**
   * Get session count for stats
   */
  getSessionCount(): number {
    return this.localSessions.size;
  }
}

/**
 * Create MCP client from URL
 */
export function createMCPClient(url: string, authToken?: string): MCPMemoryClient {
  return {
    async getMemory(sessionId: string): Promise<{
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      metadata?: Record<string, unknown>;
    } | null> {
      const response = await fetch(`${url}/memory/${encodeURIComponent(sessionId)}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`MCP server error: ${response.status}`);
      }

      return response.json() as Promise<{
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
        metadata?: Record<string, unknown>;
      }>;
    },

    async saveMemory(sessionId, messages, metadata) {
      const response = await fetch(`${url}/memory/${encodeURIComponent(sessionId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ messages, metadata }),
      });

      if (!response.ok) {
        throw new Error(`MCP server error: ${response.status}`);
      }
    },
  };
}
