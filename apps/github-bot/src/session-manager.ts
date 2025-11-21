/**
 * Session Manager for GitHub Bot
 *
 * Manages session IDs and integrates with MCP memory server
 * for persistent conversation history across issues/PRs.
 */

import type { GitHubRepository } from './types.js';

/**
 * Session types for different GitHub contexts
 */
export type GitHubSessionType = 'issue' | 'pr' | 'discussion';

/**
 * Session metadata
 */
export interface GitHubSessionMetadata {
  type: GitHubSessionType;
  repository: {
    owner: string;
    name: string;
    fullName: string;
  };
  number: number;
  title: string | undefined;
  createdAt: number;
  updatedAt: number;
}

/**
 * MCP Memory Client interface
 */
export interface MCPMemoryClient {
  getMemory(sessionId: string): Promise<{
    session_id: string;
    messages: Array<{ role: string; content: string }>;
    metadata?: Record<string, unknown>;
  }>;
  saveMemory(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    metadata?: Record<string, unknown>
  ): Promise<void>;
}

/**
 * Create a deterministic session ID for a GitHub issue
 */
export function createIssueSessionId(repository: GitHubRepository, issueNumber: number): string {
  return `github:${repository.owner.login}/${repository.name}:issue:${issueNumber}`;
}

/**
 * Create a deterministic session ID for a GitHub PR
 */
export function createPRSessionId(repository: GitHubRepository, prNumber: number): string {
  return `github:${repository.owner.login}/${repository.name}:pr:${prNumber}`;
}

/**
 * Create a deterministic session ID for a GitHub discussion
 */
export function createDiscussionSessionId(
  repository: GitHubRepository,
  discussionNumber: number
): string {
  return `github:${repository.owner.login}/${repository.name}:discussion:${discussionNumber}`;
}

/**
 * Parse a session ID to extract components
 */
export function parseSessionId(sessionId: string): {
  platform: string;
  owner: string;
  repo: string;
  type: GitHubSessionType;
  number: number;
} | null {
  const match = sessionId.match(/^github:([^/]+)\/([^:]+):(issue|pr|discussion):(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    platform: 'github',
    owner: match[1],
    repo: match[2],
    type: match[3] as GitHubSessionType,
    number: Number.parseInt(match[4], 10),
  };
}

/**
 * GitHub Bot Session Manager
 *
 * Handles session lifecycle and MCP memory integration
 */
export class GitHubSessionManager {
  private mcpClient: MCPMemoryClient | undefined;
  private localCache: Map<
    string,
    {
      messages: Array<{ role: string; content: string }>;
      metadata: GitHubSessionMetadata;
    }
  > = new Map();

  constructor(mcpClient?: MCPMemoryClient) {
    this.mcpClient = mcpClient;
  }

  /**
   * Get or create a session for an issue
   */
  async getIssueSession(
    repository: GitHubRepository,
    issueNumber: number,
    title?: string
  ): Promise<{
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    metadata: GitHubSessionMetadata;
  }> {
    const sessionId = createIssueSessionId(repository, issueNumber);
    return this.getSession(sessionId, {
      type: 'issue',
      repository: {
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
      },
      number: issueNumber,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * Get or create a session for a PR
   */
  async getPRSession(
    repository: GitHubRepository,
    prNumber: number,
    title?: string
  ): Promise<{
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    metadata: GitHubSessionMetadata;
  }> {
    const sessionId = createPRSessionId(repository, prNumber);
    return this.getSession(sessionId, {
      type: 'pr',
      repository: {
        owner: repository.owner.login,
        name: repository.name,
        fullName: repository.full_name,
      },
      number: prNumber,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * Get or create a session
   */
  private async getSession(
    sessionId: string,
    defaultMetadata: GitHubSessionMetadata
  ): Promise<{
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    metadata: GitHubSessionMetadata;
  }> {
    // Check local cache first
    const cached = this.localCache.get(sessionId);
    if (cached) {
      return { sessionId, ...cached };
    }

    // Try to load from MCP server
    if (this.mcpClient) {
      try {
        const memory = await this.mcpClient.getMemory(sessionId);
        const metadata = memory.metadata
          ? (memory.metadata as unknown as GitHubSessionMetadata)
          : defaultMetadata;

        // Update cache
        this.localCache.set(sessionId, {
          messages: memory.messages,
          metadata,
        });

        return {
          sessionId,
          messages: memory.messages,
          metadata,
        };
      } catch {
        // Session doesn't exist yet, create new
        console.log(`Creating new session: ${sessionId}`);
      }
    }

    // Create new session
    const newSession = {
      messages: [] as Array<{ role: string; content: string }>,
      metadata: defaultMetadata,
    };

    this.localCache.set(sessionId, newSession);

    return { sessionId, ...newSession };
  }

  /**
   * Save session messages
   */
  async saveSession(
    sessionId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<void> {
    // Update local cache
    const cached = this.localCache.get(sessionId);
    if (cached) {
      cached.messages = messages;
      cached.metadata.updatedAt = Date.now();
    }

    // Save to MCP server
    if (this.mcpClient) {
      const metadata = cached?.metadata || {
        type: 'issue' as GitHubSessionType,
        repository: { owner: '', name: '', fullName: '' },
        number: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await this.mcpClient.saveMemory(
        sessionId,
        messages,
        metadata as unknown as Record<string, unknown>
      );
    }
  }

  /**
   * Append a message to a session
   */
  async appendMessage(sessionId: string, role: string, content: string): Promise<void> {
    const cached = this.localCache.get(sessionId);
    if (!cached) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    cached.messages.push({ role, content });
    cached.metadata.updatedAt = Date.now();

    // Save to MCP server
    if (this.mcpClient) {
      await this.mcpClient.saveMemory(
        sessionId,
        cached.messages,
        cached.metadata as unknown as Record<string, unknown>
      );
    }
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.localCache.clear();
  }

  /**
   * Get session from cache (for testing)
   */
  getCached(sessionId: string):
    | {
        messages: Array<{ role: string; content: string }>;
        metadata: GitHubSessionMetadata;
      }
    | undefined {
    return this.localCache.get(sessionId);
  }
}

/**
 * Create a simple MCP client for the GitHub bot
 */
export function createMCPClient(serverUrl: string, authToken?: string): MCPMemoryClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return {
    async getMemory(sessionId: string) {
      const response = await fetch(`${serverUrl}/mcp/tools/get_memory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get memory: ${response.status}`);
      }

      return response.json() as Promise<{
        session_id: string;
        messages: Array<{ role: string; content: string }>;
        metadata?: Record<string, unknown>;
      }>;
    },

    async saveMemory(sessionId, messages, metadata) {
      const response = await fetch(`${serverUrl}/mcp/tools/save_memory`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session_id: sessionId,
          messages,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save memory: ${response.status}`);
      }
    },
  };
}
