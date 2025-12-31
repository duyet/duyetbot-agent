/**
 * MCP Memory Adapter
 *
 * Implements MemoryAdapter using the duyetbot memory MCP server
 */

import type {
  LongTermMemoryEntry,
  MemoryAdapter,
  MemoryData,
  MemorySearchResult,
  SaveLongTermMemoryResult,
  SaveMemoryResult,
  SaveShortTermMemoryResult,
  SessionInfo,
  ShortTermMemoryEntry,
} from './memory-adapter.js';
import { fromMemoryMessage, toMemoryMessage } from './memory-adapter.js';
import type { Message } from './types.js';

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
    this.baseURL = config.baseURL.replace(/\/$/, '');
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
    githubToken: string
  ): Promise<{ userId: string; sessionToken: string; expiresAt: number }> {
    const response = await this.request('/api/authenticate', {
      method: 'POST',
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
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    const response = (await this.request('/api/memory/get', {
      method: 'POST',
      body: {
        session_id: sessionId,
        ...options,
      },
    })) as {
      session_id: string;
      messages: Array<{
        role: 'user' | 'assistant' | 'system' | 'tool';
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
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    const memoryMessages = messages.map(toMemoryMessage);

    const response = (await this.request('/api/memory/save', {
      method: 'POST',
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
    }
  ): Promise<MemorySearchResult[]> {
    const response = (await this.request('/api/memory/search', {
      method: 'POST',
      body: {
        query,
        limit: options?.limit,
        filter: options?.sessionId ? { session_id: options.sessionId } : undefined,
      },
    })) as {
      results: Array<{
        session_id: string;
        message: {
          role: 'user' | 'assistant' | 'system' | 'tool';
          content: string;
          timestamp?: number;
          metadata?: Record<string, unknown>;
        };
        score: number;
        context: Array<{
          role: 'user' | 'assistant' | 'system' | 'tool';
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
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    const response = (await this.request('/api/sessions/list', {
      method: 'POST',
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
   * Save a short-term memory item (session-scoped, with TTL)
   */
  async saveShortTermMemory(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult> {
    const response = (await this.request('/api/memory/short-term/set', {
      method: 'POST',
      body: {
        session_id: sessionId,
        key,
        value,
        ttl_seconds: ttlSeconds,
      },
    })) as {
      key: string;
      expires_at: number;
      success: boolean;
    };

    return {
      key: response.key,
      expiresAt: response.expires_at,
      success: response.success,
    };
  }

  /**
   * Get a short-term memory item by key
   */
  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null> {
    const response = (await this.request('/api/memory/short-term/get', {
      method: 'POST',
      body: {
        session_id: sessionId,
        key,
      },
    })) as {
      value?: string;
      expires_at?: number;
    } | null;

    if (!response) {
      return null;
    }

    return {
      key,
      value: response.value || '',
      expiresAt: response.expires_at || 0,
    };
  }

  /**
   * List all short-term memory items for a session
   */
  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryEntry[]> {
    const response = (await this.request('/api/memory/short-term/list', {
      method: 'POST',
      body: {
        session_id: sessionId,
      },
    })) as {
      items: Array<{
        key: string;
        value: string;
        expires_at: number;
      }>;
    };

    return response.items.map((item) => ({
      key: item.key,
      value: item.value,
      expiresAt: item.expires_at,
    }));
  }

  /**
   * Delete a short-term memory item
   */
  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    const response = (await this.request('/api/memory/short-term/delete', {
      method: 'POST',
      body: {
        session_id: sessionId,
        key,
      },
    })) as {
      success: boolean;
    };

    return response.success;
  }

  /**
   * Save a long-term memory item (persistent)
   */
  async saveLongTermMemory(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult> {
    const response = (await this.request('/api/memory/long-term/save', {
      method: 'POST',
      body: {
        category,
        key,
        value,
        importance,
        metadata,
      },
    })) as {
      id: string;
      created: boolean;
      success: boolean;
    };

    return {
      id: response.id,
      created: response.created,
      success: response.success,
    };
  }

  /**
   * Get long-term memory items by category and/or key
   */
  async getLongTermMemory(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]> {
    const response = (await this.request('/api/memory/long-term/get', {
      method: 'POST',
      body: filters || {},
    })) as {
      items: Array<{
        id: string;
        category: string;
        key: string;
        value: string;
        importance: number;
        created_at: number;
        updated_at: number;
      }>;
    };

    return response.items.map((item) => ({
      id: item.id,
      category: item.category as 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
      key: item.key,
      value: item.value,
      importance: item.importance,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }

  /**
   * Update a long-term memory item
   */
  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    const response = (await this.request('/api/memory/long-term/update', {
      method: 'POST',
      body: {
        id,
        ...updates,
      },
    })) as {
      success: boolean;
    };

    return response.success;
  }

  /**
   * Delete a long-term memory item
   */
  async deleteLongTermMemory(id: string): Promise<boolean> {
    const response = (await this.request('/api/memory/long-term/delete', {
      method: 'POST',
      body: {
        id,
      },
    })) as {
      success: boolean;
    };

    return response.success;
  }

  /**
   * Search memory using natural language query
   */
  async searchMemoryByQuery(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>> {
    const response = (await this.request('/api/memory/search', {
      method: 'POST',
      body: {
        query,
        categories: filters?.categories,
        limit: filters?.limit,
      },
    })) as {
      results: Array<{
        id: string;
        content: string;
        category: string;
        score: number;
      }>;
    };

    return response.results;
  }

  /**
   * Make a request to the MCP server
   */
  private async request(
    path: string,
    options: {
      method: 'GET' | 'POST';
      body?: unknown;
      auth?: boolean;
    }
  ): Promise<unknown> {
    const { method, body, auth = true } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
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
        (data.error as string) || 'Request failed',
        response.status,
        path
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
    this.name = 'MCPMemoryAdapterError';
    this.statusCode = statusCode;
    this.path = path;
  }
}

/**
 * Create an MCP memory adapter
 */
export function createMCPMemoryAdapter(config: MCPMemoryAdapterConfig): MCPMemoryAdapter {
  return new MCPMemoryAdapter(config);
}

/**
 * Default memory MCP server URL
 */
export const DEFAULT_MEMORY_MCP_URL = 'https://duyetbot-memory.duyet.workers.dev';

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
  private isAvailable = true;
  private lastCheck = 0;
  private checkInterval = 60000; // 1 minute
  private initTimeout: number;

  constructor(config: MCPMemoryAdapterConfig & { initTimeout?: number }) {
    this.adapter = new MCPMemoryAdapter(config);
    this.baseURL = config.baseURL.replace(/\/$/, '');
    this.initTimeout = config.initTimeout ?? 2000; // 2s default for fast init
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
      const timeout = setTimeout(() => controller.abort(), this.initTimeout);

      // Try a simple request to check availability
      const response = await fetch(`${this.baseURL}/api/sessions/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    options?: { limit?: number; offset?: number }
  ): Promise<MemoryData> {
    if (!(await this.checkAvailability())) {
      return { sessionId, messages: [], metadata: {} };
    }

    try {
      return await this.adapter.getMemory(sessionId, options);
    } catch (err) {
      console.warn('Memory getMemory failed:', err);
      return { sessionId, messages: [], metadata: {} };
    }
  }

  async saveMemory(
    sessionId: string,
    messages: Message[],
    metadata?: Record<string, unknown>
  ): Promise<SaveMemoryResult> {
    if (!(await this.checkAvailability())) {
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }

    try {
      return await this.adapter.saveMemory(sessionId, messages, metadata);
    } catch (err) {
      console.warn('Memory saveMemory failed:', err);
      return { sessionId, savedCount: 0, updatedAt: Date.now() };
    }
  }

  async searchMemory(
    query: string,
    options?: {
      limit?: number;
      sessionId?: string;
    }
  ): Promise<MemorySearchResult[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.searchMemory(query, options);
    } catch (err) {
      console.warn('Memory searchMemory failed:', err);
      return [];
    }
  }

  async listSessions(options?: {
    limit?: number;
    offset?: number;
    state?: 'active' | 'paused' | 'completed';
  }): Promise<{ sessions: SessionInfo[]; total: number }> {
    if (!(await this.checkAvailability())) {
      return { sessions: [], total: 0 };
    }

    try {
      return await this.adapter.listSessions(options);
    } catch (err) {
      console.warn('Memory listSessions failed:', err);
      return { sessions: [], total: 0 };
    }
  }

  async saveShortTermMemory(
    sessionId: string,
    key: string,
    value: string,
    ttlSeconds?: number
  ): Promise<SaveShortTermMemoryResult> {
    if (!(await this.checkAvailability())) {
      return {
        key,
        expiresAt: Date.now() + (ttlSeconds || 86400) * 1000,
        success: false,
      };
    }

    try {
      return await this.adapter.saveShortTermMemory(sessionId, key, value, ttlSeconds);
    } catch (err) {
      console.warn('Memory saveShortTermMemory failed:', err);
      return {
        key,
        expiresAt: Date.now() + (ttlSeconds || 86400) * 1000,
        success: false,
      };
    }
  }

  async getShortTermMemory(sessionId: string, key: string): Promise<ShortTermMemoryEntry | null> {
    if (!(await this.checkAvailability())) {
      return null;
    }

    try {
      return await this.adapter.getShortTermMemory(sessionId, key);
    } catch (err) {
      console.warn('Memory getShortTermMemory failed:', err);
      return null;
    }
  }

  async listShortTermMemory(sessionId: string): Promise<ShortTermMemoryEntry[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.listShortTermMemory(sessionId);
    } catch (err) {
      console.warn('Memory listShortTermMemory failed:', err);
      return [];
    }
  }

  async deleteShortTermMemory(sessionId: string, key: string): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.deleteShortTermMemory(sessionId, key);
    } catch (err) {
      console.warn('Memory deleteShortTermMemory failed:', err);
      return false;
    }
  }

  async saveLongTermMemory(
    category: 'fact' | 'preference' | 'pattern' | 'decision' | 'note',
    key: string,
    value: string,
    importance?: number,
    metadata?: Record<string, unknown>
  ): Promise<SaveLongTermMemoryResult> {
    if (!(await this.checkAvailability())) {
      return {
        id: `local-${Date.now()}`,
        created: false,
        success: false,
      };
    }

    try {
      return await this.adapter.saveLongTermMemory(category, key, value, importance, metadata);
    } catch (err) {
      console.warn('Memory saveLongTermMemory failed:', err);
      return {
        id: `local-${Date.now()}`,
        created: false,
        success: false,
      };
    }
  }

  async getLongTermMemory(filters?: {
    category?: 'fact' | 'preference' | 'pattern' | 'decision' | 'note';
    key?: string;
    limit?: number;
  }): Promise<LongTermMemoryEntry[]> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.getLongTermMemory(filters);
    } catch (err) {
      console.warn('Memory getLongTermMemory failed:', err);
      return [];
    }
  }

  async updateLongTermMemory(
    id: string,
    updates: {
      value?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.updateLongTermMemory(id, updates);
    } catch (err) {
      console.warn('Memory updateLongTermMemory failed:', err);
      return false;
    }
  }

  async deleteLongTermMemory(id: string): Promise<boolean> {
    if (!(await this.checkAvailability())) {
      return false;
    }

    try {
      return await this.adapter.deleteLongTermMemory(id);
    } catch (err) {
      console.warn('Memory deleteLongTermMemory failed:', err);
      return false;
    }
  }

  async searchMemoryByQuery(
    query: string,
    filters?: {
      categories?: string[];
      limit?: number;
    }
  ): Promise<Array<{ id: string; content: string; category: string; score: number }>> {
    if (!(await this.checkAvailability())) {
      return [];
    }

    try {
      return await this.adapter.searchMemoryByQuery(query, filters);
    } catch (err) {
      console.warn('Memory searchMemoryByQuery failed:', err);
      return [];
    }
  }
}

/**
 * Create a resilient MCP memory adapter with graceful degradation
 */
export function createResilientMCPMemoryAdapter(
  config: MCPMemoryAdapterConfig
): ResilientMCPMemoryAdapter {
  return new ResilientMCPMemoryAdapter(config);
}

// Re-export helper for converting messages
export { fromMemoryMessage };
