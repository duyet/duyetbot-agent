/**
 * MCP Memory Adapter
 *
 * Implements MemoryAdapter using the duyetbot memory MCP server
 */

import type {
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveMemoryResult,
  SessionInfo,
} from "./memory-adapter.js";
import { fromMemoryMessage, toMemoryMessage } from "./memory-adapter.js";
import type { Message } from "./types.js";

/**
 * Configuration for MCP Memory Adapter
 */
export interface MCPMemoryAdapterConfig {
  /** Base URL of the memory MCP server */
  baseURL: string;
  /** Bearer token for authentication */
  token?: string | undefined;
}

/**
 * MCP Memory Adapter implementation
 */
export class MCPMemoryAdapter implements MemoryAdapter {
  private baseURL: string;
  private token: string | undefined;

  constructor(config: MCPMemoryAdapterConfig) {
    this.baseURL = config.baseURL.replace(/\/$/, "");
    this.token = config.token;
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Authenticate with GitHub token and get session token
   */
  async authenticate(
    githubToken: string,
  ): Promise<{ userId: string; sessionToken: string; expiresAt: number }> {
    const response = await this.request("/api/authenticate", {
      method: "POST",
      body: { github_token: githubToken },
      auth: false,
    });

    const result = response as {
      user_id: string;
      session_token: string;
      expires_at: number;
    };
    this.token = result.session_token;

    return {
      userId: result.user_id,
      sessionToken: result.session_token,
      expiresAt: result.expires_at,
    };
  }

  /**
   * Get messages for a session
   */
  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<MemoryData> {
    const response = (await this.request("/api/memory/get", {
      method: "POST",
      body: {
        session_id: sessionId,
        ...options,
      },
    })) as {
      session_id: string;
      messages: Array<{
        role: "user" | "assistant" | "system" | "tool";
        content: string;
        timestamp?: number;
        metadata?: Record<string, unknown>;
      }>;
      metadata: Record<string, unknown>;
    };

    return {
      sessionId: response.session_id,
      messages: response.messages,
      metadata: response.metadata,
    };
  }

  /**
   * Save messages for a session
   */
  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>,
  ): Promise<SaveMemoryResult> {
    const memoryMessages = messages.map(toMemoryMessage);

    const response = (await this.request("/api/memory/save", {
      method: "POST",
      body: {
        session_id: sessionId,
        messages: memoryMessages,
        metadata,
      },
    })) as {
      session_id: string;
      saved_count: number;
      updated_at: number;
    };

    return {
      sessionId: response.session_id,
      savedCount: response.saved_count,
      updatedAt: response.updated_at,
    };
  }

  /**
   * Search across memory
   */
  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    },
  ): Promise<MemorySearchResult[]> {
    const response = (await this.request("/api/memory/search", {
      method: "POST",
      body: {
        query,
        limit: options?.limit,
        filter: options?.sessionId
          ? { session_id: options.sessionId }
          : undefined,
      },
    })) as {
      results: Array<{
        session_id: string;
        message: {
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          timestamp?: number;
          metadata?: Record<string, unknown>;
        };
        score: number;
        context: Array<{
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          timestamp?: number;
          metadata?: Record<string, unknown>;
        }>;
      }>;
    };

    return response.results.map((r) => ({
      sessionId: r.session_id,
      message: r.message,
      score: r.score,
      context: r.context,
    }));
  }

  /**
   * List all sessions
   */
  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: "active" | "paused" | "completed";
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    const response = (await this.request("/api/sessions/list", {
      method: "POST",
      body: options || {},
    })) as {
      sessions: Array<{
        id: string;
        title: string | null;
        state: string;
        created_at: number;
        updated_at: number;
        message_count: number;
      }>;
      total: number;
    };

    return {
      sessions: response.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        state: s.state,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        messageCount: s.message_count,
      })),
      total: response.total,
    };
  }

  /**
   * Make a request to the MCP server
   */
  private async request(
    path: string,
    options: {
      method: "GET" | "POST";
      body?: unknown;
      auth?: boolean;
    },
  ): Promise<unknown> {
    const { method, body, auth = true } = options;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (auth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${path}`, fetchOptions);

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new MCPMemoryAdapterError(
        (data.error as string) || "Request failed",
        response.status,
        path,
      );
    }

    return data;
  }
}

/**
 * Error thrown by MCP memory adapter
 */
export class MCPMemoryAdapterError extends Error {
  public statusCode: number;
  public path: string;

  constructor(message: string, statusCode: number, path: string) {
    super(message);
    this.name = "MCPMemoryAdapterError";
    this.statusCode = statusCode;
    this.path = path;
  }
}

/**
 * Create an MCP memory adapter
 */
export function createMCPMemoryAdapter(
  config: MCPMemoryAdapterConfig,
): MCPMemoryAdapter {
  return new MCPMemoryAdapter(config);
}

/**
 * Default memory MCP server URL
 */
export const DEFAULT_MEMORY_MCP_URL =
  "https://duyetbot-memory.duyet.workers.dev";

/**
 * Resilient MCP Memory Adapter with graceful degradation
 *
 * This adapter wraps MCPMemoryAdapter and provides:
 * - Health checking with timeout
 * - Availability caching
 * - Silent failure mode (returns empty data instead of throwing)
 */
export class ResilientMCPMemoryAdapter implements MemoryAdapter {
  private adapter: MCPMemoryAdapter;
  private baseURL: string;
  private isAvailable: boolean = true;
  private lastCheck: number = 0;
  private checkInterval: number = 60000; // 1 minute

  constructor(config: MCPMemoryAdapterConfig) {
    this.adapter = new MCPMemoryAdapter(config);
    this.baseURL = config.baseURL.replace(/\/$/, "");
  }

  /**
   * Check if MCP server is available (with caching)
   */
  private async checkAvailability(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheck < this.checkInterval) {
      return this.isAvailable;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      // Try a simple request to check availability
      const response = await fetch(`${this.baseURL}/api/sessions/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      this.isAvailable = response.ok || response.status === 401; // 401 means server is up but needs auth
    } catch {
      this.isAvailable = false;
    }

    this.lastCheck = now;
    return this.isAvailable;
  }

  async getMemory(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<MemoryData> {
    if (!(await this.checkAvailability())) {
      return { sessionId, messages: [], metadata: {} };
    }

    try {
      return await this.adapter.getMemory(sessionId, options);
    } catch (err) {
      console.warn("Memory getMemory failed:", err);
      return { sessionId, messages: [], metadata: {} };
    }
  }

  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>,
  ): Promise<SaveMemoryResult> {
    if (!(await this.checkAvailability())) {
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }

    try {
      return await this.adapter.saveMemory(sessionId, messages, metadata);
    } catch (err) {
      console.warn("Memory saveMemory failed:", err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }

  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    },
  ): Promise<MemorySearchResult[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.searchMemory(query, options);
    } catch (err) {
      console.warn("Memory searchMemory failed:", err);
      return [];
    }
  }

  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: "active" | "paused" | "completed";
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    if (!(await this.checkAvailability())) {
      return { sessions: [], total: 0 };
    }

    try {
      return await this.adapter.listSessions(options);
    } catch (err) {
      console.warn("Memory listSessions failed:", err);
      return { sessions: [], total: 0 };
    }
  }
}

/**
 * Create a resilient MCP memory adapter with graceful degradation
 */
export function createResilientMCPMemoryAdapter(
  config: MCPMemoryAdapterConfig,
): ResilientMCPMemoryAdapter {
  return new ResilientMCPMemoryAdapter(config);
}

// Re-export helper for converting messages
export { fromMemoryMessage };
